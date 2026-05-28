"""Notification settings endpoint"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.api.v1.deps import get_db, get_current_user, require_admin_or_manager
from app.models.models import NotificationConfig

router = APIRouter()


class NotificationConfigResponse(BaseModel):
    warranty_enabled:         bool
    warranty_days:            int
    license_enabled:          bool
    license_days:             int
    overdue_enabled:          bool
    overdue_threshold_days:   int
    email_enabled:            bool
    email_send_hour:          int
    email_send_minute:        int
    email_recipients:         str
    email_frequency:          str
    email_weekly_day:         int
    notify_on_asset_created:  bool
    notify_on_asset_assigned: bool
    notify_on_asset_returned: bool
    notify_on_asset_deleted:  bool
    updated_at:               Optional[datetime] = None

    model_config = {"from_attributes": True}


class NotificationConfigUpdate(BaseModel):
    warranty_enabled:         Optional[bool] = None
    warranty_days:            Optional[int]  = None
    license_enabled:          Optional[bool] = None
    license_days:             Optional[int]  = None
    overdue_enabled:          Optional[bool] = None
    overdue_threshold_days:   Optional[int]  = None
    email_enabled:            Optional[bool] = None
    email_send_hour:          Optional[int]  = None
    email_send_minute:        Optional[int]  = None
    email_recipients:         Optional[str]  = None
    email_frequency:          Optional[str]  = None
    email_weekly_day:         Optional[int]  = None
    notify_on_asset_created:  Optional[bool] = None
    notify_on_asset_assigned: Optional[bool] = None
    notify_on_asset_returned: Optional[bool] = None
    notify_on_asset_deleted:  Optional[bool] = None


def get_or_create_config(db: Session) -> NotificationConfig:
    cfg = db.query(NotificationConfig).filter(NotificationConfig.id == 1).first()
    if not cfg:
        cfg = NotificationConfig(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("/notifications", response_model=NotificationConfigResponse)
def get_notification_settings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_or_create_config(db)


@router.put("/notifications", response_model=NotificationConfigResponse)
def update_notification_settings(
    payload: NotificationConfigUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_manager),
):
    cfg = get_or_create_config(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == 'email_send_hour'       and value is not None: value = max(0,  min(23,  value))
        if field == 'email_send_minute'     and value is not None: value = max(0,  min(59,  value))
        if field in ('warranty_days', 'license_days') and value is not None: value = max(1, min(365, value))
        if field == 'overdue_threshold_days' and value is not None: value = max(0, min(365, value))
        if field == 'email_weekly_day'       and value is not None: value = max(0,  min(6,   value))
        if field == 'email_recipients'       and value is not None and value not in ('all', 'admins_only', 'managers_and_admins'): continue
        if field == 'email_frequency'        and value is not None and value not in ('daily', 'weekly', 'on_demand'): continue
        setattr(cfg, field, value)
    db.commit()
    db.refresh(cfg)
    return cfg
