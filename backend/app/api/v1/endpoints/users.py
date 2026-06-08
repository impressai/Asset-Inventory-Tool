"""Users management endpoints (Admin + Manager)"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, require_admin_or_manager, get_current_user
from app.core.security import get_password_hash, verify_password
from app.models.models import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse, ChangePasswordRequest, AdminResetPasswordRequest
from app.api.v1.endpoints.auth import _validate_password_strength

router = APIRouter()

SUPER_ADMIN = UserRole.ADMIN


def _guard_superadmin(current_user: User, target_user: User):
    """Raise 403 if a manager tries to act on a Super Admin account."""
    if current_user.role != SUPER_ADMIN and target_user.role == SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot modify a Super Admin account.")


@router.get("", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin_or_manager)):
    return db.query(User).filter(User.is_active == True).all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    if current_user.role != SUPER_ADMIN and payload.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only a Super Admin can create Super Admin accounts.")

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail="Email already registered")
        # Reactivate deactivated account with new details
        existing.full_name       = payload.full_name
        existing.hashed_password = get_password_hash(payload.password)
        existing.role            = payload.role
        existing.department      = payload.department
        existing.employee_id     = payload.employee_id
        existing.is_active       = True
        db.commit()
        db.refresh(existing)
        return existing

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        department=payload.department,
        employee_id=payload.employee_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Any authenticated user can change their own password by supplying their current password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    _validate_password_strength(payload.new_password)
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from the current password.")
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def admin_reset_password(
    user_id: UUID,
    payload: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    """Admin / Manager can reset another user's password without knowing the current one."""
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _guard_superadmin(current_user, user)
    _validate_password_strength(payload.new_password)
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _guard_superadmin(current_user, user)
    if current_user.role != SUPER_ADMIN and payload.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only a Super Admin can assign the Super Admin role.")
    if payload.email and payload.email != user.email:
        if db.query(User).filter(User.email == payload.email, User.id != user_id).first():
            raise HTTPException(status_code=400, detail="Email already in use by another account.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    _guard_superadmin(current_user, user)
    user.is_active = False
    db.commit()
