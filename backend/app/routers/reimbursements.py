import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import get_settings
from ..dependencies import get_current_user, get_db, require_admin
from ..utils.files import save_upload_file

router = APIRouter(prefix="/api/reimbursements", tags=["reimbursements"])
settings = get_settings()
logger = logging.getLogger("techday.reimbursements")

STATUS_LABELS = {
    models.ReimbursementStatus.pending.value: "待审核",
    models.ReimbursementStatus.approved.value: "已通过",
    models.ReimbursementStatus.rejected.value: "已拒绝",
    models.ReimbursementStatus.waiting_more.value: "等待补充材料",
}


def _assigned_organizations(user: models.User) -> list[str]:
    tracks = user.assigned_tracks.split(",") if user.assigned_tracks else []
    if not tracks and user.organization:
        tracks = [user.organization.name]
    return [name for name in tracks if name]


def _csv_escape(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _attachment_url(record: models.Reimbursement) -> Optional[str]:
    if not record.file_path:
        return None
    return f"/api/reimbursements/{record.id}/attachment"


def _resolve_file_path(stored_path: str) -> Path:
    candidate = stored_path.lstrip("/")
    if candidate.startswith("uploads/"):
        candidate = candidate[len("uploads/"):]
    return Path(settings.uploads_dir) / Path(candidate)


def _serialize_reimbursement(record: models.Reimbursement, applicant_name: Optional[str] = None):
    return schemas.ReimbursementResponse(
        id=record.id,
        project_name=record.project_name,
        organization=record.organization,
        content=record.content,
        quantity=record.quantity,
        amount=record.amount,
        invoice_company=record.invoice_company,
        status=record.status,
        admin_note=record.admin_note,
        applicant_name=applicant_name or (record.applicant.name if record.applicant else None),
        created_at=record.created_at,
        updated_at=record.updated_at,
        has_attachment=bool(record.file_path),
        attachment_url=_attachment_url(record),
    )


@router.get("", response_model=List[schemas.ReimbursementResponse])
def list_reimbursements(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Reimbursement)
    if current_user.role != models.UserRole.admin:
        query = query.filter(models.Reimbursement.applicant_id == current_user.id)
    reimbursements = query.order_by(models.Reimbursement.created_at.desc()).all()
    return [_serialize_reimbursement(item) for item in reimbursements]


def _persist_reimbursement(
    db: Session,
    reimbursement: Optional[models.Reimbursement],
    applicant_id: int,
    project_name: str,
    organization: str,
    content: str,
    amount: float,
    invoice_company: str,
    quantity: Optional[int] = None,
    file: Optional[UploadFile] = None,
) -> models.Reimbursement:
    if reimbursement is None:
        reimbursement = models.Reimbursement(applicant_id=applicant_id)
    reimbursement.project_name = project_name
    reimbursement.organization = organization
    reimbursement.content = content
    reimbursement.amount = amount
    reimbursement.invoice_company = invoice_company
    reimbursement.quantity = quantity
    if file:
        reimbursement.file_path = save_upload_file(file, "reimbursements")
    return reimbursement


@router.post("", response_model=schemas.ReimbursementResponse)
def create_reimbursement(
    project_name: str = Form(...),
    organization: str = Form(...),
    content: str = Form(...),
    amount: float = Form(...),
    invoice_company: str = Form(...),
    quantity: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assigned = _assigned_organizations(current_user)
    if assigned and organization not in assigned:
        raise HTTPException(status_code=400, detail="组织不在允许范围内")
    organization_name = (
        organization if assigned else (current_user.organization.name if current_user.organization else "待分配")
    )
    reimbursement = _persist_reimbursement(
        db,
        reimbursement=None,
        applicant_id=current_user.id,
        project_name=project_name,
        organization=organization_name,
        content=content,
        amount=amount,
        invoice_company=invoice_company,
        quantity=quantity,
        file=file,
    )
    db.add(reimbursement)
    db.commit()
    db.refresh(reimbursement)
    return _serialize_reimbursement(reimbursement, applicant_name=current_user.name)


@router.put("/{reimbursement_id}", response_model=schemas.ReimbursementResponse)
def update_reimbursement(
    reimbursement_id: int,
    project_name: str = Form(...),
    organization: str = Form(...),
    content: str = Form(...),
    amount: float = Form(...),
    invoice_company: str = Form(...),
    quantity: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    reimbursement = (
        db.query(models.Reimbursement)
        .filter(models.Reimbursement.id == reimbursement_id, models.Reimbursement.applicant_id == current_user.id)
        .first()
    )
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    if reimbursement.status == models.ReimbursementStatus.approved:
        raise HTTPException(status_code=400, detail="Approved reimbursements cannot be edited")
    assigned = _assigned_organizations(current_user)
    if assigned and organization not in assigned:
        raise HTTPException(status_code=400, detail="组织不在允许范围内")
    organization_name = (
        organization
        if assigned
        else (current_user.organization.name if current_user.organization else reimbursement.organization)
    )
    reimbursement = _persist_reimbursement(
        db,
        reimbursement=reimbursement,
        applicant_id=current_user.id,
        project_name=project_name,
        organization=organization_name,
        content=content,
        amount=amount,
        invoice_company=invoice_company,
        quantity=quantity,
        file=file,
    )
    db.add(reimbursement)
    db.commit()
    db.refresh(reimbursement)
    return _serialize_reimbursement(reimbursement, applicant_name=current_user.name)


@router.delete("/{reimbursement_id}")
def delete_reimbursement(
    reimbursement_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Reimbursement).filter(models.Reimbursement.id == reimbursement_id)
    if current_user.role != models.UserRole.admin:
        query = query.filter(models.Reimbursement.applicant_id == current_user.id)
    reimbursement = query.first()
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    if reimbursement.status == models.ReimbursementStatus.approved:
        raise HTTPException(status_code=400, detail="Approved reimbursements cannot be deleted")
    db.delete(reimbursement)
    db.commit()
    return {"status": "deleted"}


@router.get("/{reimbursement_id}/attachment")
def download_reimbursement_attachment(
    reimbursement_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    reimbursement = db.query(models.Reimbursement).filter(models.Reimbursement.id == reimbursement_id).first()
    if not reimbursement or not reimbursement.file_path:
        raise HTTPException(status_code=404, detail="附件不存在")
    if current_user.role != models.UserRole.admin and reimbursement.applicant_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权下载该附件")
    file_path = _resolve_file_path(reimbursement.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="附件已被删除")

    logger.info("Attachment download: reimbursement_id=%s user_id=%s", reimbursement.id, current_user.id)

    def _iterator():
        with file_path.open("rb") as handle:
            while True:
                chunk = handle.read(8192)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        _iterator(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_path.name}"'},
    )


@router.post("/{reimbursement_id}/review", response_model=schemas.ReimbursementResponse)
def review_reimbursement(
    reimbursement_id: int,
    payload: schemas.ReimbursementReview,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    reimbursement = db.query(models.Reimbursement).filter(models.Reimbursement.id == reimbursement_id).first()
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    reimbursement.status = payload.status
    reimbursement.admin_note = payload.admin_note
    db.add(reimbursement)
    db.commit()
    db.refresh(reimbursement)
    return _serialize_reimbursement(reimbursement)


@router.get("/export/csv")
def export_reimbursements_csv(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    reimbursements = (
        db.query(models.Reimbursement)
        .order_by(models.Reimbursement.created_at.desc())
        .all()
    )
    header = ["项目名称", "组织", "金额", "发票抬头公司", "报销内容", "数量", "状态"]
    lines = [",".join(header)]
    for item in reimbursements:
        status_key = item.status.value if hasattr(item.status, "value") else str(item.status)
        status_text = STATUS_LABELS.get(status_key, status_key)
        row = [
            item.project_name,
            item.organization,
            f"{item.amount}",
            item.invoice_company,
            item.content.replace("\n", " "),
            str(item.quantity or ""),
            status_text,
        ]
        lines.append(",".join(_csv_escape(str(value)) for value in row))
    csv_content = "\n".join(lines)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="reimbursements.csv"'},
    )
