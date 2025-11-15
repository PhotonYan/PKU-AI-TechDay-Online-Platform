import os
import uuid
from pathlib import Path

from fastapi import UploadFile

from ..config import get_settings

settings = get_settings()


def ensure_upload_dir() -> None:
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)


def save_upload_file(file: UploadFile, subfolder: str = "") -> str:
    ensure_upload_dir()
    base = Path(settings.uploads_dir)
    folder = base / subfolder if subfolder else base
    folder.mkdir(parents=True, exist_ok=True)
    extension = Path(file.filename or "").suffix
    unique_name = f"{uuid.uuid4().hex}{extension}"
    file_path = folder / unique_name
    with file_path.open("wb") as buffer:
        buffer.write(file.file.read())
    relative = file_path.relative_to(base)
    return relative.as_posix()
