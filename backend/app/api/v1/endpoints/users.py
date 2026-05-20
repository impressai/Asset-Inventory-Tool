"""Users management endpoints (Admin + Manager)"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, require_admin_or_manager, get_current_user
from app.core.security import get_password_hash
from app.models.models import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse

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
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
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
