from pydantic import BaseModel, computed_field
from typing import Optional
from uuid import UUID
from datetime import date, datetime


class SubscriptionCreate(BaseModel):
    name:             str
    vendor:           Optional[str]   = None
    category:         Optional[str]   = None
    plan_name:        Optional[str]   = None
    num_licenses:     Optional[int]   = None
    licenses_used:    int             = 0
    cost_per_license: Optional[float] = None
    billing_cycle:    Optional[str]   = None
    total_cost:       Optional[float] = None
    start_date:       Optional[date]  = None
    renewal_date:     Optional[date]  = None
    auto_renew:       bool            = False
    status:           str             = 'active'
    notes:            Optional[str]   = None


class SubscriptionUpdate(BaseModel):
    name:             Optional[str]   = None
    vendor:           Optional[str]   = None
    category:         Optional[str]   = None
    plan_name:        Optional[str]   = None
    num_licenses:     Optional[int]   = None
    licenses_used:    Optional[int]   = None
    cost_per_license: Optional[float] = None
    billing_cycle:    Optional[str]   = None
    total_cost:       Optional[float] = None
    start_date:       Optional[date]  = None
    renewal_date:     Optional[date]  = None
    auto_renew:       Optional[bool]  = None
    status:           Optional[str]   = None
    notes:            Optional[str]   = None


class SubscriptionResponse(SubscriptionCreate):
    id:                  UUID
    licenses_available:  Optional[int] = None
    is_active:           bool
    created_at:          datetime
    updated_at:          Optional[datetime] = None

    model_config = {"from_attributes": True}
