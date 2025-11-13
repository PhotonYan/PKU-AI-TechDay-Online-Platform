from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from . import models
from .auth import decode_token
from .database import SessionLocal


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
    )
    try:
        payload = decode_token(token)
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except Exception as exc:  # noqa: BLE001
        raise credentials_exception from exc
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


def require_vote_editor(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.User:
    if user.role == models.UserRole.admin:
        return user
    template = user.role_template
    if not template or not template.can_edit_vote_data:
        raise HTTPException(status_code=403, detail="Vote edit privilege required")
    settings = db.query(models.SiteSettings).first()
    allowed_template_id = settings.vote_edit_role_template_id if settings else None
    if allowed_template_id and user.role_template_id != allowed_template_id:
        raise HTTPException(status_code=403, detail="Template not allowed to edit votes")
    return user
