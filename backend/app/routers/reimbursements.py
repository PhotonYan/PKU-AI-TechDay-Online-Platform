from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_current_user, get_db, require_admin
from ..utils.files import save_upload_file

router = APIRouter(prefix="/api/reimbursements", tags=["reimbursements"])


@router.get("", response_model=List[schemas.ReimbursementResponse])
def list_reimbursements(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Reimbursement)
    if current_user.role != models.UserRole.admin:
        query = query.filter(models.Reimbursement.applicant_id == current_user.id)
    reimbursements = query.order_by(models.Reimbursement.created_at.desc()).all()
    return [
        schemas.ReimbursementResponse(
            id=item.id,
            project_name=item.project_name,
            organization=item.organization,
            content=item.content,
            quantity=item.quantity,
            amount=item.amount,
            invoice_company=item.invoice_company,
            file_path=item.file_path,
            status=item.status,
            admin_note=item.admin_note,
            applicant_name=item.applicant.name if item.applicant else None,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in reimbursements
    ]


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
    reimbursement = _persist_reimbursement(
        db,
        reimbursement=None,
        applicant_id=current_user.id,
        project_name=project_name,
        organization=organization,
        content=content,
        amount=amount,
        invoice_company=invoice_company,
        quantity=quantity,
        file=file,
    )
    db.add(reimbursement)
    db.commit()
    db.refresh(reimbursement)
    return schemas.ReimbursementResponse(
        id=reimbursement.id,
        project_name=reimbursement.project_name,
        organization=reimbursement.organization,
        content=reimbursement.content,
        quantity=reimbursement.quantity,
        amount=reimbursement.amount,
        invoice_company=reimbursement.invoice_company,
        file_path=reimbursement.file_path,
        status=reimbursement.status,
        admin_note=reimbursement.admin_note,
        applicant_name=current_user.name,
        created_at=reimbursement.created_at,
        updated_at=reimbursement.updated_at,
    )


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
    reimbursement = _persist_reimbursement(
        db,
        reimbursement=reimbursement,
        applicant_id=current_user.id,
        project_name=project_name,
        organization=organization,
        content=content,
        amount=amount,
        invoice_company=invoice_company,
        quantity=quantity,
        file=file,
    )
    db.add(reimbursement)
    db.commit()
    db.refresh(reimbursement)
    return schemas.ReimbursementResponse(
        id=reimbursement.id,
        project_name=reimbursement.project_name,
        organization=reimbursement.organization,
        content=reimbursement.content,
        quantity=reimbursement.quantity,
        amount=reimbursement.amount,
        invoice_company=reimbursement.invoice_company,
        file_path=reimbursement.file_path,
        status=reimbursement.status,
        admin_note=reimbursement.admin_note,
        applicant_name=current_user.name,
        created_at=reimbursement.created_at,
        updated_at=reimbursement.updated_at,
    )


@router.delete("/{reimbursement_id}")
def delete_reimbursement(
    reimbursement_id: int,
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
        raise HTTPException(status_code=400, detail="Approved reimbursements cannot be deleted")
    db.delete(reimbursement)
    db.commit()
    return {"status": "deleted"}


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
    return schemas.ReimbursementResponse(
        id=reimbursement.id,
        project_name=reimbursement.project_name,
        organization=reimbursement.organization,
        content=reimbursement.content,
        quantity=reimbursement.quantity,
        amount=reimbursement.amount,
        invoice_company=reimbursement.invoice_company,
        file_path=reimbursement.file_path,
        status=reimbursement.status,
        admin_note=reimbursement.admin_note,
        applicant_name=reimbursement.applicant.name if reimbursement.applicant else None,
        created_at=reimbursement.created_at,
        updated_at=reimbursement.updated_at,
    )
