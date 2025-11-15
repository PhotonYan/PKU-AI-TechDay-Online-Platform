from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import yaml
from fastapi import APIRouter, Depends, HTTPException, status

from .. import models, schemas
from ..config import get_settings
from ..dependencies import get_optional_user, require_news_publisher

settings = get_settings()
POSTS_DIR = Path(settings.posts_dir)
POSTS_DIR.mkdir(parents=True, exist_ok=True)
VISIBILITY_VALUES = {"public", "authenticated", "volunteer", "author", "reviewer", "admin"}

router = APIRouter(prefix="/api/posts", tags=["posts"])


@dataclass
class PostRecord:
    slug: str
    path: Path
    title: str
    date: str
    category: Optional[str]
    summary: str
    tags: List[str]
    visibility: List[str]
    author: Optional[str]
    author_id: Optional[int]
    published: bool
    content: str


def _read_posts() -> List[PostRecord]:
    posts: List[PostRecord] = []
    for file_path in sorted(POSTS_DIR.glob("*.md")):
        record = _parse_post_file(file_path)
        if record:
            posts.append(record)
    posts.sort(key=lambda item: _parse_date(item.date), reverse=True)
    return posts


def _parse_date(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return datetime.min


def _parse_post_file(path: Path) -> Optional[PostRecord]:
    raw = path.read_text(encoding="utf-8")
    meta, content = _extract_frontmatter(raw)
    title = meta.get("title") or path.stem
    date = str(meta.get("date") or datetime.utcnow().date())
    category = meta.get("category")
    summary = meta.get("summary") or _build_summary(content)
    tags = _normalize_tags(meta.get("tags"))
    visibility = _normalize_visibility(meta.get("visibility"))
    author = meta.get("author")
    author_id = meta.get("author_id")
    if isinstance(author_id, str) and author_id.isdigit():
        author_id = int(author_id)
    elif isinstance(author_id, (int, float)):
        author_id = int(author_id)
    else:
        author_id = None
    published = bool(meta.get("published", True))
    return PostRecord(
        slug=path.stem,
        path=path,
        title=title,
        date=date,
        category=category,
        summary=summary,
        tags=tags,
        visibility=visibility,
        author=author,
        author_id=author_id,
        published=published,
        content=content,
    )


def _extract_frontmatter(raw: str):
    normalized = raw.replace("\r\n", "\n")
    if normalized.startswith("---\n"):
        body_part = normalized[4:]
        marker = "\n---\n"
        if marker in body_part:
            front_raw, body = body_part.split(marker, 1)
            data = yaml.safe_load(front_raw) or {}
            return data, body.lstrip("\n")
    return {}, normalized


def _normalize_tags(value) -> List[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [tag.strip() for tag in value.split(",") if tag.strip()]
    if isinstance(value, list):
        return [str(tag).strip() for tag in value if str(tag).strip()]
    return []


def _normalize_visibility(value) -> List[str]:
    if not value:
        return ["public"]
    if isinstance(value, str):
        raw = [value]
    else:
        raw = value
    deduped = []
    for item in raw:
        candidate = str(item).strip().lower()
        if candidate in VISIBILITY_VALUES and candidate not in deduped:
            deduped.append(candidate)
    return deduped or ["public"]


def _build_summary(markdown: str, length: int = 160) -> str:
    clean = re.sub(r"`{3}[\s\S]*?`{3}", "", markdown)
    clean = re.sub(r"`+", "", clean)
    clean = re.sub(r"[*_>#-]", "", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:length] + ("..." if len(clean) > length else "")


def _can_view(post: PostRecord, user: Optional[models.User]) -> bool:
    if post.visibility and "public" in post.visibility:
        return True
    if user is None:
        return False
    if user.role == models.UserRole.admin:
        return True
    if "authenticated" in post.visibility:
        return True
    return user.role.value in post.visibility


def _can_edit(post: PostRecord, user: Optional[models.User]) -> bool:
    if user is None:
        return False
    if user.role == models.UserRole.admin:
        return True
    return bool(getattr(user, "can_publish_news", False) and post.author_id == user.id)


def _to_summary(post: PostRecord) -> schemas.NewsPostSummary:
    return schemas.NewsPostSummary(
        slug=post.slug,
        title=post.title,
        date=post.date,
        category=post.category,
        summary=post.summary,
        tags=post.tags,
        visibility=post.visibility,
        author=post.author,
        author_id=post.author_id,
        published=post.published,
    )


def _to_detail(post: PostRecord) -> schemas.NewsPostDetail:
    summary = _to_summary(post)
    return schemas.NewsPostDetail(**summary.dict(), content=post.content)


def _slugify(value: str) -> str:
    cleaned = re.sub(r"\s+", "-", value.lower().strip())
    cleaned = re.sub(r"[^a-z0-9-]", "", cleaned)
    return cleaned or "post"


def _generate_slug(date_value: str, title: str) -> str:
    base = _slugify(title)
    prefix = date_value.strip() or datetime.utcnow().strftime("%Y-%m-%d")
    slug = f"{prefix}-{base}"
    candidate = slug
    counter = 1
    while (POSTS_DIR / f"{candidate}.md").exists():
        counter += 1
        candidate = f"{slug}-{counter}"
    return candidate


def _write_post(record: PostRecord):
    data = {
        "title": record.title,
        "date": record.date,
        "category": record.category,
        "summary": record.summary,
        "tags": record.tags or None,
        "visibility": record.visibility or ["public"],
        "author": record.author,
        "author_id": record.author_id,
        "published": record.published,
    }
    content = record.content.rstrip() + "\n"
    frontmatter = yaml.safe_dump({k: v for k, v in data.items() if v is not None}, allow_unicode=True, sort_keys=False)
    record.path.write_text(f"---\n{frontmatter.strip()}\n---\n\n{content}", encoding="utf-8")


def _load_post_by_slug(slug: str) -> PostRecord:
    if "/" in slug or ".." in slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid slug")
    path = POSTS_DIR / f"{slug}.md"
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return _parse_post_file(path)


@router.get("", response_model=List[schemas.NewsPostSummary])
def list_posts(user: Optional[models.User] = Depends(get_optional_user)):
    posts = []
    for post in _read_posts():
        if not post.published:
            continue
        if _can_view(post, user):
            posts.append(_to_summary(post))
    return posts


@router.get("/manage", response_model=List[schemas.NewsPostSummary])
def manage_posts(user: models.User = Depends(require_news_publisher)):
    posts = _read_posts()
    if user.role != models.UserRole.admin:
        posts = [post for post in posts if post.author_id == user.id]
    return [_to_summary(post) for post in posts]


@router.get("/{slug}", response_model=schemas.NewsPostDetail)
def get_post(slug: str, user: Optional[models.User] = Depends(get_optional_user)):
    post = _load_post_by_slug(slug)
    if post.published:
        if not _can_view(post, user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权查看该公告")
        return _to_detail(post)
    if _can_edit(post, user):
        return _to_detail(post)
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权查看该公告")


@router.post("", response_model=schemas.NewsPostDetail)
def create_post(payload: schemas.NewsPostCreate, user: models.User = Depends(require_news_publisher)):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="正文不能为空")
    date_value = payload.date.strip() if payload.date else datetime.utcnow().strftime("%Y-%m-%d")
    slug = _generate_slug(date_value, title)
    path = POSTS_DIR / f"{slug}.md"
    tags = _normalize_tags(payload.tags)
    visibility = _normalize_visibility(payload.visibility)
    summary = payload.summary.strip() if payload.summary else _build_summary(payload.content)
    category = payload.category.strip() if payload.category else None
    record = PostRecord(
        slug=slug,
        path=path,
        title=title,
        date=date_value,
        category=category,
        summary=summary,
        tags=tags,
        visibility=visibility,
        author=user.name,
        author_id=user.id,
        published=bool(payload.published) if payload.published is not None else False,
        content=payload.content,
    )
    _write_post(record)
    return _to_detail(record)


@router.put("/{slug}", response_model=schemas.NewsPostDetail)
def update_post(slug: str, payload: schemas.NewsPostUpdate, user: models.User = Depends(require_news_publisher)):
    existing = _load_post_by_slug(slug)
    if not _can_edit(existing, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权编辑该公告")
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="正文不能为空")
    existing.title = title
    existing.date = payload.date.strip() if payload.date else existing.date
    existing.category = payload.category.strip() if payload.category else None
    existing.summary = payload.summary.strip() if payload.summary else _build_summary(payload.content)
    existing.tags = _normalize_tags(payload.tags)
    existing.visibility = _normalize_visibility(payload.visibility)
    existing.content = payload.content
    if payload.published is not None:
        existing.published = bool(payload.published)
    _write_post(existing)
    return _to_detail(existing)


@router.delete("/{slug}")
def delete_post(slug: str, user: models.User = Depends(require_news_publisher)):
    post = _load_post_by_slug(slug)
    if not _can_edit(post, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除该公告")
    post.path.unlink(missing_ok=True)
    return {"status": "deleted"}


@router.post("/{slug}/publish", response_model=schemas.NewsPostSummary)
def publish_post(
    slug: str,
    payload: schemas.NewsPostPublish,
    user: models.User = Depends(require_news_publisher),
):
    post = _load_post_by_slug(slug)
    if not _can_edit(post, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权修改发布状态")
    post.published = bool(payload.published)
    _write_post(post)
    return _to_summary(post)
