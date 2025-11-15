import csv
import io
import secrets
import string
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, Header, UploadFile, File, Form
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import get_settings
from ..dependencies import get_db, require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])
settings = get_settings()


def require_database_password_header(
    password: str = Header(..., alias="X-Database-Password"),
) -> str:
    if password != settings.database_admin_password:
        raise HTTPException(status_code=403, detail="数据库密码错误")
    return password


@router.get("/users")
def list_users(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    users = db.query(models.User).all()
    result = []
    for user in users:
        if user.role == models.UserRole.reviewer:
            continue
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
                "can_publish_news": bool(getattr(user, "can_publish_news", False)),
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
    if "can_publish_news" in payload_data:
        user.can_publish_news = bool(payload.can_publish_news)
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
    visible_ids = (
        [int(value) for value in settings.visible_award_ids.split(",") if value]
        if settings.visible_award_ids
        else None
    )
    return schemas.VoteSettings(
        show_vote_data=settings.show_vote_data,
        vote_sort_enabled=settings.vote_sort_enabled,
        vote_edit_role_template_id=settings.vote_edit_role_template_id,
        visible_award_ids=visible_ids,
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
    if payload.visible_award_ids:
        settings_row.visible_award_ids = ",".join(str(item) for item in payload.visible_award_ids)
    else:
        settings_row.visible_award_ids = None
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return payload


@router.get("/submissions")
def admin_list_submissions(
    track: Optional[models.SubmissionTrack] = None,
    status: Optional[models.SubmissionReviewStatus] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    query = db.query(models.Submission)
    if track:
        query = query.filter(models.Submission.track == track)
    if status:
        query = query.filter(models.Submission.review_status == status)
    if year:
        query = query.filter(models.Submission.year == year)
    rows = query.order_by(models.Submission.created_at.desc()).all()
    data = []
    for submission in rows:
        data.append(
            {
                "id": submission.id,
                "title": submission.title,
                "sequence_no": submission.sequence_no,
                "direction": submission.direction.name if submission.direction else None,
                "direction_id": submission.direction_id,
                "author": submission.author.name if submission.author else None,
                "authors": submission.authors,
                "venue": submission.venue,
                "status": submission.review_status.value,
                "track": submission.track.value,
                "publication_status": submission.publication_status.value,
                "award": submission.award,
                "year": submission.year,
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
        if submission.review_status != models.SubmissionReviewStatus.approved:
            submission.sequence_no = None
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


@router.post("/submissions/renumber")
def admin_renumber_submissions(
    track: models.SubmissionTrack,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    approved = (
        db.query(models.Submission)
        .filter(models.Submission.track == track)
        .filter(models.Submission.review_status == models.SubmissionReviewStatus.approved)
        .order_by(models.Submission.created_at.asc())
        .all()
    )
    for idx, submission in enumerate(approved, start=1):
        submission.sequence_no = idx
        db.add(submission)
    db.commit()
    return {"status": "ok", "renumbered": len(approved)}


@router.post("/database/login")
def database_admin_login(
    payload: schemas.DatabaseLoginRequest,
    admin: models.User = Depends(require_admin),
):
    if payload.password != settings.database_admin_password:
        raise HTTPException(status_code=403, detail="数据库密码错误")
    return {"status": "ok"}


@router.get("/database/tables")
def list_database_tables(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
    _password: str = Depends(require_database_password_header),
):
    tables = _fetch_table_names(db)
    return {"tables": tables}


@router.get("/database/tables/{table_name}")
def get_database_table(
    table_name: str,
    limit: int = 200,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
    _password: str = Depends(require_database_password_header),
):
    if limit <= 0:
        limit = 200
    _ensure_table_exists(db, table_name)
    safe_name = _sanitize_table_name(table_name)
    columns = _get_table_columns(db, safe_name)
    rows = db.execute(text(f'SELECT * FROM "{safe_name}" LIMIT :limit'), {"limit": limit}).mappings().all()
    primary_key = next((col["name"] for col in columns if col["pk"]), None)
    return {
        "columns": columns,
        "rows": [dict(row) for row in rows],
        "primary_key": primary_key,
    }


@router.put("/database/tables/{table_name}/rows/{pk_value}")
def update_database_row(
    table_name: str,
    pk_value: str,
    payload: schemas.DatabaseRowUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
    _password: str = Depends(require_database_password_header),
):
    _ensure_table_exists(db, table_name)
    safe_name = _sanitize_table_name(table_name)
    columns = _get_table_columns(db, safe_name)
    pk_columns = [col for col in columns if col["pk"]]
    if len(pk_columns) != 1:
        raise HTTPException(status_code=400, detail="该表没有可识别的单一主键，暂不支持编辑")
    if not payload.data:
        raise HTTPException(status_code=400, detail="缺少更新内容")
    valid_columns = {col["name"] for col in columns}
    invalid_fields = [field for field in payload.data if field not in valid_columns]
    if invalid_fields:
        raise HTTPException(status_code=400, detail=f"未知字段: {', '.join(invalid_fields)}")
    set_clause = ", ".join(f'"{column}" = :{column}' for column in payload.data.keys())
    query = text(f'UPDATE "{safe_name}" SET {set_clause} WHERE "{pk_columns[0]["name"]}" = :_pk_value')
    params = {**payload.data, "_pk_value": pk_value}
    result = db.execute(query, params)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="记录不存在或未修改")
    db.commit()
    return {"status": "updated"}


@router.post("/database/tables/{table_name}/rows")
def create_database_row(
    table_name: str,
    payload: schemas.DatabaseRowUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
    _password: str = Depends(require_database_password_header),
):
    _ensure_table_exists(db, table_name)
    safe_name = _sanitize_table_name(table_name)
    columns = _get_table_columns(db, safe_name)
    if not payload.data:
        raise HTTPException(status_code=400, detail="缺少创建内容")
    valid_columns = {col["name"] for col in columns}
    invalid_fields = [field for field in payload.data if field not in valid_columns]
    if invalid_fields:
        raise HTTPException(status_code=400, detail=f"未知字段: {', '.join(invalid_fields)}")
    column_names = list(payload.data.keys())
    placeholders = ", ".join(f":{column}" for column in column_names)
    columns_clause = ", ".join(f'"{column}"' for column in column_names)
    query = text(f'INSERT INTO "{safe_name}" ({columns_clause}) VALUES ({placeholders})')
    db.execute(query, payload.data)
    db.commit()
    return {"status": "created"}


@router.delete("/database/tables/{table_name}/rows/{pk_value}")
def delete_database_row(
    table_name: str,
    pk_value: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
    _password: str = Depends(require_database_password_header),
):
    _ensure_table_exists(db, table_name)
    safe_name = _sanitize_table_name(table_name)
    columns = _get_table_columns(db, safe_name)
    pk_columns = [col for col in columns if col["pk"]]
    if len(pk_columns) != 1:
        raise HTTPException(status_code=400, detail="该表没有可识别的单一主键，暂不支持删除")
    query = text(f'DELETE FROM "{safe_name}" WHERE "{pk_columns[0]["name"]}" = :_pk_value')
    result = db.execute(query, {"_pk_value": pk_value})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="记录不存在")
    db.commit()
    return {"status": "deleted"}


@router.delete("/database/tables/{table_name}")
def delete_database_table(
    table_name: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
    _password: str = Depends(require_database_password_header),
):
    _ensure_table_exists(db, table_name)
    safe_name = _sanitize_table_name(table_name)
    db.execute(text(f'DROP TABLE "{safe_name}"'))
    db.commit()
    return {"status": "deleted"}


@router.post("/database/tables/{table_name}/import")
def import_database_table(
    table_name: str,
    mode: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
    _password: str = Depends(require_database_password_header),
):
    mode = mode.lower()
    if mode not in {"overwrite", "append"}:
        raise HTTPException(status_code=400, detail="未知导入模式")
    _ensure_table_exists(db, table_name)
    safe_name = _sanitize_table_name(table_name)
    columns = _get_table_columns(db, safe_name)
    table_columns = [col["name"] for col in columns]
    try:
        raw_bytes = file.file.read()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="无法读取文件") from exc
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="文件为空")
    try:
        decoded = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            decoded = raw_bytes.decode("utf-8")
        except UnicodeDecodeError as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="CSV 文件必须为 UTF-8 编码") from exc
    reader = csv.DictReader(io.StringIO(decoded))
    header = [name.strip() if name else "" for name in (reader.fieldnames or [])]
    if not header:
        raise HTTPException(status_code=400, detail="CSV 文件缺少表头")
    if header != table_columns:
        raise HTTPException(status_code=400, detail="CSV 表头与数据库表字段不匹配")
    rows_to_insert: List[dict] = []
    for row in reader:
        cleaned = {}
        for column in table_columns:
            value = row.get(column, "")
            cleaned[column] = None if value == "" else value
        rows_to_insert.append(cleaned)
    with db.begin_nested():
        if mode == "overwrite":
            db.execute(text(f'DELETE FROM "{safe_name}"'))
        if rows_to_insert:
            placeholders = ", ".join(f":{column}" for column in table_columns)
            columns_clause = ", ".join(f'"{column}"' for column in table_columns)
            insert_query = text(f'INSERT INTO "{safe_name}" ({columns_clause}) VALUES ({placeholders})')
            db.execute(insert_query, rows_to_insert)
    return {"status": "imported", "rows": len(rows_to_insert), "mode": mode}


def _fetch_table_names(db: Session) -> List[str]:
    rows = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    ).fetchall()
    return [row[0] for row in rows]


