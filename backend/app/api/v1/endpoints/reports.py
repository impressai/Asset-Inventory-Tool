"""Reports endpoints"""
from typing import Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, subqueryload
from app.api.v1.deps import get_db, get_current_user
from app.models.models import Asset, Assignment, AssetStatus, User

router = APIRouter()

@router.get("/summary")
def asset_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    total = db.query(Asset).filter(Asset.is_active == True).count()
    by_status = {s.value: db.query(Asset).filter(Asset.status == s, Asset.is_active == True).count() for s in AssetStatus}

    rows = (
        db.query(Asset.category, func.count(Asset.id))
        .filter(Asset.is_active == True)
        .group_by(Asset.category)
        .order_by(func.count(Asset.id).desc())
        .all()
    )
    by_category = {row[0]: row[1] for row in rows}

    return {"total_assets": total, "by_status": by_status, "by_category": by_category}

@router.get("/by-category")
def by_category_breakdown(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Return status breakdown for every category."""
    rows = (
        db.query(Asset.category, Asset.status, func.count(Asset.id))
        .filter(Asset.is_active == True)
        .group_by(Asset.category, Asset.status)
        .all()
    )
    result: dict = {}
    for category, status, count in rows:
        if category not in result:
            result[category] = {s.value: 0 for s in AssetStatus}
        result[category][status.value] = count
    return result


@router.get("/assets")
def report_assets(
    report_type: str = "all",
    category: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return filtered asset list for report generation."""
    today = date.today()

    # ── Overdue returns ──────────────────────────────────────
    if report_type == "overdue":
        rows = (
            db.query(Assignment).join(Assignment.asset)
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
            if category and a.asset.category != category:
                continue
            result.append({
                "id": str(a.asset_id), "asset_tag": a.asset.asset_tag,
                "name": a.asset.name, "category": a.asset.category,
                "brand": a.asset.brand, "status": a.asset.status.value,
                "current_assignee": a.assignee_name, "assignee_email": a.assignee_email,
                "employee_id": a.employee_id, "designation": a.designation,
                "department": a.department,
                "assignment_date": str(a.assignment_date) if a.assignment_date else None,
                "expected_return_date": str(a.expected_return_date),
                "days_overdue": (today - a.expected_return_date).days,
            })
        return {"count": len(result), "report_type": report_type, "assets": result}

    # ── Standard asset query ─────────────────────────────────
    query = db.query(Asset).options(subqueryload(Asset.assignments)).filter(Asset.is_active == True)

    if category:
        query = query.filter(Asset.category == category)
    if status and report_type == "all":
        query = query.filter(Asset.status == status)
    if date_from:
        query = query.filter(Asset.purchase_date >= date_from)
    if date_to:
        query = query.filter(Asset.purchase_date <= date_to)

    if report_type == "assigned":
        query = query.filter(Asset.status == AssetStatus.ASSIGNED)
    elif report_type == "stock":
        query = query.filter(Asset.status == AssetStatus.STOCK)
    elif report_type == "warranty_expiring":
        lookback = today - timedelta(days=days)
        threshold = today + timedelta(days=days)
        query = query.filter(Asset.warranty_expiry_date != None,
                             Asset.warranty_expiry_date >= lookback,
                             Asset.warranty_expiry_date <= threshold)
    elif report_type == "license_expiring":
        lookback = today - timedelta(days=days)
        threshold = today + timedelta(days=days)
        query = query.filter(Asset.expiry_date != None,
                             Asset.expiry_date >= lookback,
                             Asset.expiry_date <= threshold)

    assets = query.order_by(Asset.category, Asset.name).all()
    result = []
    for asset in assets:
        asgn = next((a for a in asset.assignments if a.is_active), None)
        item = {
            "id": str(asset.id), "asset_tag": asset.asset_tag,
            "name": asset.name, "category": asset.category,
            "brand": asset.brand, "model_number": asset.model_number,
            "serial_number": asset.serial_number, "status": asset.status.value,
            "condition": asset.condition.value, "location": asset.location,
            "purchase_date": str(asset.purchase_date) if asset.purchase_date else None,
            "warranty_expiry_date": str(asset.warranty_expiry_date) if asset.warranty_expiry_date else None,
            "expiry_date": str(asset.expiry_date) if asset.expiry_date else None,
            "license_start_date": str(asset.license_start_date) if asset.license_start_date else None,
            "notes": asset.notes,
            "current_assignee": asgn.assignee_name if asgn else None,
            "assignee_email": asgn.assignee_email if asgn else None,
            "department": asgn.department if asgn else None,
            "assignment_date": str(asgn.assignment_date) if asgn else None,
            "expected_return_date": str(asgn.expected_return_date) if asgn and asgn.expected_return_date else None,
        }
        if report_type == "warranty_expiring" and asset.warranty_expiry_date:
            item["days_left"] = (asset.warranty_expiry_date - today).days
        elif report_type == "license_expiring" and asset.expiry_date:
            item["days_left"] = (asset.expiry_date - today).days
        result.append(item)

    return {"count": len(result), "report_type": report_type, "assets": result}


@router.get("/assigned-vs-available")
def assigned_vs_available(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    assigned = db.query(Asset).filter(Asset.status == AssetStatus.ASSIGNED).count()
    available = db.query(Asset).filter(Asset.status == AssetStatus.STOCK).count()
    return {"assigned": assigned, "available": available}
