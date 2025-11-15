from functools import lru_cache

from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    env: str = Field("production", env="ENV")
    project_name: str = Field("TechDay Platform", env="PROJECT_NAME")
    jwt_secret: str = Field(..., env="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(60 * 24, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    admin_email: str = Field(..., env="ADMIN_EMAIL")
    admin_password: str = Field(..., env="ADMIN_PASSWORD")
    database_url: str = Field(..., env="DATABASE_URL")
    posts_dir: str = Field("/data/posts", env="POSTS_DIR")
    uploads_dir: str = Field("/data/uploads", env="UPLOADS_DIR")
    admin_db_header_secret: str = Field(..., env="ADMIN_DB_HEADER_SECRET")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
