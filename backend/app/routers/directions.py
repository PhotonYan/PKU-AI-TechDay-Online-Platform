from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db

router = APIRouter(prefix="/api/directions", tags=["directions"])


@router.get("", response_model=list[schemas.DirectionResponse])
def list_directions(db: Session = Depends(get_db)):
    return db.query(models.Direction).order_by(models.Direction.name).all()
