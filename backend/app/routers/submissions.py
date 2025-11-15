import csv
import io
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..config import get_settings
from ..dependencies import get_db, get_optional_user, require_admin, require_vote_editor
from ..auth import decode_token
from ..utils.awards import compute_award_badges, compute_award_tags

router = APIRouter(prefix="/api/submissions", tags=["submissions"])
settings = get_settings()


def _site_settings(db: Session) -> tuple[bool, bool, set[int] | None]:
    settings_row = db.query(models.SiteSettings).first()
    show_votes = settings_row.show_vote_data if settings_row else False
    can_sort = settings_row.vote_sort_enabled if settings_row else False
    visible_awards: set[int] | None = None
    if settings_row and settings_row.visible_award_ids:
        try:
            visible_awards = {int(value) for value in settings_row.visible_award_ids.split(",") if value}
        except ValueError:
            visible_awards = None
    return show_votes, can_sort, visible_awards


def _poster_download_path(submission: models.Submission) -> Optional[str]:
    if not submission.poster_path:
        return None
    return f"/api/submissions/{submission.id}/poster"


def _resolve_poster_path(stored_path: str) -> Path:
    relative = stored_path.lstrip("/")
    if relative.startswith("uploads/"):
        relative = relative[len("uploads/"):]
    return Path(settings.uploads_dir) / Path(relative)


def _can_view_submission(submission: models.Submission, user: Optional[models.User]) -> bool:
    if submission.review_status == models.SubmissionReviewStatus.approved:
        return True
    if not user:
        return False
    if user.role == models.UserRole.admin:
        return True
    if user.role == models.UserRole.author and submission.author_id == user.id:
        return True
    return False


@router.get("")
def list_submissions(
    track: models.SubmissionTrack = models.SubmissionTrack.poster,
    direction_id: Optional[int] = None,
    sort: Optional[str] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    show_votes, can_sort, visible_awards = _site_settings(db)
    query = (
        db.query(models.Submission)
        .options(
            selectinload(models.Submission.direction),
            selectinload(models.Submission.author),
            selectinload(models.Submission.award_records).selectinload(models.SubmissionAward.award),
            selectinload(models.Submission.recommendations),
        )
        .filter(models.Submission.track == track)
        .filter(models.Submission.review_status == models.SubmissionReviewStatus.approved)
    )
    if direction_id:
        query = query.filter(models.Submission.direction_id == direction_id)
    if year:
        query = query.filter(models.Submission.year == year)
    allowed_sort = {"vote_innovation", "vote_impact", "vote_feasibility"}
    if show_votes and can_sort and sort in allowed_sort:
        query = query.order_by(getattr(models.Submission, sort).desc())
    else:
        query = query.order_by(models.Submission.updated_at.desc())
    submissions = query.all()
    payload = []
    for submission in submissions:
        item = {
            "id": submission.id,
            "sequence_no": submission.sequence_no,
            "title": submission.title,
            "direction": submission.direction.name if submission.direction else None,
            "direction_id": submission.direction_id,
            "author": submission.author.name if submission.author else "-",
            "authors": submission.authors,
            "venue": submission.venue,
            "status": submission.review_status.value,
            "track": submission.track.value,
            "archive_consent": submission.archive_consent,
            "paper_url": submission.paper_url,
            "poster_path": _poster_download_path(submission),
            "award": submission.award,
            "award_tags": compute_award_tags(submission, visible_awards),
            "award_badges": compute_award_badges(submission, visible_awards),
            "publication_status": submission.publication_status.value,
            "year": submission.year,
        }
        if show_votes:
            item.update(
                {
                    "vote_innovation": submission.vote_innovation,
                    "vote_impact": submission.vote_impact,
                    "vote_feasibility": submission.vote_feasibility,
                }
            )
        payload.append(item)
    return {
        "track": track.value,
        "showVotes": show_votes,
        "canSort": show_votes and can_sort,
        "submissions": payload,
    }


@router.get("/export")
def export_submissions(
    track: models.SubmissionTrack = models.SubmissionTrack.poster,
    direction_id: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    query = (
        db.query(models.Submission)
        .filter(models.Submission.track == track)
        .filter(models.Submission.review_status == models.SubmissionReviewStatus.approved)
    )
    direction_name = "all"
    if direction_id:
        query = query.filter(models.Submission.direction_id == direction_id)
        direction = db.query(models.Direction).filter(models.Direction.id == direction_id).first()
        direction_name = direction.name if direction else "all"
    if year:
        query = query.filter(models.Submission.year == year)
    rows = query.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "title",
            "direction",
            "author",
            "authors",
            "year",
            "venue",
            "status",
            "track",
            "archive_consent",
            "paper_url",
            "poster_path",
            "award",
        ]
    )
    for submission in rows:
        writer.writerow(
            [
                submission.title,
                submission.direction.name if submission.direction else "",
                submission.author.name if submission.author else "",
                submission.authors or "",
                submission.year or "",
                submission.venue,
                submission.review_status.value,
                submission.track.value,
                "true" if submission.archive_consent else "false",
                submission.paper_url or "",
                submission.poster_path or "",
                submission.award or "",
            ]
        )
    direction_slug = direction_name.replace(" ", "_") if direction_name != "all" else "all"
    filename = f"{track.value}-{direction_slug}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{submission_id}")
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not _can_view_submission(submission, current_user):
        raise HTTPException(status_code=403, detail="无权查看该投稿")
    show_votes, _, visible_awards = _site_settings(db)
    can_view_logs = False
    if current_user:
        if current_user.role == models.UserRole.admin:
            can_view_logs = True
        elif current_user.role_template and current_user.role_template.can_edit_vote_data:
            can_view_logs = True
        elif current_user.role == models.UserRole.author and submission.author_id == current_user.id:
            can_view_logs = True
    logs_payload = []
    if can_view_logs:
        logs = (
            db.query(models.SubmissionVoteLog)
            .filter(models.SubmissionVoteLog.submission_id == submission.id)
            .order_by(models.SubmissionVoteLog.created_at.desc())
            .limit(50)
            .all()
        )
        for log in logs:
            logs_payload.append(
                {
                    "id": log.id,
                    "field_name": log.field_name,
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "created_at": log.created_at,
                    "user_name": log.user.name if log.user else None,
                }
            )
    payload = {
        "id": submission.id,
        "title": submission.title,
        "sequence_no": submission.sequence_no,
        "abstract": submission.abstract,
        "direction": submission.direction.name if submission.direction else None,
        "direction_id": submission.direction_id,
        "contact": submission.contact,
        "venue": submission.venue,
        "authors": submission.authors,
        "track": submission.track.value,
        "status": submission.review_status.value,
        "publication_status": submission.publication_status.value,
        "archive_consent": submission.archive_consent,
        "paper_url": submission.paper_url,
        "poster_path": _poster_download_path(submission),
        "award": submission.award,
        "award_tags": compute_award_tags(submission, visible_awards),
        "award_badges": compute_award_badges(submission, visible_awards),
        "author": submission.author.name if submission.author else None,
        "year": submission.year,
        "showVotes": show_votes,
        "canViewLogs": can_view_logs,
    }
    if show_votes:
        payload.update(
            {
                "vote_innovation": submission.vote_innovation,
                "vote_impact": submission.vote_impact,
                "vote_feasibility": submission.vote_feasibility,
            }
        )
    if can_view_logs:
        payload["logs"] = logs_payload
    return payload


