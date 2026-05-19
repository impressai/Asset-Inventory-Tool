"""Pydantic schemas for Purchase endpoints"""
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel


class PurchaseCreate(BaseModel):
    vendor_name: str
    invoice_number: str
    purchase_date: Optional[date] = None
    total_cost: float
    warranty_details: Optional[str] = None


class PurchaseResponse(BaseModel):
    id: UUID
    vendor_name: str
    invoice_number: str
    purchase_date: date
    total_cost: float
    warranty_details: Optional[str] = None
    documents: Optional[List[str]] = None
    created_at: datetime

    model_config = {"from_attributes": True}
