import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import create_access_token, get_password_hash, verify_password, pwd_context
from ..config import get_settings
from ..dependencies import get_current_user, get_db
from ..utils.user import user_to_response

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger("techday.auth")


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
        student_id=payload.student_id,
        volunteer_tracks=",".join(payload.volunteer_tracks),
        availability_slots=",".join(payload.availability_slots),
        role=models.UserRole.volunteer,
        vote_counter_opt_in=payload.vote_counter_opt_in,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_response(user, db)


@router.post("/login", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        logger.warning("Login failed for email=%s", form_data.username)
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if pwd_context.needs_update(user.password_hash):
        user.password_hash = get_password_hash(form_data.password)
        db.add(user)
        db.commit()
        db.refresh(user)
    logger.info("Login success for user_id=%s email=%s", user.id, user.email)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return schemas.Token(access_token=access_token)


@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_to_response(current_user, db)
