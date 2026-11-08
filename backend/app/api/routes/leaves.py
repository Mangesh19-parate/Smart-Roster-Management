"""
Leaves routes: CRUD + impact preview
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_current_principal, get_db, require_manager, require_pod_lead_or_manager
from app.api.schemas import (
    LeaveCreate,
    LeaveCreateResponse,
    LeavePreviewRequest,
    LeavePreviewResponse,
    LeaveResponse,
    LeaveUpdate,
)
from app.core.security import Principal
from app.db.models import Employee, Leave, LeaveStatus, UserRole
from app.services.engine_service import get_impact_preview

router = APIRouter(prefix="/api/v1", tags=["leaves"])


@router.get("/leaves", response_model=list[LeaveResponse])
async def list_leaves(
    employee_id: UUID | None = Query(default=None),
    month: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> list[LeaveResponse]:
    """List leaves with optional filters (Manager/Pod Lead: own pod, Employee: own)."""
    query = db.query(Leave)

    # Role-based filtering
    if principal.role == UserRole.EMPLOYEE and principal.employee_id:
        query = query.filter(Leave.employee_id == principal.employee_id)
    elif principal.role == UserRole.POD_LEAD and principal.pod_id:
        # Filter to employees in this pod
        from app.db.models import Employee as DBEmployee

        emp_ids = db.query(DBEmployee.id).filter(DBEmployee.pod_id == principal.pod_id).subquery()
        query = query.filter(Leave.employee_id.in_(emp_ids))
    elif employee_id:
        query = query.filter(Leave.employee_id == employee_id)

    if month:
        year, month_num = map(int, month.split("-"))
        from calendar import monthrange

        _, last_day = monthrange(year, month_num)
        start = date(year, month_num, 1)
        end = date(year, month_num, last_day)
        query = query.filter(and_(Leave.start_date <= end, Leave.end_date >= start))

    leaves = query.order_by(Leave.start_date.desc()).all()
    return [
        LeaveResponse(
            id=leave.id,
            employee_id=leave.employee_id,
            start_date=leave.start_date,
            end_date=leave.end_date,
            type=leave.type,
            status=leave.status,
            note=leave.note,
            created_by=leave.created_by,
            created_at=leave.created_at,
            updated_at=leave.updated_at,
        )
        for leave in leaves
    ]


@router.post("/leaves", response_model=LeaveCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_leave(
    request: LeaveCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> LeaveCreateResponse:
    """Create a leave request. Employees forced to PENDING status."""
    # Validate employee exists
    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    # Permission check
    if principal.role == UserRole.EMPLOYEE:
        if principal.employee_id != request.employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only create leaves for yourself",
            )
        # Force PENDING for employees
        status_override = LeaveStatus.PENDING
    elif principal.role == UserRole.POD_LEAD:
        if employee.pod_id != principal.pod_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only create leaves for your pod",
            )
        # Default to PENDING for now, manager can approve
        status_override = LeaveStatus.PENDING
    else:
        status_override = LeaveStatus.APPROVED  # Manager can approve directly

    # Determine month from start_date
    leave_month = f"{request.start_date.year}-{request.start_date.month:02d}"

    leave = Leave(
        employee_id=request.employee_id,
        start_date=request.start_date,
        end_date=request.end_date,
        type=request.type,
        status=status_override,
        created_by=principal.user_id,
    )
    db.add(leave)
    db.flush()

    # Get impact preview
    impact = get_impact_preview(
        db, leave_month, request.employee_id, request.start_date, request.end_date
    )

    return LeaveCreateResponse(
        leave=LeaveResponse(
            id=leave.id,
            employee_id=leave.employee_id,
            start_date=leave.start_date,
            end_date=leave.end_date,
            type=leave.type,
            status=leave.status,
            note=leave.note,
            created_by=leave.created_by,
            created_at=leave.created_at,
            updated_at=leave.updated_at,
        ),
        impact=impact,
    )


@router.patch("/leaves/{leave_id}", response_model=LeaveCreateResponse)
async def update_leave(
    leave_id: UUID,
    request: LeaveUpdate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_manager),  # Only managers can update status
) -> LeaveCreateResponse:
    """Update a leave (Manager only for status changes)."""
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave not found",
        )

    if request.status is not None:
        leave.status = request.status
    if request.start_date is not None:
        leave.start_date = request.start_date
    if request.end_date is not None:
        leave.end_date = request.end_date

    db.flush()

    # Determine month from leave dates
    leave_month = f"{leave.start_date.year}-{leave.start_date.month:02d}"

    # Get impact preview
    impact = get_impact_preview(
        db, leave_month, leave.employee_id, leave.start_date, leave.end_date
    )

    return LeaveCreateResponse(
        leave=LeaveResponse(
            id=leave.id,
            employee_id=leave.employee_id,
            start_date=leave.start_date,
            end_date=leave.end_date,
            type=leave.type,
            status=leave.status,
            note=leave.note,
            created_by=leave.created_by,
            created_at=leave.created_at,
            updated_at=leave.updated_at,
        ),
        impact=impact,
    )


@router.delete("/leaves/{leave_id}", response_model=dict)
async def delete_leave(
    leave_id: UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_manager),
) -> dict:
    """Delete a leave (Manager only)."""
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave not found",
        )

    employee_id = leave.employee_id
    start_date = leave.start_date
    end_date = leave.end_date
    leave_month = f"{start_date.year}-{start_date.month:02d}"

    db.delete(leave)
    db.flush()

    # Get impact preview for deletion
    impact = get_impact_preview(db, leave_month, employee_id, start_date, end_date)

    return {"deleted": True, "impact": impact.model_dump()}


@router.post("/leaves/preview", response_model=LeavePreviewResponse)
async def preview_leave(
    request: LeavePreviewRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> LeavePreviewResponse:
    """Preview impact of a leave without saving."""
    # Permission check similar to create
    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    if principal.role == UserRole.POD_LEAD and principal.pod_id:
        if employee.pod_id != principal.pod_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only preview leaves for your pod",
            )

    # Determine month from request dates
    leave_month = f"{request.start_date.year}-{request.start_date.month:02d}"

    impact = get_impact_preview(
        db, leave_month, request.employee_id, request.start_date, request.end_date
    )

    return LeavePreviewResponse(impact=impact)
