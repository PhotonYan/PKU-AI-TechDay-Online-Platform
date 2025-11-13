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
    track_list = _split_tracks(user.volunteer_tracks)
    org_details = _resolve_orgs(db, track_list)
    organization_name = (
        org_details[0].name if org_details else (user.organization.name if user.organization else None)
    )
    responsibility_text = (
        " ".join(f"{org.name}: {org.responsibility}" for org in org_details)
        if org_details
        else (user.organization.responsibility if user.organization else None)
    )
    organizations_payload = [
        schemas.OrganizationResponse(id=org.id, name=org.name, responsibility=org.responsibility)
        for org in org_details
    ]
    return schemas.UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        college=user.college,
        grade=user.grade,
        student_id=user.student_id,
        volunteer_tracks=track_list or None,
        availability_slots=user.availability_slots.split(",") if user.availability_slots else None,
        role=user.role,
        organization=organization_name,
        responsibility=responsibility_text,
        role_template_id=user.role_template_id,
        vote_counter_opt_in=user.vote_counter_opt_in,
        role_template_can_edit_vote=user.role_template.can_edit_vote_data if user.role_template else False,
        organizations_detail=organizations_payload or None,
    )