def _ensure_table_exists(db: Session, table_name: str) -> None:
    tables = _fetch_table_names(db)
    if table_name not in tables:
        raise HTTPException(status_code=404, detail="表不存在")


def _sanitize_table_name(table_name: str) -> str:
    return table_name.replace('"', '""')


def _get_table_columns(db: Session, safe_table_name: str) -> List[dict]:
    columns_raw = db.execute(text(f'PRAGMA table_info("{safe_table_name}")')).mappings().all()
    return [
        {
            "name": column["name"],
            "type": column["type"],
            "notnull": bool(column["notnull"]),
            "default_value": column["dflt_value"],
            "pk": bool(column["pk"]),
        }
        for column in columns_raw
    ]


def _normalize_code(code: str) -> str:
    return code.strip().upper()


def _invite_to_response(invite: models.ReviewerInvite) -> schemas.ReviewerInviteResponse:
    return schemas.ReviewerInviteResponse(
        id=invite.id,
        code=invite.code,
        preset_direction_id=invite.preset_direction_id,
        preset_direction_name=invite.preset_direction.name if invite.preset_direction else None,
        reviewer_name=invite.reviewer_name,
        reviewer_direction_id=invite.reviewer_direction_id,
        reviewer_direction_name=invite.reviewer_direction.name if invite.reviewer_direction else None,
        is_used=invite.is_used,
        created_at=invite.created_at,
        updated_at=invite.updated_at,
    )


