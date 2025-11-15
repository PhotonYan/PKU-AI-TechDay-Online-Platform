from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_password_hash
from ..dependencies import get_db
from ..utils.user import user_to_response

router = APIRouter(prefix="/api/reviewers", tags=["reviewers"])


def _normalize_code(code: str) -> str:
    return code.strip()


@router.get("/invites/{code}")
def get_invite_detail(code: str, db: Session = Depends(get_db)):
    normalized = _normalize_code(code)
    invite = db.query(models.ReviewerInvite).filter(models.ReviewerInvite.code == normalized).first()
    if not invite:
        raise HTTPException(status_code=404, detail="邀请码不存在")
    return {
        "code": invite.code,
        "preset_direction_id": invite.preset_direction_id,
        "preset_direction_name": invite.preset_direction.name if invite.preset_direction else None,
        "is_used": invite.is_used,
    }


@router.post("/register", response_model=schemas.UserResponse)
def register_reviewer(payload: schemas.ReviewerRegisterRequest, db: Session = Depends(get_db)):
    normalized = _normalize_code(payload.invite_code)
    invite = db.query(models.ReviewerInvite).filter(models.ReviewerInvite.code == normalized).first()
    if not invite:
        raise HTTPException(status_code=404, detail="邀请码不存在")
    if invite.is_used:
        raise HTTPException(status_code=400, detail="邀请码已被使用")
    direction_id = invite.preset_direction_id or payload.direction_id
    if not direction_id:
        raise HTTPException(status_code=400, detail="请选择审阅方向")
    direction = db.query(models.Direction).filter(models.Direction.id == direction_id).first()
    if not direction:
        raise HTTPException(status_code=404, detail="方向不存在")
    normalized_email = payload.email.strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=400, detail="邮箱不能为空")
    existing_user = db.query(models.User).filter(models.User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="邮箱已被占用")
    user = models.User(
        email=normalized_email,
        name=payload.name,
        password_hash=get_password_hash(payload.password),
        role=models.UserRole.reviewer,
        reviewer_direction_id=direction.id,
        reviewer_invite_id=invite.id,
    )
    db.add(user)
    db.flush()
    invite.reviewer_name = payload.name
    invite.reviewer_direction_id = direction.id
    invite.reviewer_email = normalized_email
    invite.is_used = True
    db.add(invite)
    db.commit()
    db.refresh(user)
    return user_to_response(user, db)
