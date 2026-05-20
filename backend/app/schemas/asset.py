"""Pydantic schemas for Asset endpoints"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel
from app.models.models import AssetCondition, AssetStatus


class AssetBase(BaseModel):
    model_config = {"protected_namespaces": ()}

    name: str
    category: str
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None
    condition: AssetCondition = AssetCondition.NEW
    status: AssetStatus = AssetStatus.STOCK
    location: Optional[str] = None
    purchase_date: Optional[date] = None
    warranty_expiry_date: Optional[date] = None
    expiry_date: Optional[date] = None
    license_start_date: Optional[date] = None
    notes: Optional[str] = None
    purchase_id: Optional[UUID] = None
    # Sale details
    sale_date:           Optional[date] = None
    buyer_name:          Optional[str]  = None
    buyer_email:         Optional[str]  = None
    buyer_contact:       Optional[str]  = None
    sale_price:          Optional[float] = None
    sale_invoice_number: Optional[str]  = None
    sale_notes:          Optional[str]  = None


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None
    condition: Optional[AssetCondition] = None
    status: Optional[AssetStatus] = None
    location: Optional[str] = None
    warranty_expiry_date: Optional[date] = None
    expiry_date: Optional[date] = None
    license_start_date: Optional[date] = None
    notes: Optional[str] = None
    # Sale details
    sale_date:           Optional[date]  = None
    buyer_name:          Optional[str]   = None
    buyer_email:         Optional[str]   = None
    buyer_contact:       Optional[str]   = None
    sale_price:          Optional[float] = None
    sale_invoice_number: Optional[str]   = None
    sale_notes:          Optional[str]   = None


class AssetResponse(AssetBase):
    id: UUID
    asset_tag: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    current_assignee_name: Optional[str] = None

    class Config:
        from_attributes = True


class AssetListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[AssetResponse]
