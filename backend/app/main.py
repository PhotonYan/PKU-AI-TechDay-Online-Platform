from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import Base, engine, SessionLocal
from .auth import get_password_hash
from . import models
from .routers import auth, reimbursements, papers, volunteers, admin

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
app.include_router(reimbursements.router)
app.include_router(papers.router)
app.include_router(admin.router)

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin_user = db.query(models.User).filter(models.User.email == settings.admin_email).first()
        if not admin_user:
            user = models.User(
                email=settings.admin_email,
                name="Super Admin",
                password_hash=get_password_hash(settings.admin_password),
                role=models.UserRole.admin,
            )
            db.add(user)
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
