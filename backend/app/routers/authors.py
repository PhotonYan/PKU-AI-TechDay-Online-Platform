import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_password_hash
from ..config import get_settings
from ..dependencies import get_db, require_author
from ..utils.user import user_to_response

router = APIRouter(prefix="/api/authors", tags=["authors"])
settings = get_settings()


def _bool_value(value: bool | str | None, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return value.lower() in {"1", "true", "yes", "on"}


def _save_poster(upload: UploadFile | None) -> Optional[str]:
    if not upload:
        return None
    if upload.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="仅支持上传 PDF 文件")
    current_year = datetime.utcnow().year
    poster_dir = Path(settings.uploads_dir) / "posters" / str(current_year)
    poster_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(upload.filename or "poster.pdf").suffix or ".pdf"
    filename = f"{uuid4().hex}{suffix}"
    rel_path = Path("posters") / str(current_year) / filename
    abs_path = Path(settings.uploads_dir) / rel_path
    with abs_path.open("wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)
    return rel_path.as_posix()


def _delete_poster(path: Optional[str]):
    if not path:
        return
    prefix = "uploads/"
    try:
        relative = Path(path[len(prefix):]) if path.startswith(prefix) else Path(path)
    except ValueError:
        relative = Path(path)
    abs_path = Path(settings.uploads_dir) / relative
    if abs_path.exists():
        abs_path.unlink()


def _require_direction(db: Session, direction_id: Optional[int]) -> int:
    if not direction_id:
        raise HTTPException(status_code=400, detail="必须选择方向")
    direction = db.query(models.Direction).filter(models.Direction.id == direction_id).first()
    if not direction:
        raise HTTPException(status_code=404, detail="方向不存在")
    return direction_id


def _poster_api_path(submission: models.Submission) -> Optional[str]:
    return f"/api/submissions/{submission.id}/poster" if submission.poster_path else None


def _serialize_author_submission(submission: models.Submission) -> dict:
    return {
        "id": submission.id,
        "title": submission.title,
        "track": submission.track.value,
        "direction": submission.direction.name if submission.direction else None,
        "direction_id": submission.direction_id,
        "status": submission.review_status.value,
        "publication_status": submission.publication_status.value,
        "authors": submission.authors,
        "year": submission.year,
        "poster_path": _poster_api_path(submission),
    }


@router.post("/register", response_model=schemas.UserResponse)
def register_author(payload: schemas.AuthorRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="邮箱已被注册")
    submission_conflict = db.query(models.User).filter(models.User.student_id == payload.student_id).first()
    if submission_conflict:
        raise HTTPException(status_code=400, detail="学号已被注册")
    user = models.User(
        email=payload.email,
        name=payload.name,
        school=payload.school,
        college=payload.college,
        grade=payload.grade,
        student_id=payload.student_id,
        password_hash=get_password_hash(payload.password),
        role=models.UserRole.author,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_response(user, db)


@router.get("/me", response_model=schemas.UserResponse)
def get_author_profile(author: models.User = Depends(require_author), db: Session = Depends(get_db)):
    return user_to_response(author, db)


@router.get("/submissions")
def list_author_submissions(
    author: models.User = Depends(require_author),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.Submission)
        .filter(models.Submission.author_id == author.id)
        .order_by(models.Submission.created_at.desc())
        .all()
    )
    return [_serialize_author_submission(row) for row in rows]


@router.get("/submissions/{submission_id}")
def get_author_submission(
    submission_id: int,
    author: models.User = Depends(require_author),
    db: Session = Depends(get_db),
):
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id, models.Submission.author_id == author.id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="未找到投稿")
    return {
        "id": submission.id,
        "title": submission.title,
        "abstract": submission.abstract,
        "contact": submission.contact,
        "venue": submission.venue,
        "authors": submission.authors,
        "track": submission.track.value,
        "direction_id": submission.direction_id,
        "publication_status": submission.publication_status.value,
        "archive_consent": submission.archive_consent,
        "paper_url": submission.paper_url,
        "poster_path": _poster_api_path(submission),
    }


@router.post("/submissions")
def create_submission(
    title: str = Form(...),
    abstract: str = Form(...),
    contact: str = Form(...),
    venue: str = Form(...),
    authors: str = Form(...),
    track: models.SubmissionTrack = Form(...),
    publication_status: models.SubmissionPublicationStatus = Form(...),
    archive_consent: bool | str | None = Form(True),
    direction_id: Optional[int] = Form(None),
    paper_url: Optional[str] = Form(None),
    poster: UploadFile | None = File(None),
    author: models.User = Depends(require_author),
    db: Session = Depends(get_db),
):
    direction_value = _require_direction(db, direction_id)
    poster_path = _save_poster(poster)
    submission = models.Submission(
        title=title,
        abstract=abstract,
        contact=contact,
        venue=venue,
        authors=authors,
        track=track,
        publication_status=publication_status,
        archive_consent=_bool_value(archive_consent, True),
        direction_id=direction_value,
        paper_url=paper_url,
        poster_path=poster_path,
        author_id=author.id,
        year=datetime.utcnow().year,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return _serialize_author_submission(submission)


@router.put("/submissions/{submission_id}")
def update_submission(
    submission_id: int,
    title: str = Form(...),
    abstract: str = Form(...),
    contact: str = Form(...),
    venue: str = Form(...),
    authors: str = Form(...),
    track: models.SubmissionTrack = Form(...),
    publication_status: models.SubmissionPublicationStatus = Form(...),
    archive_consent: bool | str | None = Form(True),
    direction_id: Optional[int] = Form(None),
    paper_url: Optional[str] = Form(None),
    poster: UploadFile | None = File(None),
    author: models.User = Depends(require_author),
    db: Session = Depends(get_db),
):
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id, models.Submission.author_id == author.id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="未找到投稿")
    direction_value = _require_direction(db, direction_id)
    if poster:
        _delete_poster(submission.poster_path)
        submission.poster_path = _save_poster(poster)
    submission.title = title
    submission.abstract = abstract
    submission.contact = contact
    submission.venue = venue
    submission.authors = authors
    submission.track = track
    submission.publication_status = publication_status
    submission.archive_consent = _bool_value(archive_consent, True)
    submission.direction_id = direction_value
    submission.paper_url = paper_url
    submission.review_status = models.SubmissionReviewStatus.pending
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return _serialize_author_submission(submission)


@router.delete("/submissions/{submission_id}")
def delete_submission(
    submission_id: int,
    author: models.User = Depends(require_author),
    db: Session = Depends(get_db),
):
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == submission_id, models.Submission.author_id == author.id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="未找到投稿")
    _delete_poster(submission.poster_path)
    db.delete(submission)
    db.commit()
    return {"status": "deleted"}
