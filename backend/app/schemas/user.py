"""Pydantic schemas for User endpoints"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models.models import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.USER
    department: Optional[str] = None
    employee_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    employee_id: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    employee_id: Optional[str] = None
    full_name: str
    email: str
    department: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
