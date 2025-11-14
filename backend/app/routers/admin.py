from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
def list_users(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    users = db.query(models.User).all()
    result = []
    for user in users:
        tracks = user.volunteer_tracks.split(",") if user.volunteer_tracks else []
        assigned_tracks = user.assigned_tracks.split(",") if user.assigned_tracks else []
        result.append(
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "organization": user.organization.name if user.organization else None,
                "organization_id": user.organization_id,
                "role_template_id": user.role_template_id,
                "vote_counter_opt_in": user.vote_counter_opt_in,
                "volunteer_tracks": tracks,
                "assigned_tracks": assigned_tracks,
            }
        )
    return result


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    payload_data = payload.dict(exclude_unset=True)
    if "organization_id" in payload_data:
        if payload.organization_id is None:
            user.organization_id = None
        else:
            organization = (
                db.query(models.Organization).filter(models.Organization.id == payload.organization_id).first()
            )
            if not organization:
                raise HTTPException(status_code=404, detail="Organization not found")
            user.organization_id = payload.organization_id
    if "assigned_tracks" in payload_data:
        assigned_list = payload.assigned_tracks or []
        user.assigned_tracks = ",".join(assigned_list)
        if assigned_list:
            first_org = (
                db.query(models.Organization).filter(models.Organization.name == assigned_list[0]).first()
            )
            user.organization_id = first_org.id if first_org else None
        else:
            user.organization_id = None
    if "role_template_id" in payload_data:
        if payload.role_template_id is None:
            user.role_template_id = None
        else:
            template = db.query(models.RoleTemplate).filter(models.RoleTemplate.id == payload.role_template_id).first()
            if not template:
                raise HTTPException(status_code=404, detail="Role template not found")
            user.role_template_id = payload.role_template_id
    if "role" in payload_data and payload.role:
        if user.id == admin.id and payload.role != models.UserRole.admin:
            raise HTTPException(status_code=400, detail="Cannot change your own admin role")
        user.role = payload.role
    if "vote_counter_opt_in" in payload_data:
        user.vote_counter_opt_in = bool(payload.vote_counter_opt_in)
    db.add(user)
    db.commit()
    return {"status": "ok"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}


@router.get("/users/export")
def export_users(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    users = db.query(models.User).all()
    lines = [
        "id,email,name,role,student_id,volunteer_tracks,assigned_tracks,role_template_id,vote_counter_opt_in,availability_slots"
    ]
    for user in users:
        tracks = user.volunteer_tracks or ""
        assigned = user.assigned_tracks or ""
        lines.append(
            f'{user.id},"{user.email}","{user.name}",{user.role.value},"{user.student_id or ""}",'
            f'"{tracks}","{assigned}",{user.role_template_id or ""},{int(bool(user.vote_counter_opt_in))},"{user.availability_slots or ""}"'
        )
    csv_content = "\n".join(lines)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="users.csv"'},
    )


