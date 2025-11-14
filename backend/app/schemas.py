from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

from .models import (
    ReimbursementStatus,
    SubmissionPublicationStatus,
    SubmissionReviewStatus,
    SubmissionTrack,
    UserRole,
)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrganizationResponse(BaseModel):
    id: int
    name: str
    responsibility: str

    class Config:
        orm_mode = True


class UserBase(BaseModel):
    email: str
    name: str
    school: Optional[str] = None
    college: Optional[str] = None
    grade: Optional[str] = None
    student_id: Optional[str] = None
    volunteer_tracks: Optional[List[str]] = None
    assigned_tracks: Optional[List[str]] = None
    availability_slots: Optional[List[str]] = None
    role: UserRole = UserRole.volunteer
    organization: Optional[str] = None
    responsibility: Optional[str] = None
    role_template_id: Optional[int] = None
    vote_counter_opt_in: Optional[bool] = False
    role_template_can_edit_vote: Optional[bool] = False
    organizations_detail: Optional[List[OrganizationResponse]] = None


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    school: Optional[str] = None
    college: str
    grade: str
    student_id: Optional[str] = None
    volunteer_tracks: List[str]
    availability_slots: List[str]
    vote_counter_opt_in: bool = False


class AuthorRegister(BaseModel):
    email: EmailStr
    name: str
    password: str
    school: str
    college: str
    grade: str
    student_id: str


class UserResponse(UserBase):
    id: int

    class Config:
        orm_mode = True


class ReimbursementBase(BaseModel):
    project_name: str
    organization: str
    content: str
    quantity: Optional[int] = None
    amount: float
    invoice_company: str


class ReimbursementCreate(ReimbursementBase):
    pass


class ReimbursementResponse(ReimbursementBase):
    id: int
    status: ReimbursementStatus
    file_path: Optional[str]
    admin_note: Optional[str]
    applicant_name: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ReimbursementReview(BaseModel):
    status: ReimbursementStatus
    admin_note: Optional[str] = None


class DirectionBase(BaseModel):
    name: str
    description: Optional[str] = None


class DirectionCreate(DirectionBase):
    pass


class DirectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DirectionResponse(DirectionBase):
    id: int

    class Config:
        orm_mode = True


class SubmissionBase(BaseModel):
    title: str
    abstract: str
    contact: str
    venue: str
    track: SubmissionTrack
    archive_consent: bool = True
    direction_id: Optional[int] = None
    paper_url: Optional[str] = None
    publication_status: SubmissionPublicationStatus


class SubmissionResponse(SubmissionBase):
    id: int
    review_status: SubmissionReviewStatus
    award: Optional[str]
    poster_path: Optional[str]
    direction_name: Optional[str]
    author_name: str
    vote_innovation: float
    vote_impact: float
    vote_feasibility: float
    updated_at: datetime

    class Config:
        orm_mode = True


class SubmissionDetailResponse(SubmissionResponse):
    logs: Optional[List["SubmissionVoteLogResponse"]] = None


class SubmissionListItem(BaseModel):
    id: int
    title: str
    direction_name: Optional[str]
    author_name: str
    venue: str
    status: SubmissionReviewStatus
    track: SubmissionTrack
    archive_consent: bool
    paper_url: Optional[str]
    poster_path: Optional[str]
    award: Optional[str]
    vote_innovation: Optional[float]
    vote_impact: Optional[float]
    vote_feasibility: Optional[float]


class SubmissionVoteUpdate(BaseModel):
    vote_innovation: Optional[float] = None
    vote_impact: Optional[float] = None
    vote_feasibility: Optional[float] = None


class SubmissionVoteLogResponse(BaseModel):
    id: int
    field_name: str
    old_value: Optional[float]
    new_value: Optional[float]
    created_at: datetime
    user_name: Optional[str]


class SubmissionAdminUpdate(BaseModel):
    review_status: Optional[SubmissionReviewStatus] = None
    award: Optional[str] = None
    track: Optional[SubmissionTrack] = None
    direction_id: Optional[int] = None
    publication_status: Optional[SubmissionPublicationStatus] = None


SubmissionDetailResponse.update_forward_refs()


class VoteSettings(BaseModel):
    show_vote_data: bool
    vote_sort_enabled: bool
    vote_edit_role_template_id: Optional[int]


class RoleTemplateCreate(BaseModel):
    name: str
    can_edit_vote_data: bool = False


class RoleTemplateResponse(RoleTemplateCreate):
    id: int

    class Config:
        orm_mode = True


class OrganizationCreate(BaseModel):
    name: str
    responsibility: str


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    responsibility: Optional[str] = None


class UserUpdate(BaseModel):
    organization_id: Optional[int] = None
    assigned_tracks: Optional[List[str]] = None
    role_template_id: Optional[int] = None
    role: Optional[UserRole] = None
    vote_counter_opt_in: Optional[bool] = None
