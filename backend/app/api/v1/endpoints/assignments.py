"""
Assignments Endpoints — assign/unassign assets, approval flow
"""

from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_db, get_current_user, require_admin_or_manager, check_permission
from app.models.models import (
    Assignment, Asset, User, AssetStatus, ApprovalStatus,
    AssetHistory, HistoryEventType, NotificationConfig,
)
from app.schemas.assignment import AssignmentCreate, AssignmentResponse
from app.core.email import send_email, asset_assigned_email, asset_returned_email

router = APIRouter()


@router.get("", response_model=list[AssignmentResponse])
def list_assignments(
    asset_id: UUID | None = None,
    user_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active assignments. Filter by asset_id or user_id."""
    query = db.query(Assignment).options(joinedload(Assignment.asset))
    if asset_id:
        query = query.filter(Assignment.asset_id == asset_id)
    elif user_id:
        if current_user.role.value == "user" and current_user.id != user_id:
            query = query.filter(Assignment.user_id == current_user.id)
        else:
            query = query.filter(Assignment.is_active == True, Assignment.user_id == user_id)
    else:
        query = query.filter(Assignment.is_active == True)
        if current_user.role.value == "user":
            query = query.filter(Assignment.user_id == current_user.id)
    return query.order_by(Assignment.created_at.desc()).all()


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("assign_asset")),
):
    """Assign an asset. Assignee can be a system user or any free-text name."""
    # Validate asset
    asset = db.query(Asset).filter(Asset.id == payload.asset_id, Asset.is_active == True).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status == AssetStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Asset is already assigned")

    # Must have either a system user or a free-text name
    if not payload.user_id and not payload.assignee_name:
        raise HTTPException(status_code=422, detail="Provide either a user or an assignee name")

    # Resolve display name for history log
    if payload.user_id:
        linked_user = db.query(User).filter(User.id == payload.user_id, User.is_active == True).first()
        if not linked_user:
            raise HTTPException(status_code=404, detail="User not found")
        display_name = linked_user.full_name
    else:
        display_name = payload.assignee_name  # type: ignore[assignment]

    assignment = Assignment(
        asset_id=payload.asset_id,
        user_id=payload.user_id,
        assignee_name=payload.assignee_name,
        assignee_email=payload.assignee_email,
        employee_id=payload.employee_id,
        designation=payload.designation,
        department=payload.department,
        assignment_date=payload.assignment_date or date.today(),
        expected_return_date=payload.expected_return_date,
        notes=payload.notes,
        approval_status=ApprovalStatus.APPROVED,
        approved_by=current_user.id,
    )
    asset.status = AssetStatus.ASSIGNED

    desc = f"Assigned to {display_name}"
    extras = []
    if payload.employee_id: extras.append(f"ID: {payload.employee_id}")
    if payload.designation:  extras.append(payload.designation)
    if payload.department:   extras.append(payload.department)
    if extras: desc += f" ({', '.join(extras)})"

    history = AssetHistory(
        asset_id=payload.asset_id,
        event_type=HistoryEventType.ASSIGNED,
        description=desc,
        performed_by=current_user.id,
    )

    db.add(assignment)
    db.add(history)
    db.commit()
    db.refresh(assignment)

    cfg = db.query(NotificationConfig).filter(NotificationConfig.id == 1).first()
    if assignment.assignee_email and (not cfg or cfg.notify_on_asset_assigned):
        send_email(
            to_email=assignment.assignee_email,
            to_name=display_name,
            subject=f"Asset Assigned: {asset.name} ({asset.asset_tag})",
            html_body=asset_assigned_email(
                full_name=display_name,
                asset_name=asset.name,
                asset_tag=asset.asset_tag,
                category=asset.category,
                brand=asset.brand,
                assignment_date=str(assignment.assignment_date),
                expected_return_date=str(assignment.expected_return_date) if assignment.expected_return_date else None,
                notes=assignment.notes,
            ),
        )

    return assignment


@router.patch("/{assignment_id}", response_model=AssignmentResponse)
def update_assignment(
    assignment_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_manager),
):
    """Update mutable fields on an active assignment (employee details, dates, notes)."""
    assignment = db.query(Assignment).options(joinedload(Assignment.asset)).filter(
        Assignment.id == assignment_id, Assignment.is_active == True
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Active assignment not found")

    allowed = {"assignee_name", "assignee_email", "employee_id", "designation", "department", "expected_return_date", "notes"}
    for field, value in payload.items():
        if field in allowed:
            setattr(assignment, field, value or None)

    db.commit()
    db.refresh(assignment)
    return assignment


@router.post("/{assignment_id}/return")
def return_asset(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("return_asset")),
):
    """Mark asset as returned and log full previous-owner details in history."""
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id, Assignment.is_active == True
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    return_date = date.today()

    # Resolve who held the asset
    if assignment.assignee_name:
        holder_name = assignment.assignee_name
    elif assignment.user_id:
        linked = db.query(User).filter(User.id == assignment.user_id).first()
        holder_name = linked.full_name if linked else str(assignment.user_id)
    else:
        holder_name = "Unknown"

    # Build a human-readable description
    parts = [f"Returned by previous holder: {holder_name}"]
    if assignment.assignee_email:
        parts.append(f"Email: {assignment.assignee_email}")
    if assignment.department:
        parts.append(f"Department: {assignment.department}")
    parts.append(f"Assigned on: {assignment.assignment_date}")
    parts.append(f"Returned on: {return_date}")
    if assignment.expected_return_date:
        parts.append(f"Expected return was: {assignment.expected_return_date}")
    if assignment.notes:
        parts.append(f"Notes: {assignment.notes}")

    # Structured snapshot stored in changed_fields for future queries
    snapshot = {
        "assignee_name":        assignment.assignee_name,
        "assignee_email":       assignment.assignee_email,
        "employee_id":          assignment.employee_id,
        "designation":          assignment.designation,
        "department":           assignment.department,
        "assignment_date":      str(assignment.assignment_date),
        "return_date":          str(return_date),
        "expected_return_date": str(assignment.expected_return_date) if assignment.expected_return_date else None,
        "notes":                assignment.notes,
        "returned_by":          current_user.full_name,
    }

    assignment.is_active = False
    assignment.return_date = return_date
    assignment.asset.status = AssetStatus.STOCK

    history = AssetHistory(
        asset_id=assignment.asset_id,
        event_type=HistoryEventType.UNASSIGNED,
        description=" | ".join(parts),
        changed_fields={"return_snapshot": snapshot},
        performed_by=current_user.id,
    )
    db.add(history)
    db.commit()

    cfg = db.query(NotificationConfig).filter(NotificationConfig.id == 1).first()
    if assignment.assignee_email and (not cfg or cfg.notify_on_asset_returned):
        send_email(
            to_email=assignment.assignee_email,
            to_name=holder_name,
            subject=f"Asset Returned: {assignment.asset.name} ({assignment.asset.asset_tag})",
            html_body=asset_returned_email(
                full_name=holder_name,
                asset_name=assignment.asset.name,
                asset_tag=assignment.asset.asset_tag,
                category=assignment.asset.category,
                return_date=str(return_date),
            ),
        )

    return {"message": "Asset returned successfully"}
