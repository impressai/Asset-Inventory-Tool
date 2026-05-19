"""Purchasing / procurement endpoint"""
import os
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, require_admin_or_manager
from app.models.models import Purchase
from app.schemas.purchase import PurchaseCreate, PurchaseResponse
from app.core.config import settings

router = APIRouter()


@router.get("", response_model=list[PurchaseResponse])
def list_purchases(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_manager),
):
    return db.query(Purchase).order_by(Purchase.created_at.desc()).all()


@router.post("", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(
    payload: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_manager),
):
    if db.query(Purchase).filter(Purchase.invoice_number == payload.invoice_number).first():
        raise HTTPException(status_code=400, detail="Invoice number already exists")
    purchase = Purchase(
        vendor_name=payload.vendor_name,
        invoice_number=payload.invoice_number,
        purchase_date=payload.purchase_date or date.today(),
        total_cost=payload.total_cost,
        warranty_details=payload.warranty_details,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


@router.post("/{purchase_id}/documents", status_code=status.HTTP_201_CREATED)
def upload_document(
    purchase_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_manager),
):
    """Upload a document (PDF/image) and attach it to a purchase record."""
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    if file.content_type not in settings.ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail=f"File type '{file.content_type}' not allowed")

    if file.size and file.size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum upload size")

    upload_dir = os.path.join(settings.LOCAL_UPLOAD_DIR, "purchases", str(purchase_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    relative_key = f"purchases/{purchase_id}/{file.filename}"
    existing_docs = purchase.documents or []
    purchase.documents = existing_docs + [relative_key]
    db.commit()

    return {"key": relative_key, "filename": file.filename}
