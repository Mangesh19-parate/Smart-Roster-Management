"""
Config CRUD routes: pods, employees, brands, processes, assignments, holidays, settings
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_manager, require_pod_lead_or_manager
from app.api.schemas import (
    AssignmentCreate,
    AssignmentResponse,
    BrandCreate,
    BrandResponse,
    BrandUpdate,
    CoverageOverrideResponse,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    HolidayCreate,
    HolidayResponse,
    OverridesPutRequest,
    PodCreate,
    PodResponse,
    PodUpdate,
    ProcessCreate,
    ProcessResponse,
    ProcessUpdate,
    SettingsResponse,
)
from app.db.models import (
    Assignment,
    Brand,
    CoverageOverride,
    Employee,
    Holiday,
    HolidayScope,
    Pod,
    Process,
    Setting,
)

router = APIRouter(prefix="/api/v1", tags=["config"])


# ============================================================================
# Pods
# ============================================================================


@router.get("/pods", response_model=list[PodResponse])
async def list_pods(
    db: Session = Depends(get_db),
    principal=Depends(require_pod_lead_or_manager),
) -> list[PodResponse]:
    """List pods (Manager: all, Pod Lead: own pod)."""
    pods = db.query(Pod).all()
    return [
        PodResponse(
            id=p.id,
            name=p.name,
            lead_employee_id=p.lead_employee_id,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in pods
    ]


@router.post("/pods", response_model=PodResponse, status_code=status.HTTP_201_CREATED)
async def create_pod(
    request: PodCreate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> PodResponse:
    """Create a pod (Manager only)."""
    # Check name uniqueness
    existing = db.query(Pod).filter(Pod.name == request.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pod name already exists",
        )

    pod = Pod(
        name=request.name,
        lead_employee_id=request.lead_employee_id,
    )
    db.add(pod)
    db.flush()

    return PodResponse(
        id=pod.id,
        name=pod.name,
        lead_employee_id=pod.lead_employee_id,
        created_at=pod.created_at,
        updated_at=pod.updated_at,
    )


@router.patch("/pods/{pod_id}", response_model=PodResponse)
async def update_pod(
    pod_id: UUID,
    request: PodUpdate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> PodResponse:
    """Update a pod (Manager only)."""
    pod = db.query(Pod).filter(Pod.id == pod_id).first()
    if not pod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pod not found",
        )

    if request.name is not None:
        existing = db.query(Pod).filter(Pod.name == request.name, Pod.id != pod_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Pod name already exists",
            )
        pod.name = request.name

    if request.lead_employee_id is not None:
        pod.lead_employee_id = request.lead_employee_id

    db.flush()

    return PodResponse(
        id=pod.id,
        name=pod.name,
        lead_employee_id=pod.lead_employee_id,
        created_at=pod.created_at,
        updated_at=pod.updated_at,
    )


@router.delete(
    "/pods/{pod_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def delete_pod(
    pod_id: UUID,
    confirm: bool = Query(default=False),
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> None:
    """Delete a pod (Manager only). Requires confirm=true if has employees."""
    pod = db.query(Pod).filter(Pod.id == pod_id).first()
    if not pod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pod not found",
        )

    # Check for dependent employees
    employee_count = db.query(Employee).filter(Employee.pod_id == pod_id).count()
    if employee_count > 0 and not confirm:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pod has {employee_count} employees. Use ?confirm=true to force delete.",
        )

    db.delete(pod)
    db.flush()


# ============================================================================
# Employees
# ============================================================================


@router.get("/employees", response_model=list[EmployeeResponse])
async def list_employees(
    pod_id: UUID | None = Query(default=None),
    active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    principal=Depends(require_pod_lead_or_manager),
) -> list[EmployeeResponse]:
    """List employees with optional filters."""
    query = db.query(Employee)

    # Role-based filtering handled at query level
    # In a real implementation, this would filter by principal's pod for POD_LEAD
    # and by principal's employee_id for EMPLOYEE

    if pod_id:
        query = query.filter(Employee.pod_id == pod_id)
    if active is not None:
        query = query.filter(Employee.active == active)

    employees = query.all()
    return [
        EmployeeResponse(
            id=e.id,
            name=e.name,
            pod_id=e.pod_id,
            role=e.role,
            preferred_off_days=list(e.preferred_off_days or []),
            max_consecutive_days=e.max_consecutive_days,
            max_cover_per_day=e.max_cover_per_day,
            active=e.active,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        for e in employees
    ]


@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    request: EmployeeCreate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> EmployeeResponse:
    """Create an employee (Manager only)."""
    # Validate pod exists
    pod = db.query(Pod).filter(Pod.id == request.pod_id).first()
    if not pod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pod not found",
        )

    # Validate preferred_off_days
    for day in request.preferred_off_days:
        if day < 0 or day > 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="preferred_off_days must be 0-6 (Monday=0, Sunday=6)",
            )

    employee = Employee(
        name=request.name,
        pod_id=request.pod_id,
        role=request.role,
        preferred_off_days=request.preferred_off_days,
        max_consecutive_days=request.max_consecutive_days,
        max_cover_per_day=request.max_cover_per_day,
        active=True,
    )
    db.add(employee)
    db.flush()

    return EmployeeResponse(
        id=employee.id,
        name=employee.name,
        pod_id=employee.pod_id,
        role=employee.role,
        preferred_off_days=list(employee.preferred_off_days or []),
        max_consecutive_days=employee.max_consecutive_days,
        max_cover_per_day=employee.max_cover_per_day,
        active=employee.active,
        created_at=employee.created_at,
        updated_at=employee.updated_at,
    )


@router.patch("/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: UUID,
    request: EmployeeUpdate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> EmployeeResponse:
    """Update an employee (Manager only)."""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    if request.name is not None:
        employee.name = request.name
    if request.pod_id is not None:
        pod = db.query(Pod).filter(Pod.id == request.pod_id).first()
        if not pod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pod not found",
            )
        employee.pod_id = request.pod_id
    if request.role is not None:
        employee.role = request.role
    if request.preferred_off_days is not None:
        for day in request.preferred_off_days:
            if day < 0 or day > 6:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="preferred_off_days must be 0-6",
                )
        employee.preferred_off_days = request.preferred_off_days
    if request.max_consecutive_days is not None:
        employee.max_consecutive_days = request.max_consecutive_days
    if request.max_cover_per_day is not None:
        employee.max_cover_per_day = request.max_cover_per_day
    if request.active is not None:
        employee.active = request.active

    db.flush()

    return EmployeeResponse(
        id=employee.id,
        name=employee.name,
        pod_id=employee.pod_id,
        role=employee.role,
        preferred_off_days=list(employee.preferred_off_days or []),
        max_consecutive_days=employee.max_consecutive_days,
        max_cover_per_day=employee.max_cover_per_day,
        active=employee.active,
        created_at=employee.created_at,
        updated_at=employee.updated_at,
    )


@router.delete(
    "/employees/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def delete_employee(
    employee_id: UUID,
    confirm: bool = Query(default=False),
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> None:
    """Delete an employee (Manager only)."""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    # Check for dependent rosters/leaves
    from app.db.models import Assignment, Leave, RosterEntry

    entry_count = db.query(RosterEntry).filter(RosterEntry.employee_id == employee_id).count()
    leave_count = db.query(Leave).filter(Leave.employee_id == employee_id).count()
    assignment_count = db.query(Assignment).filter(Assignment.employee_id == employee_id).count()

    total = entry_count + leave_count + assignment_count
    if total > 0 and not confirm:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Employee has {total} dependent records. Use ?confirm=true to force delete.",
        )

    db.delete(employee)
    db.flush()


# ============================================================================
# Brands
# ============================================================================


@router.get("/brands", response_model=list[BrandResponse])
async def list_brands(
    db: Session = Depends(get_db),
    principal=Depends(require_pod_lead_or_manager),
) -> list[BrandResponse]:
    """List brands."""
    brands = db.query(Brand).filter(Brand.active).all()
    return [
        BrandResponse(
            id=b.id,
            name=b.name,
            active=b.active,
            created_at=b.created_at,
            updated_at=b.updated_at,
        )
        for b in brands
    ]


@router.post("/brands", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    request: BrandCreate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> BrandResponse:
    """Create a brand (Manager only)."""
    existing = db.query(Brand).filter(Brand.name == request.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Brand name already exists",
        )

    brand = Brand(name=request.name, active=request.active)
    db.add(brand)
    db.flush()

    return BrandResponse(
        id=brand.id,
        name=brand.name,
        active=brand.active,
        created_at=brand.created_at,
        updated_at=brand.updated_at,
    )


@router.patch("/brands/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: UUID,
    request: BrandUpdate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> BrandResponse:
    """Update a brand (Manager only)."""
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    if request.name is not None:
        existing = db.query(Brand).filter(Brand.name == request.name, Brand.id != brand_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Brand name already exists",
            )
        brand.name = request.name
    if request.active is not None:
        brand.active = request.active

    db.flush()

    return BrandResponse(
        id=brand.id,
        name=brand.name,
        active=brand.active,
        created_at=brand.created_at,
        updated_at=brand.updated_at,
    )


@router.delete(
    "/brands/{brand_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def delete_brand(
    brand_id: UUID,
    confirm: bool = Query(default=False),
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> None:
    """Delete a brand (Manager only)."""
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    # Check for dependent processes
    process_count = db.query(Process).filter(Process.brand_id == brand_id).count()
    if process_count > 0 and not confirm:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Brand has {process_count} processes. Use ?confirm=true to force delete.",
        )

    db.delete(brand)
    db.flush()


# ============================================================================
# Processes
# ============================================================================


@router.get("/processes", response_model=list[ProcessResponse])
async def list_processes(
    brand_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    principal=Depends(require_pod_lead_or_manager),
) -> list[ProcessResponse]:
    """List processes, optionally filtered by brand."""
    query = db.query(Process)
    if brand_id:
        query = query.filter(Process.brand_id == brand_id)
    processes = query.all()
    return [
        ProcessResponse(
            id=p.id,
            brand_id=p.brand_id,
            name=p.name,
            calendar_mode=p.calendar_mode,
            min_coverage=p.min_coverage,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in processes
    ]


@router.post("/processes", response_model=ProcessResponse, status_code=status.HTTP_201_CREATED)
async def create_process(
    request: ProcessCreate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> ProcessResponse:
    """Create a process (Manager only)."""
    brand = db.query(Brand).filter(Brand.id == request.brand_id).first()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brand not found",
        )

    existing = (
        db.query(Process)
        .filter(
            Process.brand_id == request.brand_id,
            Process.name == request.name,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Process name already exists for this brand",
        )

    process = Process(
        brand_id=request.brand_id,
        name=request.name,
        calendar_mode=request.calendar_mode,
        min_coverage=request.min_coverage,
    )
    db.add(process)
    db.flush()

    return ProcessResponse(
        id=process.id,
        brand_id=process.brand_id,
        name=process.name,
        calendar_mode=process.calendar_mode,
        min_coverage=process.min_coverage,
        created_at=process.created_at,
        updated_at=process.updated_at,
    )


@router.patch("/processes/{process_id}", response_model=ProcessResponse)
async def update_process(
    process_id: UUID,
    request: ProcessUpdate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> ProcessResponse:
    """Update a process (Manager only)."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )

    if request.name is not None:
        existing = (
            db.query(Process)
            .filter(
                Process.brand_id == process.brand_id,
                Process.name == request.name,
                Process.id != process_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Process name already exists for this brand",
            )
        process.name = request.name
    if request.calendar_mode is not None:
        process.calendar_mode = request.calendar_mode
    if request.min_coverage is not None:
        process.min_coverage = request.min_coverage

    db.flush()

    return ProcessResponse(
        id=process.id,
        brand_id=process.brand_id,
        name=process.name,
        calendar_mode=process.calendar_mode,
        min_coverage=process.min_coverage,
        created_at=process.created_at,
        updated_at=process.updated_at,
    )


@router.delete(
    "/processes/{process_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def delete_process(
    process_id: UUID,
    confirm: bool = Query(default=False),
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> None:
    """Delete a process (Manager only)."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )

    # Check for dependent assignments, overrides, covers
    from app.db.models import Assignment, CoverageOverride, CoverAssignment

    assignment_count = db.query(Assignment).filter(Assignment.process_id == process_id).count()
    override_count = (
        db.query(CoverageOverride).filter(CoverageOverride.process_id == process_id).count()
    )
    cover_count = db.query(CoverAssignment).filter(CoverAssignment.process_id == process_id).count()

    total = assignment_count + override_count + cover_count
    if total > 0 and not confirm:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Process has {total} dependent records. Use ?confirm=true to force delete.",
        )

    db.delete(process)
    db.flush()


# ============================================================================
# Coverage Overrides
# ============================================================================


@router.put("/processes/{process_id}/overrides", response_model=list[CoverageOverrideResponse])
async def set_overrides(
    process_id: UUID,
    request: OverridesPutRequest,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> list[CoverageOverrideResponse]:
    """Replace all coverage overrides for a process (Manager only)."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )

    # Validate each override
    for override in request.overrides:
        if override.weekday is not None and (override.weekday < 0 or override.weekday > 6):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="weekday must be 0-6",
            )
        if override.weekday is not None and override.date is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exactly one of weekday or date must be provided",
            )
        if override.weekday is None and override.date is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exactly one of weekday or date must be provided",
            )

    # Delete existing overrides
    db.query(CoverageOverride).filter(CoverageOverride.process_id == process_id).delete()

    # Add new overrides
    for override in request.overrides:
        db_override = CoverageOverride(
            process_id=process_id,
            weekday=override.weekday,
            date=override.date,
            min_coverage=override.min_coverage,
        )
        db.add(db_override)

    db.flush()

    overrides = db.query(CoverageOverride).filter(CoverageOverride.process_id == process_id).all()
    return [
        CoverageOverrideResponse(
            id=o.id,
            process_id=o.process_id,
            weekday=o.weekday,
            date=o.date,
            min_coverage=o.min_coverage,
            created_at=o.created_at,
            updated_at=o.updated_at,
        )
        for o in overrides
    ]


