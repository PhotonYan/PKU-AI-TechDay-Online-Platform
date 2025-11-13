from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_password_hash
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
