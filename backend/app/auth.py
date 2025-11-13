import logging
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

from .config import get_settings

logger = logging.getLogger("techday.auth")

_schemes = ["pbkdf2_sha256"]
try:
    import bcrypt  # type: ignore

    if not hasattr(bcrypt, "__about__"):
        class _About:  # pragma: no cover - patch for old bcrypt builds
            __version__ = getattr(bcrypt, "__version__", "unknown")

        bcrypt.__about__ = _About()
    _schemes.append("bcrypt")
except ImportError:  # pragma: no cover
    bcrypt = None
    logger.warning("bcrypt module not available; legacy $2b$ hashes cannot be verified")

pwd_context = CryptContext(schemes=_schemes, deprecated="auto")
settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except UnknownHashError:
        logger.error("Unknown password hash format")
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
