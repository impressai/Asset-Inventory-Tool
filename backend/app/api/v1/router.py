"""
API v1 Router — mounts all endpoint groups
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    assets,
    purchases,
    assignments,
    history,
    reports,
    users,
    notifications,
)

api_router = APIRouter()

api_router.include_router(auth.router,          prefix="/auth",          tags=["Auth"])
api_router.include_router(users.router,         prefix="/users",         tags=["Users"])
api_router.include_router(assets.router,        prefix="/assets",        tags=["Assets"])
api_router.include_router(purchases.router,     prefix="/purchases",     tags=["Purchasing"])
api_router.include_router(assignments.router,   prefix="/assignments",   tags=["Assignments"])
api_router.include_router(history.router,       prefix="/history",       tags=["Asset History"])
api_router.include_router(reports.router,       prefix="/reports",       tags=["Reports"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
