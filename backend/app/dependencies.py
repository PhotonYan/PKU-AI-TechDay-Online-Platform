import logging

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from . import models
from .auth import decode_token
from .database import SessionLocal

logger = logging.getLogger("techday.auth")


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
        user_id = payload.get("sub")
        if user_id is None:
            logger.warning("JWT payload missing 'sub'")
            raise credentials_exception
        user_id = int(user_id)
        logger.debug("Decoded JWT for user_id=%s", user_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to decode JWT: %s", exc)
        raise credentials_exception from exc
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        logger.warning("User not found for user_id=%s from JWT", user_id)
        raise credentials_exception
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


def require_author(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.author:
        raise HTTPException(status_code=403, detail="Author privileges required")
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[models.User]:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError:
        return None
    if scheme.lower() != "bearer":
        return None
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            return None
        user_id = int(user_id)
    except Exception:  # noqa: BLE001
        return None
    user = db.query(models.User).filter(models.User.id == user_id).first()
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


def require_reviewer(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.reviewer:
        raise HTTPException(status_code=403, detail="Reviewer privileges required")
    if not user.reviewer_direction_id:
        raise HTTPException(status_code=400, detail="未设置审阅方向")
    return user


def require_admin_or_reviewer(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role not in {models.UserRole.admin, models.UserRole.reviewer}:
        raise HTTPException(status_code=403, detail="需要管理员或审阅者权限")
    if user.role == models.UserRole.reviewer and not user.reviewer_direction_id:
        raise HTTPException(status_code=400, detail="未设置审阅方向")
    return user


def require_news_publisher(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role == models.UserRole.admin or getattr(user, "can_publish_news", False):
        return user
    raise HTTPException(status_code=403, detail="需要新闻发布权限")
