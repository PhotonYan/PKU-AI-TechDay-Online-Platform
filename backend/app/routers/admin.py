from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
def list_users(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    users = db.query(models.User).all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "organization": user.organization.name if user.organization else None,
            "organization_id": user.organization_id,
            "role_template_id": user.role_template_id,
        }
        for user in users
    ]


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
    if payload.organization_id is not None:
        organization = db.query(models.Organization).filter(models.Organization.id == payload.organization_id).first()
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        user.organization_id = payload.organization_id
    if payload.role_template_id is not None:
        template = db.query(models.RoleTemplate).filter(models.RoleTemplate.id == payload.role_template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Role template not found")
        user.role_template_id = payload.role_template_id
    if payload.role:
        user.role = payload.role
    db.add(user)
    db.commit()
    return {"status": "ok"}


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
