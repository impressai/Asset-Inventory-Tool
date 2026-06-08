"""Pydantic schemas for Assignment endpoints"""
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, EmailStr
from app.models.models import ApprovalStatus


class AssignmentAsset(BaseModel):
    id: UUID
    name: str
    asset_tag: str
    category: str
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None

    model_config = {"from_attributes": True}


class AssignmentUpdate(BaseModel):
    assignee_name: Optional[str] = None
    assignee_email: Optional[EmailStr] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    expected_return_date: Optional[date] = None
    notes: Optional[str] = None

    model_config = {"extra": "forbid"}


class BulkReturnRequest(BaseModel):
    assignment_ids: List[str]

    model_config = {"extra": "forbid"}


class ClearanceEmailRequest(BaseModel):
    employee_name: str = "Employee"
    employee_id: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    employee_email: Optional[EmailStr] = None
    manager_emails: Optional[List[EmailStr]] = None
    current_assets: List[dict] = []
    history_assets: List[dict] = []
    note: Optional[str] = None

    model_config = {"extra": "forbid"}


class AssignmentCreate(BaseModel):
    asset_id: UUID
    user_id: Optional[UUID] = None
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    assignment_date: Optional[date] = None
    expected_return_date: Optional[date] = None
    notes: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: UUID
    asset_id: UUID
    user_id: Optional[UUID] = None
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = None
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
    asset: Optional[AssignmentAsset] = None

    model_config = {"from_attributes": True}
