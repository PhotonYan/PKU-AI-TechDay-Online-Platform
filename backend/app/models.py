import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


class UserRole(str, enum.Enum):
    volunteer = "volunteer"
    admin = "admin"


class ReimbursementStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    waiting_more = "waiting_more"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    responsibility = Column(Text, nullable=False)

    users = relationship("User", back_populates="organization")


class RoleTemplate(Base):
    __tablename__ = "role_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    can_edit_vote_data = Column(Boolean, default=False)

    users = relationship("User", back_populates="role_template")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    college = Column(String, nullable=True)
    grade = Column(String, nullable=True)
    student_id = Column(String, nullable=True, unique=True)
    volunteer_tracks = Column(String, nullable=True)
    assigned_tracks = Column(String, nullable=True)
    availability_slots = Column(Text, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.volunteer, index=True)
    vote_counter_opt_in = Column(Boolean, default=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    role_template_id = Column(Integer, ForeignKey("role_templates.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="users")
    role_template = relationship("RoleTemplate", back_populates="users")
    reimbursements = relationship("Reimbursement", back_populates="applicant")


class Reimbursement(Base):
    __tablename__ = "reimbursements"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, nullable=False)
    organization = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=True)
    amount = Column(Float, nullable=False)
    invoice_company = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    status = Column(Enum(ReimbursementStatus), default=ReimbursementStatus.pending)
    admin_note = Column(Text, nullable=True)
    applicant_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    applicant = relationship("User", back_populates="reimbursements")


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    sequence_no = Column(Integer, nullable=True, index=True)
    title = Column(String, nullable=False)
    author = Column(String, nullable=False)
    abstract = Column(Text, nullable=False)
    direction = Column(String, nullable=False)
    contact = Column(String, nullable=False)
    venue = Column(String, nullable=False)
    vote_innovation = Column(Float, default=0)
    vote_impact = Column(Float, default=0)
    vote_feasibility = Column(Float, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class PaperVoteLog(Base):
    __tablename__ = "paper_vote_logs"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    field_name = Column(String, nullable=False)
    old_value = Column(Float, nullable=True)
    new_value = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
    user = relationship("User")


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True, index=True)
    show_vote_data = Column(Boolean, default=False)
    vote_sort_enabled = Column(Boolean, default=False)
    vote_edit_role_template_id = Column(Integer, ForeignKey("role_templates.id"), nullable=True)
