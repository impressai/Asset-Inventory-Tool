#!/usr/bin/env python3
"""
Seed script — creates the initial Admin user.
Run inside the backend container:
  docker compose exec backend python scripts/seed.py
"""

import sys
import os

# Add app to path
sys.path.insert(0, "/app")

from app.db.session import SessionLocal
from app.db.base import Base
from app.models.models import User, UserRole
from app.core.security import get_password_hash

def seed():
    db = SessionLocal()
    try:
        # Check if admin already exists
        existing = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if existing:
            print(f"✅ Admin already exists: {existing.email}")
            return

        admin = User(
            full_name="System Administrator",
            email=os.getenv("ADMIN_EMAIL", "admin@assetinventory.com"),
            hashed_password=get_password_hash(os.getenv("ADMIN_PASSWORD", "Admin@123!")),
            role=UserRole.ADMIN,
            department="IT",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"✅ Admin user created: {admin.email}")
        print("⚠️  Change the default password immediately!")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
