from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
def list_users(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    users = db.query(models.User).all()
    result = []
    for user in users:
        tracks = user.volunteer_tracks.split(",") if user.volunteer_tracks else []
        result.append(
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "organization": user.organization.name if user.organization else None,
                "organization_id": user.organization_id,
                "role_template_id": user.role_template_id,
                "vote_counter_opt_in": user.vote_counter_opt_in,
                "volunteer_tracks": tracks,
            }
        )
    return result


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    payload_data = payload.dict(exclude_unset=True)
    if "organization_id" in payload_data:
        if payload.organization_id is None:
            user.organization_id = None
        else:
            organization = (
                db.query(models.Organization).filter(models.Organization.id == payload.organization_id).first()
            )
            if not organization:
                raise HTTPException(status_code=404, detail="Organization not found")
            user.organization_id = payload.organization_id
    if "volunteer_tracks" in payload_data:
        track_list = payload.volunteer_tracks or []
        user.volunteer_tracks = ",".join(track_list)
        if track_list:
            first_org = (
                db.query(models.Organization).filter(models.Organization.name == track_list[0]).first()
            )
            user.organization_id = first_org.id if first_org else None
        else:
            user.organization_id = None
    if "role_template_id" in payload_data:
        if payload.role_template_id is None:
            user.role_template_id = None
        else:
            template = db.query(models.RoleTemplate).filter(models.RoleTemplate.id == payload.role_template_id).first()
            if not template:
                raise HTTPException(status_code=404, detail="Role template not found")
            user.role_template_id = payload.role_template_id
    if "role" in payload_data and payload.role:
        if user.id == admin.id and payload.role != models.UserRole.admin:
            raise HTTPException(status_code=400, detail="Cannot change your own admin role")
        user.role = payload.role
    if "vote_counter_opt_in" in payload_data:
        user.vote_counter_opt_in = bool(payload.vote_counter_opt_in)
    db.add(user)
    db.commit()
    return {"status": "ok"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}


@router.get("/users/export")
def export_users(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    users = db.query(models.User).all()
    lines = [
        "id,email,name,role,student_id,volunteer_tracks,role_template_id,vote_counter_opt_in,availability_slots"
    ]
    for user in users:
        tracks = user.volunteer_tracks or ""
        lines.append(
            f'{user.id},"{user.email}","{user.name}",{user.role.value},"{user.student_id or ""}",'
            f'"{tracks}",{user.role_template_id or ""},{int(bool(user.vote_counter_opt_in))},"{user.availability_slots or ""}"'
        )
    csv_content = "\n".join(lines)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="users.csv"'},
    )


@router.get("/organizations", response_model=List[schemas.OrganizationResponse])
def list_orgs(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    return db.query(models.Organization).all()


@router.post("/organizations", response_model=schemas.OrganizationResponse)
def create_org(
    payload: schemas.OrganizationCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    organization = models.Organization(name=payload.name, responsibility=payload.responsibility)
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


@router.put("/organizations/{org_id}", response_model=schemas.OrganizationResponse)
def update_org(
    org_id: int,
    payload: schemas.OrganizationUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    organization = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")
    if payload.name is not None:
        organization.name = payload.name
    if payload.responsibility is not None:
        organization.responsibility = payload.responsibility
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


@router.get("/roles", response_model=List[schemas.RoleTemplateResponse])
def list_roles(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    return db.query(models.RoleTemplate).all()


@router.post("/roles", response_model=schemas.RoleTemplateResponse)
def create_role(
    payload: schemas.RoleTemplateCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    template = models.RoleTemplate(name=payload.name, can_edit_vote_data=payload.can_edit_vote_data)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/settings/votes", response_model=schemas.VoteSettings)
def get_vote_settings(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    settings = db.query(models.SiteSettings).first()
    if not settings:
        settings = models.SiteSettings(show_vote_data=False, vote_sort_enabled=False)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return schemas.VoteSettings(
        show_vote_data=settings.show_vote_data,
        vote_sort_enabled=settings.vote_sort_enabled,
        vote_edit_role_template_id=settings.vote_edit_role_template_id,
    )


@router.put("/settings/votes", response_model=schemas.VoteSettings)
def update_vote_settings(
    payload: schemas.VoteSettings,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    settings_row = db.query(models.SiteSettings).first()
    if not settings_row:
        settings_row = models.SiteSettings()
    settings_row.show_vote_data = payload.show_vote_data
    settings_row.vote_sort_enabled = payload.vote_sort_enabled
    settings_row.vote_edit_role_template_id = payload.vote_edit_role_template_id
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return payload
