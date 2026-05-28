"""Subscriptions CRUD endpoints"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user, check_permission
from app.models.models import Subscription
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse

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
