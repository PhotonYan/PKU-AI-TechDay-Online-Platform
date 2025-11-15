from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from .config import get_settings
from .database import Base, engine, SessionLocal
from .auth import get_password_hash
from . import models
from .routers import auth, reimbursements, volunteers, admin, authors, submissions, directions

settings = get_settings()
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(volunteers.router)
app.include_router(authors.router)
app.include_router(reimbursements.router)
app.include_router(submissions.router)
app.include_router(directions.router)
app.include_router(admin.router)

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


def ensure_column(db, table: str, column: str, column_def: str):
    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns(table)}
    if column in columns:
        return
    db.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {column_def}"))
    db.commit()


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        dialect = engine.dialect.name
        bool_def = "BOOLEAN DEFAULT 0" if dialect == "sqlite" else "BOOLEAN DEFAULT FALSE"
        ensure_column(db, "users", "vote_counter_opt_in", bool_def)
        ensure_column(db, "users", "student_id", "VARCHAR")
        ensure_column(db, "users", "assigned_tracks", "VARCHAR")
        ensure_column(db, "users", "school", "VARCHAR")
        ensure_column(db, "submissions", "sequence_no", "INTEGER")
        admin_user = db.query(models.User).filter(models.User.email == settings.admin_email).first()
        if not admin_user:
            admin_user = models.User(
                email=settings.admin_email,
                name="Super Admin",
                password_hash=get_password_hash(settings.admin_password),
                role=models.UserRole.admin,
            )
            db.add(admin_user)
            db.commit()
        else:
            admin_user.password_hash = get_password_hash(settings.admin_password)
            db.add(admin_user)
            db.commit()
        if not db.query(models.SiteSettings).first():
            setting = models.SiteSettings(show_vote_data=False, vote_sort_enabled=False)
            db.add(setting)
            db.commit()
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "ok"}
