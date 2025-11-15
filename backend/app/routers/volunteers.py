from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_password_hash, verify_password
from ..dependencies import get_current_user, get_db
from ..utils.user import user_to_response

router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


@router.get("/organizations", response_model=list[schemas.OrganizationResponse])
def list_organizations(db: Session = Depends(get_db)):
    return db.query(models.Organization).all()


@router.post("/register", response_model=schemas.UserResponse)
def register_volunteer(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=payload.email,
        name=payload.name,
        password_hash=get_password_hash(payload.password),
        school=payload.school,
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


@router.get("/me", response_model=schemas.UserResponse)
def get_personal_info(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_to_response(current_user, db)


@router.post("/me/password")
def update_password(
    payload: schemas.PasswordChangeRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="旧密码不正确")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="新密码不能与旧密码相同")
    current_user.password_hash = get_password_hash(payload.new_password)
    db.add(current_user)
    db.commit()
    return {"message": "密码修改成功"}
