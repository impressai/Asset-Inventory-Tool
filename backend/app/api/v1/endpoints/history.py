"""Asset history / audit trail endpoint"""
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.v1.deps import get_db, get_current_user
from app.models.models import AssetHistory

router = APIRouter()

@router.get("/{asset_id}")
def get_asset_history(asset_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(AssetHistory).filter(AssetHistory.asset_id == asset_id).order_by(AssetHistory.created_at.desc()).all()
