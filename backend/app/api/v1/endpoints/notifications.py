"""Notifications & alerts endpoint"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta
from app.api.v1.deps import get_db, get_current_user
from app.models.models import Asset, Assignment

router = APIRouter()

@router.get("/warranty-expiring")
def warranty_expiring_soon(days: int = 30, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Assets whose warranty expires within N days."""
    threshold = date.today() + timedelta(days=days)
    assets = db.query(Asset).filter(
        Asset.warranty_expiry_date != None,
        Asset.warranty_expiry_date <= threshold,
        Asset.is_active == True
    ).all()
    return {"expiring_within_days": days, "count": len(assets), "assets": assets}


@router.get("/software-expiring")
def software_expiring_soon(days: int = 30, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Assets whose license/subscription expiry_date falls within N days."""
    today = date.today()
    threshold = today + timedelta(days=days)
    assets = db.query(Asset).filter(
        Asset.expiry_date != None,
        Asset.expiry_date >= today,
        Asset.expiry_date <= threshold,
        Asset.is_active == True
    ).order_by(Asset.expiry_date).all()
    return {"expiring_within_days": days, "count": len(assets), "assets": assets}


@router.get("/overdue-assignments")
def overdue_assignments(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Active assignments whose expected return date has passed."""
    today = date.today()
    rows = (
        db.query(Assignment)
        .join(Assignment.asset)
        .filter(
            Assignment.is_active == True,
            Assignment.expected_return_date != None,
            Assignment.expected_return_date < today,
        )
        .order_by(Assignment.expected_return_date)
        .all()
    )
    result = []
    for a in rows:
        result.append({
            "assignment_id":       str(a.id),
            "asset_id":            str(a.asset_id),
            "asset_tag":           a.asset.asset_tag,
            "asset_name":          a.asset.name,
            "category":            a.asset.category,
            "assignee_name":       a.assignee_name,
            "employee_id":         a.employee_id,
            "designation":         a.designation,
            "department":          a.department,
            "expected_return_date": str(a.expected_return_date),
            "days_overdue":        (today - a.expected_return_date).days,
        })
    return {"count": len(result), "assignments": result}