@router.get("/reviewer-invites", response_model=List[schemas.ReviewerInviteResponse])
def list_reviewer_invites(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    invites = db.query(models.ReviewerInvite).order_by(models.ReviewerInvite.created_at.desc()).all()
    return [_invite_to_response(invite) for invite in invites]


@router.post("/reviewer-invites", response_model=schemas.ReviewerInviteResponse)
def create_reviewer_invite(
    payload: schemas.ReviewerInviteCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    raw_code = payload.code.strip() if payload.code else "".join(
        secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8)
    )
    norm = _normalize_code(raw_code)
    existing = db.query(models.ReviewerInvite).filter(models.ReviewerInvite.code == norm).first()
    if existing:
        raise HTTPException(status_code=400, detail="邀请码已存在")
    preset_direction = None
    if payload.preset_direction_id:
        preset_direction = (
            db.query(models.Direction).filter(models.Direction.id == payload.preset_direction_id).first()
        )
        if not preset_direction:
            raise HTTPException(status_code=404, detail="方向不存在")
    invite = models.ReviewerInvite(code=norm, preset_direction_id=preset_direction.id if preset_direction else None)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return _invite_to_response(invite)


@router.delete("/reviewer-invites/{invite_id}")
def delete_reviewer_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    invite = db.query(models.ReviewerInvite).filter(models.ReviewerInvite.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="邀请码不存在")
    if invite.is_used:
        raise HTTPException(status_code=400, detail="邀请码已被使用，无法删除")
    db.delete(invite)
    db.commit()
    return {"status": "deleted"}
