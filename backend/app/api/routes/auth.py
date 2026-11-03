"""
Auth routes: /me, /users
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_principal, get_db, require_manager
from app.api.schemas import MeResponse, UserCreateRequest, UserResponse, UserUpdateRequest
from app.core.security import Principal
from app.db.models import AppUser, EmployeeRole, UserRole

router = APIRouter(prefix="/api/v1", tags=["auth"])


@router.get("/me", response_model=MeResponse)
async def get_me(
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> MeResponse:
    """Get current user info with role, employee, and pod details."""
    user = principal

    employee_data = None
    pod_data = None

    if user.employee_id:
        from app.db.models import Employee, Pod
        emp = db.query(Employee).filter(Employee.id == user.employee_id).first()
        if emp:
            employee_data = {
                "id": str(emp.id),
                "name": emp.name,
                "pod_id": str(emp.pod_id),
                "role": emp.role.value,
                "preferred_off_days": emp.preferred_off_days,
                "max_consecutive_days": emp.max_consecutive_days,
                "max_cover_per_day": emp.max_cover_per_day,
            }
            pod = db.query(Pod).filter(Pod.id == emp.pod_id).first()
            if pod:
                pod_data = {
                    "id": str(pod.id),
                    "name": pod.name,
                }

    return MeResponse(
        user=UserResponse(
            id=user.user_id,
            email=user.email,
            role=user.role,
            employee_id=user.employee_id,
            pod_id=user.pod_id,
            created_at=datetime.utcnow(),  # Will be overridden by actual data
            updated_at=datetime.utcnow(),
        ),
        role=user.role,
        employee=employee_data,
        pod=pod_data,
    )


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    principal: Principal = Depends(require_manager),
    db: Session = Depends(get_db),
) -> list[UserResponse]:
    """List all app users (Manager only)."""
    users = db.query(AppUser).all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            role=u.role,
            employee_id=u.employee_id,
            pod_id=u.employee.pod_id if u.employee else None,
            created_at=u.created_at,
            updated_at=u.updated_at,
        )
        for u in users
    ]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreateRequest,
    principal: Principal = Depends(require_manager),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Create a new app user (Manager only)."""
    # Check if email already exists
    existing = db.query(AppUser).filter(AppUser.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Validate employee_id if provided
    if request.employee_id:
        from app.db.models import Employee
        emp = db.query(Employee).filter(Employee.id == request.employee_id).first()
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee not found",
            )
        if request.role == UserRole.MANAGER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Manager cannot have employee_id",
            )
        if request.role == UserRole.POD_LEAD and emp.role != EmployeeRole.LEAD:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pod Lead must be linked to a Lead employee",
            )

    # Note: In production, create user in Supabase Auth via Admin API
    # Here we just create the app_user record
    user = AppUser(
        id=UUID(int=0),  # Would be set by Supabase Auth
        email=request.email,
        role=request.role,
        employee_id=request.employee_id,
    )
    db.add(user)
    db.flush()

    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        employee_id=user.employee_id,
        pod_id=user.employee.pod_id if user.employee else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    request: UserUpdateRequest,
    principal: Principal = Depends(require_manager),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Update a user (Manager only)."""
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if request.role is not None:
        if request.role == UserRole.MANAGER and user.employee_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Manager cannot have employee_id",
            )
        if request.role == UserRole.POD_LEAD:
            if user.employee_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Pod Lead must have employee_id",
                )
            from app.db.models import Employee
            emp = db.query(Employee).filter(Employee.id == user.employee_id).first()
            if not emp or emp.role != EmployeeRole.LEAD:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Pod Lead must be linked to a Lead employee",
                )
        user.role = request.role

    if request.employee_id is not None:
        from app.db.models import Employee
        emp = db.query(Employee).filter(Employee.id == request.employee_id).first()
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )
        if user.role == UserRole.MANAGER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Manager cannot have employee_id",
            )
        user.employee_id = request.employee_id

    if request.active is not None:
        # No active field in AppUser, would need to add or use a different approach
        pass

    db.flush()

    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        employee_id=user.employee_id,
        pod_id=user.employee.pod_id if user.employee else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )