from __future__ import annotations

from typing import List, Optional, Sequence

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..dependencies import get_db, require_admin, require_admin_or_reviewer, require_reviewer
from ..utils.awards import compute_award_tags, update_submission_award_text

router = APIRouter(prefix="/api/awards", tags=["awards"])


@router.get("", response_model=List[schemas.AwardResponse])
def list_awards(db: Session = Depends(get_db), user: models.User = Depends(require_admin_or_reviewer)):
    _ = user  # unused but ensures auth
    return db.query(models.Award).order_by(models.Award.name.asc()).all()


@router.post("", response_model=schemas.AwardResponse)
def create_award(
    payload: schemas.AwardCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    existing = db.query(models.Award).filter(models.Award.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="奖项名称已存在")
    award = models.Award(name=payload.name, description=payload.description, color=payload.color)
    db.add(award)
    db.commit()
    db.refresh(award)
    return award


@router.put("/{award_id}", response_model=schemas.AwardResponse)
def update_award(
    award_id: int,
    payload: schemas.AwardUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    award = db.query(models.Award).filter(models.Award.id == award_id).first()
    if not award:
        raise HTTPException(status_code=404, detail="奖项不存在")
    if payload.name:
        conflict = (
            db.query(models.Award)
            .filter(models.Award.name == payload.name, models.Award.id != award_id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail="奖项名称已存在")
        award.name = payload.name
    if payload.description is not None:
        award.description = payload.description
    if payload.color is not None:
        award.color = payload.color
    db.add(award)
    db.commit()
    db.refresh(award)
    return award


@router.delete("/{award_id}")
def delete_award(
    award_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    award = db.query(models.Award).filter(models.Award.id == award_id).first()
    if not award:
        raise HTTPException(status_code=404, detail="奖项不存在")
    in_use = (
        db.query(models.SubmissionAward)
        .filter(models.SubmissionAward.award_id == award_id)
        .first()
        is not None
    )
    if in_use:
        raise HTTPException(status_code=400, detail="奖项已用于投稿，无法删除")
    db.delete(award)
    db.commit()
    return {"status": "deleted"}


def _load_submissions_for_awards(
    db: Session,
    direction_ids: Optional[List[int]],
    current_user: models.User,
    track: models.SubmissionTrack,
    year: Optional[int],
) -> Sequence[models.Submission]:
    query = (
        db.query(models.Submission)
        .options(
            selectinload(models.Submission.direction),
            selectinload(models.Submission.author),
            selectinload(models.Submission.award_records).selectinload(models.SubmissionAward.award),
            selectinload(models.Submission.recommendations).selectinload(models.ReviewRecommendation.reviewer),
        )
        .filter(models.Submission.review_status == models.SubmissionReviewStatus.approved)
        .filter(models.Submission.track == track)
    )
    if current_user.role == models.UserRole.reviewer:
        query = query.filter(models.Submission.direction_id == current_user.reviewer_direction_id)
    elif direction_ids:
        query = query.filter(models.Submission.direction_id.in_(direction_ids))
    if year:
        query = query.filter(models.Submission.year == year)
    return query.order_by(models.Submission.sequence_no.asc(), models.Submission.id.asc()).all()


def _filter_by_status(submissions: Sequence[models.Submission], statuses: set[str]) -> list[models.Submission]:
    if not statuses:
        return list(submissions)
    filtered: list[models.Submission] = []
    for submission in submissions:
        tags = compute_award_tags(submission)
        match = False
        for status in statuses:
            if status == "none" and tags == ["无"]:
                match = True
                break
            if status == "recommended" and "推荐" in tags:
                match = True
                break
            if status not in {"none", "recommended"} and status in tags:
                match = True
                break
        if match:
            filtered.append(submission)
    return filtered


def _sort_submissions(rows: list[models.Submission], sort_key: str, order: str) -> list[models.Submission]:
    reverse = order == "desc"
    if sort_key == "id":
        return sorted(rows, key=lambda sub: sub.id, reverse=reverse)
    return sorted(rows, key=lambda sub: (sub.sequence_no or 0, sub.id), reverse=reverse)


def _serialize_recommendation(rec: models.ReviewRecommendation) -> schemas.ReviewRecommendationResponse:
    return schemas.ReviewRecommendationResponse(
        reviewer_id=rec.reviewer_id,
        reviewer_name=rec.reviewer.name if rec.reviewer else "未知",
        reason=rec.reason,
        confidence=rec.confidence,
        updated_at=rec.updated_at,
    )


@router.get("/submissions", response_model=List[schemas.AwardedSubmissionResponse])
def list_award_submissions(
    direction_ids: Optional[str] = Query(None, description="逗号分隔的方向ID"),
    status: Optional[str] = Query(None, description="逗号分隔的状态标签"),
    sort_by: str = Query("sequence", regex="^(sequence|id)$"),
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
    track: models.SubmissionTrack = Query(models.SubmissionTrack.poster),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_or_reviewer),
):
    direction_list = None
    if current_user.role == models.UserRole.admin and direction_ids:
        try:
            direction_list = [int(item) for item in direction_ids.split(",") if item]
        except ValueError:
            raise HTTPException(status_code=400, detail="方向筛选参数不合法")
    submissions = list(_load_submissions_for_awards(db, direction_list, current_user, track, year))
    status_set: set[str] = set()
    if status:
        status_set = {item for item in status.split(",") if item}
    submissions = _filter_by_status(submissions, status_set)
    submissions = _sort_submissions(submissions, sort_by, sort_order)
    rows: list[schemas.AwardedSubmissionResponse] = []
    for submission in submissions:
        recommendations = [_serialize_recommendation(rec) for rec in submission.recommendations]
        my_recommendation = None
        if current_user.role == models.UserRole.reviewer:
            for rec in submission.recommendations:
                if rec.reviewer_id == current_user.id:
                    my_recommendation = _serialize_recommendation(rec)
                    break
        rows.append(
            schemas.AwardedSubmissionResponse(
                id=submission.id,
                sequence_no=submission.sequence_no,
                title=submission.title,
                direction=submission.direction.name if submission.direction else None,
                direction_id=submission.direction_id,
                author=submission.author.name if submission.author else None,
                authors=submission.authors,
                year=submission.year,
                award_tags=compute_award_tags(submission),
                award_badges=[
                    schemas.SubmissionAwardTag(
                        name=record.award.name,
                        color=record.award.color if record.award else None,
                    )
                    for record in submission.award_records
                    if record.award
                ],
                reviewer_tags=recommendations,
                my_recommendation=my_recommendation,
            )
        )
    return rows


@router.post("/submissions/{submission_id}/recommendation", response_model=schemas.ReviewRecommendationResponse)
def upsert_recommendation(
    submission_id: int,
    payload: schemas.ReviewRecommendationPayload,
    db: Session = Depends(get_db),
    reviewer: models.User = Depends(require_reviewer),
):
    submission = (
        db.query(models.Submission)
        .options(
            selectinload(models.Submission.award_records).selectinload(models.SubmissionAward.award),
            selectinload(models.Submission.recommendations),
        )
        .filter(
            models.Submission.id == submission_id,
            models.Submission.review_status == models.SubmissionReviewStatus.approved,
        )
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="投稿未找到或未通过审核")
    if submission.direction_id != reviewer.reviewer_direction_id:
        raise HTTPException(status_code=403, detail="无权操作其他方向的投稿")
    recommendation = None
    for rec in submission.recommendations:
        if rec.reviewer_id == reviewer.id:
            recommendation = rec
            break
    if not recommendation:
        recommendation = models.ReviewRecommendation(
            submission_id=submission.id,
            reviewer_id=reviewer.id,
            reason=payload.reason,
            confidence=payload.confidence,
        )
        submission.recommendations.append(recommendation)
    else:
        recommendation.reason = payload.reason
        recommendation.confidence = payload.confidence
    db.add(recommendation)
    update_submission_award_text(submission)
    db.add(submission)
    db.commit()
    db.refresh(recommendation)
    return _serialize_recommendation(recommendation)


@router.delete("/submissions/{submission_id}/recommendation")
def delete_recommendation(
    submission_id: int,
    db: Session = Depends(get_db),
    reviewer: models.User = Depends(require_reviewer),
):
    recommendation = (
        db.query(models.ReviewRecommendation)
        .filter(
            models.ReviewRecommendation.submission_id == submission_id,
            models.ReviewRecommendation.reviewer_id == reviewer.id,
        )
        .first()
    )
    if not recommendation:
        raise HTTPException(status_code=404, detail="尚未推荐该投稿")
    submission = (
        db.query(models.Submission)
        .options(
            selectinload(models.Submission.award_records).selectinload(models.SubmissionAward.award),
            selectinload(models.Submission.recommendations),
        )
        .filter(models.Submission.id == submission_id)
        .first()
    )
    db.delete(recommendation)
    if submission:
        submission.recommendations[:] = [
            rec for rec in submission.recommendations if rec.reviewer_id != reviewer.id
        ]
        update_submission_award_text(submission)
        db.add(submission)
    db.commit()
    return {"status": "deleted"}


@router.post("/submissions/{submission_id}/assign", response_model=schemas.AwardedSubmissionResponse)
def assign_awards(
    submission_id: int,
    payload: schemas.AwardAssignmentRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    submission = (
        db.query(models.Submission)
        .options(
            selectinload(models.Submission.direction),
            selectinload(models.Submission.author),
            selectinload(models.Submission.award_records).selectinload(models.SubmissionAward.award),
            selectinload(models.Submission.recommendations),
        )
        .filter(models.Submission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="投稿不存在")
    awards = []
    for award_id in payload.award_ids:
        award = db.query(models.Award).filter(models.Award.id == award_id).first()
        if not award:
            raise HTTPException(status_code=404, detail=f"奖项 {award_id} 不存在")
        awards.append(award)
    existing = {record.award_id: record for record in submission.award_records}
    desired_ids = set(payload.award_ids)
    for record in list(submission.award_records):
        if record.award_id not in desired_ids:
            db.delete(record)
    for award in awards:
        if award.id not in existing:
            db.add(
                models.SubmissionAward(
                    submission_id=submission.id,
                    award_id=award.id,
                    assigned_by_id=admin.id,
                )
            )
    update_submission_award_text(submission)
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return schemas.AwardedSubmissionResponse(
        id=submission.id,
        sequence_no=submission.sequence_no,
        title=submission.title,
        direction=submission.direction.name if submission.direction else None,
        direction_id=submission.direction_id,
        author=submission.author.name if submission.author else None,
        authors=submission.authors,
        year=submission.year,
        award_tags=compute_award_tags(submission),
        award_badges=[
            schemas.SubmissionAwardTag(name=record.award.name, color=record.award.color if record.award else None)
            for record in submission.award_records
            if record.award
        ],
        reviewer_tags=[_serialize_recommendation(rec) for rec in submission.recommendations],
        my_recommendation=None,
    )
