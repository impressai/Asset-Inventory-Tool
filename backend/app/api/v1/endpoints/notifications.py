"""Notifications & alerts endpoint"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta
from app.api.v1.deps import get_db, require_admin_or_manager, require_admin
from app.models.models import Asset, Assignment, User, Subscription
from app.core.email import send_email, notification_alert_email

router = APIRouter()

@router.get("/warranty-expiring")
def warranty_expiring_soon(days: int = 30, db: Session = Depends(get_db), current_user=Depends(require_admin_or_manager)):
    """Assets whose warranty expiry date is within ±N days of today."""
    today = date.today()
    lookback  = today - timedelta(days=days)
    threshold = today + timedelta(days=days)
    assets = db.query(Asset).filter(
        Asset.warranty_expiry_date != None,
        Asset.warranty_expiry_date >= lookback,
        Asset.warranty_expiry_date <= threshold,
        Asset.is_active == True
    ).all()
    return {"expiring_within_days": days, "count": len(assets), "assets": assets}


@router.get("/software-expiring")
def software_expiring_soon(days: int = 30, db: Session = Depends(get_db), current_user=Depends(require_admin_or_manager)):
    """Assets whose license/subscription expiry_date is within ±N days of today."""
    today = date.today()
    lookback  = today - timedelta(days=days)
    threshold = today + timedelta(days=days)
    assets = db.query(Asset).filter(
        Asset.expiry_date != None,
        Asset.expiry_date >= lookback,
        Asset.expiry_date <= threshold,
        Asset.is_active == True
    ).order_by(Asset.expiry_date).all()
    return {"expiring_within_days": days, "count": len(assets), "assets": assets}


@router.get("/overdue-assignments")
def overdue_assignments(db: Session = Depends(get_db), current_user=Depends(require_admin_or_manager)):
    """Active assignments whose expected return date has passed."""
    today = date.today()
    rows = (
        db.query(Assignment)
        .join(Assignment.asset)
        .filter(
            Assignment.is_active == True,
            Asset.is_active == True,
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


@router.get("/subscriptions-expiring")
def subscriptions_expiring_soon(days: int = 30, db: Session = Depends(get_db), current_user=Depends(require_admin_or_manager)):
    """Subscriptions whose renewal_date is within ±N days of today."""
    today = date.today()
    lookback  = today - timedelta(days=days)
    threshold = today + timedelta(days=days)
    subs = db.query(Subscription).filter(
        Subscription.renewal_date != None,
        Subscription.renewal_date >= lookback,
        Subscription.renewal_date <= threshold,
        Subscription.is_active == True,
        Subscription.status == 'active',
    ).order_by(Subscription.renewal_date).all()
    result = [
        {
            "id":             str(s.id),
            "name":           s.name,
            "vendor":         s.vendor,
            "category":       s.category,
            "num_licenses":   s.num_licenses,
            "cost_per_license": s.cost_per_license,
            "total_cost":     s.total_cost,
            "renewal_date":   str(s.renewal_date),
            "days_left":      (s.renewal_date - today).days,
            "billing_cycle":  s.billing_cycle,
        }
        for s in subs
    ]
    return {"expiring_within_days": days, "count": len(result), "subscriptions": result}


@router.post("/send-alerts")
def send_alert_emails(days: int = 30, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    """Send notification summary email to all admin users."""
    today = date.today()
    lookback  = today - timedelta(days=days)
    threshold = today + timedelta(days=days)

    warranty_assets = db.query(Asset).filter(
        Asset.warranty_expiry_date != None,
        Asset.warranty_expiry_date >= lookback,
        Asset.warranty_expiry_date <= threshold,
        Asset.is_active == True,
    ).all()
    warranty_items = [
        {"name": a.name, "asset_tag": a.asset_tag,
         "days_left": (a.warranty_expiry_date - today).days}
        for a in warranty_assets
    ]

    license_assets = db.query(Asset).filter(
        Asset.expiry_date != None,
        Asset.expiry_date >= lookback,
        Asset.expiry_date <= threshold,
        Asset.is_active == True,
    ).all()
    license_items = [
        {"name": a.name, "asset_tag": a.asset_tag,
         "days_left": (a.expiry_date - today).days}
        for a in license_assets
    ]

    overdue_rows = (
        db.query(Assignment).join(Assignment.asset)
        .filter(
            Assignment.is_active == True,
            Assignment.expected_return_date != None,
            Assignment.expected_return_date < today,
        ).all()
    )
    overdue_items = [
        {"asset_name": a.asset.name, "asset_tag": a.asset.asset_tag,
         "assignee_name": a.assignee_name or "—",
         "days_overdue": (today - a.expected_return_date).days}
        for a in overdue_rows
    ]

    if not warranty_items and not license_items and not overdue_items:
        return {"sent": 0, "message": "No active alerts to send."}

    users = db.query(User).filter(User.role == "admin", User.is_active == True).all()
    sent = 0
    for user in users:
        ok = send_email(
            to_email=user.email,
            to_name=user.full_name,
            subject=f"Asset Inventory — Notification Summary ({today})",
            html_body=notification_alert_email(
                user.full_name, warranty_items, license_items, overdue_items
            ),
        )
        if ok:
            sent += 1

    return {"sent": sent, "total_users": len(users),
            "warranty_alerts": len(warranty_items),
            "license_alerts": len(license_items),
            "overdue_alerts": len(overdue_items)}
