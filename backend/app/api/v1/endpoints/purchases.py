"""Purchasing / procurement endpoint"""
import os
import uuid as _uuid
from datetime import date
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user, require_admin_or_manager
from app.models.models import Purchase
from app.schemas.purchase import PurchaseCreate, PurchaseUpdate, PurchaseResponse
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


@router.patch("/{purchase_id}", response_model=PurchaseResponse)
def update_purchase(
    purchase_id: UUID,
    payload: PurchaseUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_manager),
):
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if payload.invoice_number and payload.invoice_number != purchase.invoice_number:
        if db.query(Purchase).filter(Purchase.invoice_number == payload.invoice_number).first():
            raise HTTPException(status_code=400, detail="Invoice number already exists")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(purchase, field, value)
    db.commit()
    db.refresh(purchase)
    return purchase


@router.delete("/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase(
    purchase_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin_or_manager),
):
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    db.delete(purchase)
    db.commit()


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

    allowed_extensions = {".pdf", ".jpg", ".jpeg", ".png", ".xlsx"}
    orig_ext = Path(file.filename or "").suffix.lower()
    if orig_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file extension")

    safe_filename = f"{_uuid.uuid4()}{orig_ext}"
    upload_dir = os.path.join(settings.LOCAL_UPLOAD_DIR, "purchases", str(purchase_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    relative_key = f"purchases/{purchase_id}/{safe_filename}"
    existing_docs = purchase.documents or []
    purchase.documents = existing_docs + [relative_key]
    db.commit()

    return {"key": relative_key, "filename": file.filename, "safe_filename": safe_filename}


@router.get("/{purchase_id}/documents/{filename}")
def download_document(
    purchase_id: UUID,
    filename: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Download an uploaded purchase document."""
    purchase = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    base_dir = os.path.abspath(os.path.join(settings.LOCAL_UPLOAD_DIR, "purchases", str(purchase_id)))
    file_path = os.path.abspath(os.path.join(base_dir, filename))
    if not file_path.startswith(base_dir + os.sep):
        raise HTTPException(status_code=403, detail="Access denied")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=filename)