@router.post("/submissions/clear")
def clear_submissions(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    db.query(models.SubmissionVoteLog).delete()
    db.query(models.Submission).delete()
    db.commit()
    return {"status": "cleared"}


@router.get("/organizations", response_model=List[schemas.OrganizationResponse])
def list_orgs(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    return db.query(models.Organization).all()


@router.post("/organizations", response_model=schemas.OrganizationResponse)
def create_org(
    payload: schemas.OrganizationCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    organization = models.Organization(name=payload.name, responsibility=payload.responsibility)
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


@router.put("/organizations/{org_id}", response_model=schemas.OrganizationResponse)
def update_org(
    org_id: int,
    payload: schemas.OrganizationUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    organization = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")
    if payload.name is not None:
        organization.name = payload.name
    if payload.responsibility is not None:
        organization.responsibility = payload.responsibility
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


@router.get("/directions", response_model=List[schemas.DirectionResponse])
def list_directions(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    return db.query(models.Direction).order_by(models.Direction.name).all()


@router.post("/directions", response_model=schemas.DirectionResponse)
def create_direction(
    payload: schemas.DirectionCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    direction = models.Direction(name=payload.name, description=payload.description)
    db.add(direction)
    db.commit()
    db.refresh(direction)
    return direction


@router.put("/directions/{direction_id}", response_model=schemas.DirectionResponse)
def update_direction(
    direction_id: int,
    payload: schemas.DirectionUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    direction = db.query(models.Direction).filter(models.Direction.id == direction_id).first()
    if not direction:
        raise HTTPException(status_code=404, detail="Direction not found")
    if payload.name is not None:
        direction.name = payload.name
    if payload.description is not None:
        direction.description = payload.description
    db.add(direction)
    db.commit()
    db.refresh(direction)
    return direction


@router.delete("/directions/{direction_id}")
def delete_direction(
    direction_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    direction = db.query(models.Direction).filter(models.Direction.id == direction_id).first()
    if not direction:
        raise HTTPException(status_code=404, detail="Direction not found")
    has_submissions = (
        db.query(models.Submission).filter(models.Submission.direction_id == direction_id).first() is not None
    )
    if has_submissions:
        raise HTTPException(status_code=400, detail="方向下仍有投稿，无法删除")
    db.delete(direction)
    db.commit()
    return {"status": "deleted"}


@router.get("/roles", response_model=List[schemas.RoleTemplateResponse])
def list_roles(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    return db.query(models.RoleTemplate).all()


@router.post("/roles", response_model=schemas.RoleTemplateResponse)
def create_role(
    payload: schemas.RoleTemplateCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    template = models.RoleTemplate(name=payload.name, can_edit_vote_data=payload.can_edit_vote_data)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/settings/votes", response_model=schemas.VoteSettings)
def get_vote_settings(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    settings = db.query(models.SiteSettings).first()
    if not settings:
        settings = models.SiteSettings(show_vote_data=False, vote_sort_enabled=False)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return schemas.VoteSettings(
        show_vote_data=settings.show_vote_data,
        vote_sort_enabled=settings.vote_sort_enabled,
        vote_edit_role_template_id=settings.vote_edit_role_template_id,
    )


@router.put("/settings/votes", response_model=schemas.VoteSettings)
def update_vote_settings(
    payload: schemas.VoteSettings,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    settings_row = db.query(models.SiteSettings).first()
    if not settings_row:
        settings_row = models.SiteSettings()
    settings_row.show_vote_data = payload.show_vote_data
    settings_row.vote_sort_enabled = payload.vote_sort_enabled
    settings_row.vote_edit_role_template_id = payload.vote_edit_role_template_id
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return payload


@router.get("/submissions")
def admin_list_submissions(
    track: Optional[models.SubmissionTrack] = None,
    status: Optional[models.SubmissionReviewStatus] = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    query = db.query(models.Submission)
    if track:
        query = query.filter(models.Submission.track == track)
    if status:
        query = query.filter(models.Submission.review_status == status)
    rows = query.order_by(models.Submission.created_at.desc()).all()
    data = []
    for submission in rows:
        data.append(
            {
                "id": submission.id,
                "title": submission.title,
                "direction": submission.direction.name if submission.direction else None,
                "direction_id": submission.direction_id,
                "author": submission.author.name if submission.author else None,
                "venue": submission.venue,
                "status": submission.review_status.value,
                "track": submission.track.value,
                "publication_status": submission.publication_status.value,
                "award": submission.award,
            }
        )
    return data


@router.patch("/submissions/{submission_id}")
def admin_update_submission(
    submission_id: int,
    payload: schemas.SubmissionAdminUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    payload_data = payload.dict(exclude_unset=True)
    if "direction_id" in payload_data:
        if payload.direction_id is None:
            submission.direction_id = None
        else:
            direction = db.query(models.Direction).filter(models.Direction.id == payload.direction_id).first()
            if not direction:
                raise HTTPException(status_code=404, detail="Direction not found")
            submission.direction_id = payload.direction_id
    if "review_status" in payload_data:
        submission.review_status = payload.review_status
    if "award" in payload_data:
        submission.award = payload.award
    if "track" in payload_data and payload.track is not None:
        submission.track = payload.track
    if "publication_status" in payload_data and payload.publication_status is not None:
        submission.publication_status = payload.publication_status
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return {
        "id": submission.id,
        "status": submission.review_status.value,
        "award": submission.award,
        "track": submission.track.value,
    }


@router.delete("/submissions/{submission_id}")
def admin_delete_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    db.delete(submission)
    db.commit()
    return {"status": "deleted"}
