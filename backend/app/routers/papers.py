import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import get_settings
from ..dependencies import get_db, require_admin, require_vote_editor

router = APIRouter(prefix="/api/papers", tags=["papers"])
settings = get_settings()


@router.get("")
def list_papers(
    sort: Optional[str] = None,
    db: Session = Depends(get_db),
):
    settings_row = db.query(models.SiteSettings).first()
    show_votes = settings_row.show_vote_data if settings_row else False
    sort_enabled = settings_row.vote_sort_enabled if settings_row else False
    query = db.query(models.Paper)
    if show_votes and sort_enabled and sort in {"vote_innovation", "vote_impact", "vote_feasibility"}:
        query = query.order_by(getattr(models.Paper, sort).desc())
    papers = query.all()
    data = []
    for paper in papers:
        item = {
            "id": paper.id,
            "title": paper.title,
            "author": paper.author,
            "direction": paper.direction,
        }
        if show_votes:
            item.update(
                {
                    "vote_innovation": paper.vote_innovation,
                    "vote_impact": paper.vote_impact,
                    "vote_feasibility": paper.vote_feasibility,
                }
            )
        data.append(item)
    return {"showVotes": show_votes, "canSort": sort_enabled and show_votes, "papers": data}


@router.get("/{paper_id}")
def get_paper(paper_id: int, db: Session = Depends(get_db)):
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    settings_row = db.query(models.SiteSettings).first()
    show_votes = settings_row.show_vote_data if settings_row else False
    payload = {
        "id": paper.id,
        "title": paper.title,
        "author": paper.author,
        "abstract": paper.abstract,
        "direction": paper.direction,
        "contact": paper.contact,
        "venue": paper.venue,
        "showVotes": show_votes,
    }
    if show_votes:
        payload.update(
            {
                "vote_innovation": paper.vote_innovation,
                "vote_impact": paper.vote_impact,
                "vote_feasibility": paper.vote_feasibility,
            }
        )
    return payload


@router.post("/import")
def import_papers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    content = file.file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    required_fields = {"Title", "Author", "Abstract", "期刊/会议", "方向", "作者联系方式"}
    if not required_fields.issubset(reader.fieldnames or {}):
        raise HTTPException(status_code=400, detail="CSV headers missing")
    created_count = 0
    for row in reader:
        paper = models.Paper(
            title=row["Title"],
            author=row["Author"],
            abstract=row["Abstract"],
            venue=row["期刊/会议"],
            direction=row["方向"],
            contact=row["作者联系方式"],
            created_by=admin.id,
        )
        db.add(paper)
        created_count += 1
    db.commit()
    return {"status": "ok", "created": created_count}


@router.patch("/{paper_id}/votes")
def update_votes(
    paper_id: int,
    payload: schemas.PaperVoteUpdate,
    db: Session = Depends(get_db),
    editor: models.User = Depends(require_vote_editor),
):
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    allowed_fields = ["vote_innovation", "vote_impact", "vote_feasibility"]
    changes = {}
    payload_data = payload.dict(exclude_none=True)
    for field in allowed_fields:
        if field in payload_data:
            old_value = getattr(paper, field)
            new_value = float(payload_data[field])
            setattr(paper, field, new_value)
            log = models.PaperVoteLog(
                paper_id=paper.id,
                user_id=editor.id,
                field_name=field,
                old_value=old_value,
                new_value=new_value,
            )
            db.add(log)
            changes[field] = new_value
    db.add(paper)
    db.commit()
    return {"status": "ok", "changes": changes}
