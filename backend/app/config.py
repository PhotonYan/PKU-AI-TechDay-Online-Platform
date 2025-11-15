import os
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

class Settings:
    project_name: str = "TechDay Platform"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./techday.db")
    jwt_secret: str = os.getenv("JWT_SECRET", "supersecretjwt")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    upload_dir: str = os.getenv("UPLOAD_DIR", "uploads")
    admin_email: str = os.getenv("ADMIN_EMAIL", "admin@techday.local")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "AdminPass123")
    database_admin_password: str = os.getenv("DATABASE_ADMIN_PASSWORD", "admindatabase")
    posts_dir: str = os.getenv("POSTS_DIR", str(BASE_DIR / "client" / "src" / "assets" / "posts"))

@lru_cache
def get_settings() -> Settings:
    return Settings()
