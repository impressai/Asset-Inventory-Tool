"""Pydantic schemas for Assignment endpoints"""
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel
from app.models.models import ApprovalStatus


class AssignmentCreate(BaseModel):
    asset_id: UUID
    # Either link to a system user OR supply a free-text name
    user_id: Optional[UUID] = None
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    department: Optional[str] = None
    assignment_date: Optional[date] = None   # defaults to today if omitted
    expected_return_date: Optional[date] = None
    notes: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: UUID
    asset_id: UUID
    user_id: Optional[UUID] = None
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    department: Optional[str] = None
    assignment_date: date
    return_date: Optional[date] = None
    expected_return_date: Optional[date] = None
    approval_status: ApprovalStatus
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
