"""Notifications & alerts endpoint"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta
from app.api.v1.deps import get_db, require_admin_or_manager
from app.models.models import Asset

router = APIRouter()

@router.get("/warranty-expiring")
def warranty_expiring_soon(days: int = 30, db: Session = Depends(get_db), current_user=Depends(require_admin_or_manager)):
    """Assets whose warranty expires within N days."""
    threshold = date.today() + timedelta(days=days)
    assets = db.query(Asset).filter(
        Asset.warranty_expiry_date != None,
        Asset.warranty_expiry_date <= threshold,
        Asset.is_active == True
    ).all()
    return {"expiring_within_days": days, "count": len(assets), "assets": assets}
