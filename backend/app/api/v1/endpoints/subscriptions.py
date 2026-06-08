"""Subscriptions CRUD endpoints"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user, check_permission
from app.models.models import Subscription
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse


class LicenseAdjustRequest(BaseModel):
    count: int = 1

router = APIRouter()


@router.get("", response_model=list[SubscriptionResponse])
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(Subscription)
        .filter(Subscription.is_active == True)
        .order_by(Subscription.created_at.desc())
        .all()
    )


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(check_permission("manage_subscriptions")),
):
    sub = Subscription(**payload.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.get("/{sub_id}", response_model=SubscriptionResponse)
def get_subscription(
    sub_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sub = db.query(Subscription).filter(Subscription.id == sub_id, Subscription.is_active == True).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub


@router.patch("/{sub_id}", response_model=SubscriptionResponse)
def update_subscription(
    sub_id: UUID,
    payload: SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(check_permission("manage_subscriptions")),
):
    sub = db.query(Subscription).filter(Subscription.id == sub_id, Subscription.is_active == True).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sub, field, value)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscription(
    sub_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(check_permission("manage_subscriptions")),
):
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.is_active = False
    db.commit()


@router.post("/{sub_id}/issue", response_model=SubscriptionResponse)
def issue_licenses(
    sub_id: UUID,
    payload: LicenseAdjustRequest,
    db: Session = Depends(get_db),
    current_user=Depends(check_permission("manage_subscriptions")),
):
    """Mark licenses as issued (in-use). Reduces the available count."""
    if payload.count < 1:
        raise HTTPException(status_code=400, detail="Count must be at least 1")
    sub = db.query(Subscription).filter(Subscription.id == sub_id, Subscription.is_active == True).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.num_licenses is not None:
        available = sub.num_licenses - (sub.licenses_used or 0)
        if payload.count > available:
            raise HTTPException(
                status_code=400,
                detail=f"Only {available} license(s) available — cannot issue {payload.count}",
            )
    sub.licenses_used = (sub.licenses_used or 0) + payload.count
    db.commit()
    db.refresh(sub)
    return sub


@router.post("/{sub_id}/return", response_model=SubscriptionResponse)
def return_licenses(
    sub_id: UUID,
    payload: LicenseAdjustRequest,
    db: Session = Depends(get_db),
    current_user=Depends(check_permission("manage_subscriptions")),
):
    """Mark licenses as returned (freed). Increases the available count."""
    if payload.count < 1:
        raise HTTPException(status_code=400, detail="Count must be at least 1")
    sub = db.query(Subscription).filter(Subscription.id == sub_id, Subscription.is_active == True).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    current_used = sub.licenses_used or 0
    if payload.count > current_used:
        raise HTTPException(
            status_code=400,
            detail=f"Only {current_used} license(s) in use — cannot return {payload.count}",
        )
    sub.licenses_used = current_used - payload.count
    db.commit()
    db.refresh(sub)
    return sub
