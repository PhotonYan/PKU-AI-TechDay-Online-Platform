from __future__ import annotations

from typing import List

from sqlalchemy.orm import Session

from .. import models, schemas


def _split_tracks(value: str | None) -> List[str]:
    if not value:
        return []
    return [item for item in value.split(",") if item]


def _resolve_orgs(db: Session, track_names: List[str]) -> List[models.Organization]:
    if not track_names:
        return []
    rows = db.query(models.Organization).filter(models.Organization.name.in_(track_names)).all()
    mapping = {row.name: row for row in rows}
    ordered = [mapping[name] for name in track_names if name in mapping]
    return ordered


def user_to_response(user: models.User, db: Session) -> schemas.UserResponse:
    reviewer_direction_name: str | None = None
    if user.role == models.UserRole.author:
        preference_list: list[str] | None = None
        assigned_list: list[str] | None = None
        org_details: list[models.Organization] = []
        organization_name: str | None = None
        responsibility_text: str | None = None
        organizations_payload: list[schemas.OrganizationResponse] | None = None
    elif user.role == models.UserRole.reviewer:
        preference_list = None
        assigned_list = None
        org_details = []
        reviewer_direction_name = user.reviewer_direction.name if user.reviewer_direction else None
        organization_name = reviewer_direction_name
        responsibility_text = f"审阅方向：{reviewer_direction_name}" if reviewer_direction_name else "未设置审阅方向"
        organizations_payload = None
    else:
        preference_list = _split_tracks(user.volunteer_tracks)
        assigned_list = _split_tracks(user.assigned_tracks)
        org_details = _resolve_orgs(db, assigned_list)
        if not org_details and user.organization:
            org_details = [user.organization]
        organization_name = org_details[0].name if org_details else "待分配"
        responsibility_text = (
            " ".join(f"{org.name}: {org.responsibility}" for org in org_details) if org_details else "由管理员分配"
        )
        organizations_payload = [
            schemas.OrganizationResponse(id=org.id, name=org.name, responsibility=org.responsibility)
            for org in org_details
        ] or None
    return schemas.UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        school=user.school,
        college=user.college,
        grade=user.grade,
        student_id=user.student_id,
        volunteer_tracks=preference_list or None,
        assigned_tracks=assigned_list or None,
        availability_slots=(user.availability_slots.split(",") if user.availability_slots else None)
        if user.role not in {models.UserRole.author, models.UserRole.reviewer}
        else None,
        role=user.role,
        organization=organization_name,
        responsibility=responsibility_text,
        role_template_id=user.role_template_id,
        vote_counter_opt_in=user.vote_counter_opt_in,
        role_template_can_edit_vote=user.role_template.can_edit_vote_data if user.role_template else False,
        organizations_detail=organizations_payload,
        reviewer_direction_id=user.reviewer_direction_id,
        reviewer_direction_name=reviewer_direction_name,
        can_publish_news=getattr(user, "can_publish_news", False),
    )
