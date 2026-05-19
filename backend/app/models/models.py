"""
SQLAlchemy ORM Models — Asset Inventory Tool
"""

import uuid
from datetime import datetime, date
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Date, DateTime,
    ForeignKey, Enum, Text, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


# ─── Enums ────────────────────────────────────────────────────
class UserRole(str, PyEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


class AssetCondition(str, PyEnum):
    NEW = "new"
    GOOD = "good"
    DAMAGED = "damaged"
    RETIRED = "retired"


class AssetStatus(str, PyEnum):
    STOCK = "stock"
    ASSIGNED = "assigned"
    FAULTY = "faulty"
    SOLD = "sold"


class ApprovalStatus(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class HistoryEventType(str, PyEnum):
    CREATED = "created"
    UPDATED = "updated"
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    MAINTENANCE = "maintenance"
    STATUS_CHANGED = "status_changed"
    DISPOSED = "disposed"


# ─── User ─────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(String(50), unique=True, nullable=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    assignments = relationship("Assignment", back_populates="assigned_user", foreign_keys="Assignment.user_id")
    approved_assignments = relationship("Assignment", back_populates="approver", foreign_keys="Assignment.approved_by")
    audit_logs = relationship("AuditLog", back_populates="performed_by_user")
    asset_history = relationship("AssetHistory", back_populates="performed_by_user")


# ─── Asset ────────────────────────────────────────────────────
class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_tag = Column(String(50), unique=True, nullable=False, index=True)  # Human-readable ID e.g. AST-001
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    brand = Column(String(100), nullable=True)
    model_number = Column(String(100), nullable=True)
    serial_number = Column(String(100), unique=True, nullable=True, index=True)
    specifications = Column(JSON, nullable=True)       # {"cpu": "i7", "ram": "16GB", ...}
    condition = Column(Enum(AssetCondition), nullable=False, default=AssetCondition.NEW)
    status = Column(Enum(AssetStatus), nullable=False, default=AssetStatus.STOCK, index=True)
    location = Column(String(255), nullable=True)
    purchase_date = Column(Date, nullable=True)
    warranty_expiry_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # FK
    purchase_id = Column(UUID(as_uuid=True), ForeignKey("purchases.id"), nullable=True)

    # Relationships
    purchase = relationship("Purchase", back_populates="assets")
    assignments = relationship("Assignment", back_populates="asset")
    history = relationship("AssetHistory", back_populates="asset", order_by="desc(AssetHistory.created_at)")

    @property
    def current_assignee_name(self):
        for a in self.assignments:
            if a.is_active:
                return a.assignee_name
        return None


# ─── Purchase ─────────────────────────────────────────────────
class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_name = Column(String(255), nullable=False)
    invoice_number = Column(String(100), unique=True, nullable=False)
    purchase_date = Column(Date, nullable=False)
    total_cost = Column(Float, nullable=False)
    warranty_details = Column(Text, nullable=True)
    documents = Column(JSON, nullable=True)       # List of S3 keys
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    assets = relationship("Asset", back_populates="purchase")


# ─── Assignment ───────────────────────────────────────────────
class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    assignee_name = Column(String(255), nullable=True)
    assignee_email = Column(String(255), nullable=True)
    department = Column(String(100), nullable=True)
    assignment_date = Column(Date, nullable=False)
    return_date = Column(Date, nullable=True)
    expected_return_date = Column(Date, nullable=True)
    approval_status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)       # False = returned
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    asset = relationship("Asset", back_populates="assignments")
    assigned_user = relationship("User", back_populates="assignments", foreign_keys=[user_id])
    approver = relationship("User", back_populates="approved_assignments", foreign_keys=[approved_by])


# ─── Asset History (Audit Trail) ─────────────────────────────
class AssetHistory(Base):
    __tablename__ = "asset_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False, index=True)
    event_type = Column(Enum(HistoryEventType), nullable=False)
    description = Column(Text, nullable=False)
    changed_fields = Column(JSON, nullable=True)     # {"field": {"old": ..., "new": ...}}
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    asset = relationship("Asset", back_populates="history")
    performed_by_user = relationship("User", back_populates="asset_history")


# ─── Audit Log (system-wide) ──────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False)    # "asset" | "user" | "assignment"
    entity_id = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    performed_by_user = relationship("User", back_populates="audit_logs")
