"""
Auth Endpoints — login, token refresh, logout
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.core.security import (
    verify_password, create_access_token, create_refresh_token, decode_token
)
from app.models.models import User
from app.schemas.auth import TokenResponse, RefreshRequest

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Login with email + password → returns JWT access + refresh tokens."""
    user = db.query(User).filter(User.email == form_data.username, User.is_active == True).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "department": user.department,
        }
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access token."""
    data = decode_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == data["sub"], User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    new_refresh = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "department": user.department,
        }
    }


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """
    Logout endpoint. JWTs are stateless — client should discard tokens.
    For token blocklisting, add Redis integration here.
    """
    return {"message": "Logged out successfully"}