@router.patch("/{submission_id}/votes")
def update_votes(
    submission_id: int,
    payload: schemas.SubmissionVoteUpdate,
    db: Session = Depends(get_db),
    editor: models.User = Depends(require_vote_editor),
):
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    allowed_fields = ["vote_innovation", "vote_impact", "vote_feasibility"]
    payload_data = payload.dict(exclude_none=True)
    if not payload_data:
        raise HTTPException(status_code=400, detail="No vote data provided")
    for field in allowed_fields:
        if field in payload_data:
            old_value = getattr(submission, field)
            new_value = float(payload_data[field])
            setattr(submission, field, new_value)
            log = models.SubmissionVoteLog(
                submission_id=submission.id,
                user_id=editor.id,
                field_name=field,
                old_value=old_value,
                new_value=new_value,
            )
            db.add(log)
    db.add(submission)
    db.commit()
    return {"status": "ok"}


@router.get("/{submission_id}/poster")
def download_submission_poster(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
    token: Optional[str] = Query(None),
):
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission or not submission.poster_path:
        raise HTTPException(status_code=404, detail="Poster not found")
    resolved_user = current_user
    if not resolved_user and token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id is not None:
                resolved_user = db.query(models.User).filter(models.User.id == int(user_id)).first()
        except Exception:  # noqa: BLE001
            resolved_user = None
    allowed_public = submission.review_status == models.SubmissionReviewStatus.approved
    has_authenticated_access = bool(resolved_user) and _can_view_submission(submission, resolved_user)
    if not allowed_public and not has_authenticated_access:
        raise HTTPException(status_code=403, detail="无权访问该 Poster")
    file_path = _resolve_poster_path(submission.poster_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Poster 已移除")

    def _iterator():
        with file_path.open("rb") as handle:
            while True:
                chunk = handle.read(8192)
                if not chunk:
                    break
                yield chunk

    disposition = "inline" if allowed_public or has_authenticated_access else "attachment"
    return StreamingResponse(
        _iterator(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{file_path.name}"'},
    )
