from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import date, datetime


class SubscriptionCreate(BaseModel):
    name:             str
    vendor:           Optional[str]   = None
    category:         Optional[str]   = None
    plan_name:        Optional[str]   = None
    num_licenses:     Optional[int]   = None
    cost_per_license: Optional[float] = None
    billing_cycle:    Optional[str]   = None
    total_cost:       Optional[float] = None
    start_date:       Optional[date]  = None
    renewal_date:     Optional[date]  = None
    auto_renew:       bool = False
    status:           str  = 'active'
    notes:            Optional[str]   = None


class SubscriptionUpdate(BaseModel):
    name:             Optional[str]   = None
    vendor:           Optional[str]   = None
    category:         Optional[str]   = None
    plan_name:        Optional[str]   = None
    num_licenses:     Optional[int]   = None
    cost_per_license: Optional[float] = None
    billing_cycle:    Optional[str]   = None
    total_cost:       Optional[float] = None
    start_date:       Optional[date]  = None
    renewal_date:     Optional[date]  = None
    auto_renew:       Optional[bool]  = None
    status:           Optional[str]   = None
    notes:            Optional[str]   = None


class SubscriptionResponse(SubscriptionCreate):
    id:         UUID
    is_active:  bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
