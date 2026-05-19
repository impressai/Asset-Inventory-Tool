"""Reports endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
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


@router.get("/assigned-vs-available")
def assigned_vs_available(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    assigned = db.query(Asset).filter(Asset.status == AssetStatus.ASSIGNED).count()
    available = db.query(Asset).filter(Asset.status == AssetStatus.STOCK).count()
    return {"assigned": assigned, "available": available}
