"""
Assets API Endpoints — CRUD + search/filter
"""

from typing import Optional, List
from uuid import UUID

import re
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, subqueryload
from sqlalchemy import func, asc, desc

from app.api.v1.deps import get_db, get_current_user, require_admin, require_admin_or_manager, check_permission
from app.models.models import Asset, AssetStatus, AssetCondition, User, Purchase, AssetHistory, HistoryEventType, Assignment, NotificationConfig
from app.schemas.asset import AssetCreate, AssetUpdate, AssetResponse, AssetListResponse
from app.core.email import send_email, asset_added_email, asset_deleted_email

router = APIRouter()


def _get_notif_cfg(db: Session) -> NotificationConfig:
    cfg = db.query(NotificationConfig).filter(NotificationConfig.id == 1).first()
    if not cfg:
        cfg = NotificationConfig(id=1)
        db.add(cfg); db.commit(); db.refresh(cfg)
    return cfg


def _notify_all_users(db: Session, subject: str, html_body_fn):
    users = db.query(User).filter(User.is_active == True).all()
    for user in users:
        send_email(to_email=user.email, to_name=user.full_name, subject=subject,
                   html_body=html_body_fn(user.full_name))


def _next_asset_tag(db: Session) -> str:
    """Generate the next asset tag by incrementing the highest existing number."""
    max_tag = db.query(func.max(Asset.asset_tag)).scalar()
    if max_tag:
        m = re.search(r"(\d+)$", max_tag)
        next_num = int(m.group(1)) + 1 if m else 1
    else:
        next_num = 1
    return f"AST-{next_num:04d}"


