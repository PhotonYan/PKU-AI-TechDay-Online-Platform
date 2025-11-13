from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import create_access_token, get_password_hash, verify_password
from ..config import get_settings
from ..dependencies import get_current_user, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=schemas.UserResponse)
def register_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
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
    return user


@router.post("/login", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return schemas.Token(access_token=access_token)


@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    organization_name = current_user.organization.name if current_user.organization else None
    responsibility = current_user.organization.responsibility if current_user.organization else None
    return schemas.UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        college=current_user.college,
        grade=current_user.grade,
        volunteer_tracks=current_user.volunteer_tracks.split(",") if current_user.volunteer_tracks else None,
        availability_slots=current_user.availability_slots.split(",") if current_user.availability_slots else None,
        role=current_user.role,
        organization=organization_name,
        responsibility=responsibility,
        role_template_id=current_user.role_template_id,
    )
