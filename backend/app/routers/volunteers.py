from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_password_hash
from ..dependencies import get_current_user, get_db

router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


@router.post("/register", response_model=schemas.UserResponse)
def register_volunteer(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=payload.email,
        name=payload.name,
        password_hash=get_password_hash(payload.password),
        college=payload.college,
        grade=payload.grade,
        volunteer_tracks=",".join(payload.volunteer_tracks),
        availability_slots=",".join(payload.availability_slots),
        role=models.UserRole.volunteer,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        college=user.college,
        grade=user.grade,
        volunteer_tracks=user.volunteer_tracks.split(",") if user.volunteer_tracks else None,
        availability_slots=user.availability_slots.split(",") if user.availability_slots else None,
        role=user.role,
        organization=user.organization.name if user.organization else None,
        responsibility=user.organization.responsibility if user.organization else None,
        role_template_id=user.role_template_id,
    )


@router.get("/me", response_model=schemas.UserResponse)
def get_personal_info(current_user: models.User = Depends(get_current_user)):
    return schemas.UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        college=current_user.college,
        grade=current_user.grade,
        volunteer_tracks=current_user.volunteer_tracks.split(",") if current_user.volunteer_tracks else None,
        availability_slots=current_user.availability_slots.split(",") if current_user.availability_slots else None,
        role=current_user.role,
        organization=current_user.organization.name if current_user.organization else None,
        responsibility=current_user.organization.responsibility if current_user.organization else None,
        role_template_id=current_user.role_template_id,
    )