@router.get("", response_model=AssetListResponse)
def list_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name, asset_tag, serial_number"),
    status: Optional[AssetStatus] = None,
    category: Optional[str] = None,
    location: Optional[str] = None,
    condition: Optional[AssetCondition] = None,
    vendor: Optional[str] = None,
    sort_by: Optional[str] = Query(None, description="Field to sort by"),
    sort_dir: Optional[str] = Query("asc", description="asc or desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List assets with optional search and filters.
    - Admin/Manager: all assets
    - User: only assets assigned to them
    """
    query = db.query(Asset).filter(Asset.is_active == True)

    if search:
        assigned_asset_ids = db.query(Assignment.asset_id).filter(
            Assignment.is_active == True,
            Assignment.assignee_name.ilike(f"%{search}%"),
        )
        query = query.filter(
            (Asset.name.ilike(f"%{search}%")) |
            (Asset.asset_tag.ilike(f"%{search}%")) |
            (Asset.serial_number.ilike(f"%{search}%")) |
            (Asset.id.in_(assigned_asset_ids))
        )

    if status:
        query = query.filter(Asset.status == status)
    if category:
        query = query.filter(Asset.category.ilike(f"%{category}%"))
    if location:
        query = query.filter(Asset.location.ilike(f"%{location}%"))
    if condition:
        query = query.filter(Asset.condition == condition)
    if vendor:
        query = query.join(Purchase, Asset.purchase_id == Purchase.id, isouter=True).filter(
            Purchase.vendor_name.ilike(f"%{vendor}%")
        )

    SORTABLE = {
        'name': Asset.name, 'category': Asset.category, 'brand': Asset.brand,
        'status': Asset.status, 'condition': Asset.condition, 'location': Asset.location,
        'asset_tag': Asset.asset_tag, 'created_at': Asset.created_at,
    }

    if sort_by == 'assignee_name':
        from sqlalchemy.orm import aliased
        active_assign = aliased(Assignment)
        query = query.outerjoin(
            active_assign,
            (active_assign.asset_id == Asset.id) & (active_assign.is_active == True)
        )
        sort_col = active_assign.assignee_name
    else:
        sort_col = SORTABLE.get(sort_by or '', Asset.created_at)

    query = query.order_by(desc(sort_col) if sort_dir == 'desc' else asc(sort_col))

    total = query.count()
    assets = query.options(subqueryload(Asset.assignments)).offset((page - 1) * page_size).limit(page_size).all()

    return {"total": total, "page": page, "page_size": page_size, "items": assets}


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("create_asset")),
):
    """Create a new asset. Admin only."""
    asset_tag = _next_asset_tag(db)

    try:
        asset = Asset(**payload.model_dump(), asset_tag=asset_tag)
        db.add(asset)
        db.flush()
        history = AssetHistory(
            asset_id=asset.id,
            event_type=HistoryEventType.CREATED,
            description=f"Asset '{asset.name}' created with tag {asset_tag}",
            performed_by=current_user.id,
        )
        db.add(history)
        db.commit()
        db.refresh(asset)
        if _get_notif_cfg(db).notify_on_asset_created:
            _notify_all_users(db, f"New Asset Added: {asset.name} ({asset.asset_tag})",
                lambda name: asset_added_email(name, asset.name, asset.asset_tag, asset.category, asset.brand, current_user.full_name))
        return asset
    except IntegrityError as e:
        db.rollback()
        if "serial_number" in str(e):
            raise HTTPException(status_code=409, detail=f"Serial number '{payload.serial_number}' is already in use by another asset.")
        raise HTTPException(status_code=409, detail="Could not create asset: a unique value conflict occurred.")


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single asset by ID."""
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.is_active == True).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: UUID,
    payload: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("edit_asset")),
):
    """Update asset fields. Admin/Manager only."""
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.is_active == True).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = payload.model_dump(exclude_unset=True)
    changed_fields = {
        field: {"old": getattr(asset, field), "new": value}
        for field, value in update_data.items()
        if getattr(asset, field) != value
    }

    for field, value in update_data.items():
        setattr(asset, field, value)

    if changed_fields:
        history = AssetHistory(
            asset_id=asset_id,
            event_type=HistoryEventType.UPDATED,
            description="Asset fields updated",
            changed_fields={k: {"old": str(v["old"]), "new": str(v["new"])} for k, v in changed_fields.items()},
            performed_by=current_user.id,
        )
        db.add(history)

    try:
        db.commit()
        db.refresh(asset)
        return asset
    except IntegrityError as e:
        db.rollback()
        if "serial_number" in str(e):
            raise HTTPException(status_code=409, detail=f"Serial number '{update_data.get('serial_number')}' is already in use by another asset.")
        raise HTTPException(status_code=409, detail="Could not update asset: a unique value conflict occurred.")


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("delete_asset")),
):
    """Soft-delete an asset. Admin/Manager only."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset.is_active = False

    history = AssetHistory(
        asset_id=asset_id,
        event_type=HistoryEventType.DISPOSED,
        description="Asset soft-deleted",
        performed_by=current_user.id,
    )
    db.add(history)
    db.commit()
    if _get_notif_cfg(db).notify_on_asset_deleted:
        _notify_all_users(db, f"Asset Removed: {asset.name} ({asset.asset_tag})",
            lambda name: asset_deleted_email(name, asset.name, asset.asset_tag, asset.category, current_user.full_name))


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def bulk_create_assets(
    payloads: List[AssetCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("import_assets")),
):
    """Create multiple assets at once from a parsed CSV payload."""
    if not payloads:
        raise HTTPException(status_code=422, detail="No assets provided")
    if len(payloads) > 500:
        raise HTTPException(status_code=422, detail="Maximum 500 assets per import")

    created = []
    errors = []

    for i, payload in enumerate(payloads):
        try:
            asset_tag = _next_asset_tag(db)
            asset = Asset(**payload.model_dump(), asset_tag=asset_tag)
            with db.begin_nested():
                db.add(asset)
                db.flush()
            history = AssetHistory(
                asset_id=asset.id,
                event_type=HistoryEventType.CREATED,
                description=f"Bulk imported: '{asset.name}' (row {i + 1})",
                performed_by=current_user.id,
            )
            db.add(history)
            created.append(asset_tag)
        except Exception as e:
            msg = str(e).split("\n")[0]
            errors.append({"row": i + 1, "error": msg})

    db.commit()
    return {"created": len(created), "tags": created, "errors": errors}
