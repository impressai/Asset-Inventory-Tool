"""
Role Permissions — CRUD for per-role feature flags.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict

from app.api.v1.deps import get_db, get_current_user, require_admin
from app.models.models import RolePermission, UserRole, PERMISSION_KEYS, User

router = APIRouter()


@router.get("")
def get_permissions(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.query(RolePermission).all()
    result: Dict[str, Dict[str, bool]] = {r.value: {} for r in UserRole}
    for row in rows:
        result[row.role][row.permission] = row.allowed
    return result


@router.put("")
def update_permissions(
    data: Dict[str, Dict[str, bool]],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    for role_str, perms in data.items():
        if role_str == "admin":
            continue  # admin permissions are not editable
        for perm_key, allowed in perms.items():
            if perm_key not in PERMISSION_KEYS:
                continue
            row = db.query(RolePermission).filter(
                RolePermission.role == role_str,
                RolePermission.permission == perm_key,
            ).first()
            if row:
                row.allowed = allowed
            else:
                import uuid
                db.add(RolePermission(
                    id=uuid.uuid4(), role=role_str, permission=perm_key, allowed=allowed
                ))
    db.commit()
    return {"updated": True}