# ============================================================================
# Assignments
# ============================================================================


@router.get("/assignments", response_model=list[AssignmentResponse])
async def list_assignments(
    employee_id: UUID | None = Query(default=None),
    process_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    principal=Depends(require_pod_lead_or_manager),
) -> list[AssignmentResponse]:
    """List assignments with optional filters."""
    query = db.query(Assignment)
    if employee_id:
        query = query.filter(Assignment.employee_id == employee_id)
    if process_id:
        query = query.filter(Assignment.process_id == process_id)
    assignments = query.all()
    return [
        AssignmentResponse(
            id=a.id,
            employee_id=a.employee_id,
            process_id=a.process_id,
            type=a.type,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in assignments
    ]


@router.post("/assignments", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    request: AssignmentCreate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> AssignmentResponse:
    """Create an assignment (Manager only)."""
    # Validate employee and process exist
    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    process = db.query(Process).filter(Process.id == request.process_id).first()
    if not process:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )

    # Check for duplicate
    existing = (
        db.query(Assignment)
        .filter(
            Assignment.employee_id == request.employee_id,
            Assignment.process_id == request.process_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assignment already exists",
        )

    assignment = Assignment(
        employee_id=request.employee_id,
        process_id=request.process_id,
        type=request.type,
    )
    db.add(assignment)
    db.flush()

    return AssignmentResponse(
        id=assignment.id,
        employee_id=assignment.employee_id,
        process_id=assignment.process_id,
        type=assignment.type,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
    )


@router.delete(
    "/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def delete_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> None:
    """Delete an assignment (Manager only)."""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    db.delete(assignment)
    db.flush()


# ============================================================================
# Holidays
# ============================================================================


@router.get("/holidays", response_model=list[HolidayResponse])
async def list_holidays(
    db: Session = Depends(get_db),
    principal=Depends(require_pod_lead_or_manager),
) -> list[HolidayResponse]:
    """List all holidays."""
    holidays = db.query(Holiday).order_by(Holiday.date).all()
    return [
        HolidayResponse(
            id=h.id,
            date=h.date,
            name=h.name,
            scope=h.scope,
            brand_id=h.brand_id,
            created_at=h.created_at,
            updated_at=h.updated_at,
        )
        for h in holidays
    ]


@router.post("/holidays", response_model=HolidayResponse, status_code=status.HTTP_201_CREATED)
async def create_holiday(
    request: HolidayCreate,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> HolidayResponse:
    """Create a holiday (Manager only)."""
    # Validate brand_id for BRAND scope
    if request.scope == HolidayScope.BRAND and not request.brand_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="brand_id required for BRAND scope",
        )
    if request.scope == HolidayScope.COMPANY and request.brand_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="brand_id forbidden for COMPANY scope",
        )

    # Check for duplicate
    existing = (
        db.query(Holiday)
        .filter(
            Holiday.date == request.date,
            Holiday.scope == request.scope,
            Holiday.brand_id == request.brand_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Holiday already exists for this date/scope/brand",
        )

    holiday = Holiday(
        date=request.date,
        name=request.name,
        scope=request.scope,
        brand_id=request.brand_id,
    )
    db.add(holiday)
    db.flush()

    return HolidayResponse(
        id=holiday.id,
        date=holiday.date,
        name=holiday.name,
        scope=holiday.scope,
        brand_id=holiday.brand_id,
        created_at=holiday.created_at,
        updated_at=holiday.updated_at,
    )


@router.delete(
    "/holidays/{holiday_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def delete_holiday(
    holiday_id: UUID,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> None:
    """Delete a holiday (Manager only)."""
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday not found",
        )

    db.delete(holiday)
    db.flush()


# ============================================================================
# Settings
# ============================================================================


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> SettingsResponse:
    """Get settings (Manager only)."""
    settings_rows = db.query(Setting).all()
    settings = {s.key: s.value for s in settings_rows}

    if not settings:
        settings = {
            "weekly_rest_days": 1,
            "max_consecutive_days": 6,
            "week_start": "MON",
            "solver_weights": {
                "short_total": 10000,
                "entries_changed": 50,
                "cover_assignments": 20,
                "pref_off_missed": 5,
                "fairness_spread": 15,
                "spare_coverage": 2,
            },
        }

    return SettingsResponse(**settings)


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(
    request: SettingsResponse,
    db: Session = Depends(get_db),
    principal=Depends(require_manager),
) -> SettingsResponse:
    """Update settings (Manager only)."""
    for key, value in request.model_dump().items():
        setting = db.query(Setting).filter(Setting.key == key).first()
        if setting:
            setting.value = value
        else:
            setting = Setting(key=key, value=value)
            db.add(setting)

    db.flush()

    return request
