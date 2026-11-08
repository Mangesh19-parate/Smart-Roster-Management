"""
Roster routes: generate, fetch (all views), validate, issues, entries, covers, lock, export
"""

from __future__ import annotations

import csv
import io
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_principal,
    get_db,
    rate_limit_generate,
    require_manager,
    require_pod_lead_or_manager,
)
from app.api.schemas import (
    ApprovalResponse,
    CoverageResponse,
    CoverAssignmentResponse,
    CoverRequest,
    CoverResponse,
    DemandResponse,
    DiffEntry,
    EmployeeSummary,
    EntryEditRequest,
    EntryEditResponse,
    FairnessRow,
    IssueResponse,
    LockRequest,
    LockResponse,
    PodSummary,
    RegenerateMode,
    RosterDiff,
    RosterEntryResponse,
    RosterGenerateRequest,
    RosterGenerateResponse,
    RosterRegenerateRequest,
    RosterRegenerateResponse,
    RosterResponse,
    RosterValidateRequest,
    RosterValidateResponse,
)
from app.core.security import Principal
from app.db.models import (
    DayStatus,
    Employee,
    EntrySource,
    Pod,
    Roster,
    RosterEntry,
    RosterStatus,
    UserRole,
)
from app.engine.types import CoverAssignment as EngineCoverAssignment
from app.engine.types import RosterEntry as EngineRosterEntry
from app.services.engine_service import (
    add_cover,
    get_roster_with_issues,
    persist_roster_result,
    remove_cover,
    solve_roster_for_month,
    update_entry,
    validate_roster_entries,
)

router = APIRouter(prefix="/api/v1", tags=["rosters"])


@router.post("/rosters/{month}/generate", response_model=RosterGenerateResponse)
async def generate_roster(
    month: str,
    request: RosterGenerateRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_manager),
    _rate_limit=Depends(rate_limit_generate),
) -> RosterGenerateResponse:
    """Generate a roster for the month (Manager only)."""
    # Check if roster exists and is published
    existing = db.query(Roster).filter(Roster.month == month).first()
    if existing and existing.status == RosterStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot generate: roster is published. Use /amend to make changes.",
        )

    # Solve
    result, problem = solve_roster_for_month(
        db, month, keep_locked=request.keep_locked, time_limit_s=request.time_limit_s
    )

    # Persist
    roster = persist_roster_result(db, month, result, problem, principal.user_id)
    db.commit()

    # Load employee metadata
    emp_ids = list({e.employee_id for e in roster.entries})
    employees_db = db.query(Employee).filter(Employee.id.in_(emp_ids)).all() if emp_ids else []
    pod_ids = list({e.pod_id for e in employees_db})
    pods_db = (
        {p.id: p.name for p in db.query(Pod).filter(Pod.id.in_(pod_ids)).all()} if pod_ids else {}
    )

    emp_meta_map = {
        e.id: EmployeeSummary(
            id=e.id,
            name=e.name,
            pod_id=e.pod_id,
            pod=PodSummary(id=e.pod_id, name=pods_db.get(e.pod_id, "")),
            role=e.role,
        )
        for e in employees_db
    }

    # Convert entries to response
    entries = [
        RosterEntryResponse(
            id=e.id,
            roster_id=e.roster_id,
            employee_id=e.employee_id,
            employee=emp_meta_map.get(e.employee_id),
            date=e.date,
            status=DayStatus(e.status.value),
            locked=e.locked,
            source=EntrySource(e.source.value),
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        for e in roster.entries
    ]

    covers = [
        CoverAssignmentResponse(
            id=c.id,
            roster_id=c.roster_id,
            employee_id=c.employee_id,
            process_id=c.process_id,
            date=c.date,
            source=EntrySource(c.source.value),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in roster.cover_assignments
    ]

    # Build issues from result
    issues = [
        IssueResponse(
            id=i.id,
            rule=i.rule,
            severity=i.severity,
            structural=i.structural,
            brand_id=i.brand_id,
            process_id=i.process_id,
            employee_id=i.employee_id,
            pod_id=i.pod_id,
            date=i.date,
            message=i.message,
            cause=i.cause,
            suggestion_hint=i.suggestion_hint,
        )
        for i in []  # We'll get issues from validation
    ]

    # Actually validate to get issues
    engine_entries = [
        EngineRosterEntry(
            employee_id=e.employee_id,
            date=e.date,
            status=DayStatus(e.status.value),
            locked=e.locked,
            source=EntrySource(e.source.value),
        )
        for e in roster.entries
    ]

    engine_covers = [
        EngineCoverAssignment(
            employee_id=c.employee_id,
            process_id=c.process_id,
            date=c.date,
            source=EntrySource(c.source.value),
        )
        for c in roster.cover_assignments
    ]

    validation_issues = validate_roster_entries(db, month, engine_entries, engine_covers)

    issues = [
        IssueResponse(
            id=i.id,
            rule=i.rule,
            severity=i.severity,
            structural=i.structural,
            brand_id=i.brand_id,
            process_id=i.process_id,
            employee_id=i.employee_id,
            pod_id=i.pod_id,
            date=i.date,
            message=i.message,
            cause=i.cause,
            suggestion_hint=i.suggestion_hint,
        )
        for i in validation_issues
    ]

    stats = RosterGenerateResponse.model_fields["stats"].annotation(
        status=result.status,
        objective=result.objective,
        best_bound=result.best_bound,
        gaps_total=result.gaps_total,
        gaps_unresolved_by_reason=result.gaps_unresolved_by_reason,
        solve_ms=result.solve_ms,
    )

    return RosterGenerateResponse(
        roster=RosterResponse(
            id=roster.id,
            month=roster.month,
            status=roster.status,
            generated_at=roster.generated_at,
            created_by=roster.created_by,
            created_at=roster.created_at,
            updated_at=roster.updated_at,
            entries=entries,
            covers=covers,
            employees=list(emp_meta_map.values()),
            demand=[],
            coverage=[],
            approvals=[],
        ),
        issues=issues,
        stats=stats,
    )


@router.post("/rosters/{month}/regenerate", response_model=RosterRegenerateResponse)
async def regenerate_roster(
    month: str,
    request: RosterRegenerateRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_manager),
    _rate_limit=Depends(rate_limit_generate),
) -> RosterRegenerateResponse:
    """Regenerate a roster (minimal change or full) with diff preview (T32, S11)."""
    existing = db.query(Roster).filter(Roster.month == month).first()
    if existing and existing.status == RosterStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot regenerate: roster is published. Use /amend to make changes.",
        )

    # Get issues before
    issues_before_raw = get_roster_with_issues(db, month)
    issues_before = [
        IssueResponse(
            id=i.id,
            rule=i.rule,
            severity=i.severity,
            structural=i.structural,
            brand_id=i.brand_id,
            process_id=i.process_id,
            employee_id=i.employee_id,
            pod_id=i.pod_id,
            date=i.date,
            message=i.message,
            cause=i.cause,
            suggestion_hint=i.suggestion_hint,
        )
        for i in (issues_before_raw.get("issues", []) if issues_before_raw else [])
    ]

    keep_locked = request.mode == RegenerateMode.MINIMAL_CHANGE
    result, problem = solve_roster_for_month(db, month, keep_locked=keep_locked)

    # Compute diff
    diff_entries: list[DiffEntry] = []
    old_entries_map = {}
    if existing:
        for e in existing.entries:
            old_entries_map[(e.employee_id, e.date)] = e

    for new_e in result.entries:
        old_e = old_entries_map.get((new_e.employee_id, new_e.date))
        old_status = old_e.status.value if old_e else None
        new_status = new_e.status.value
        if old_status != new_status:
            diff_entries.append(
                DiffEntry(
                    employee_id=new_e.employee_id,
                    date=new_e.date,
                    before=DayStatus(old_status) if old_status else None,
                    after=DayStatus(new_status),
                    locked=new_e.locked,
                )
            )

    diff = RosterDiff(entries=diff_entries, covers=[])

    # Validate new result to get issues after
    engine_entries = [
        EngineRosterEntry(
            employee_id=e.employee_id,
            date=e.date,
            status=DayStatus(e.status.value),
            locked=e.locked,
            source=EntrySource.SOLVER,
        )
        for e in result.entries
    ]
    engine_covers = [
        EngineCoverAssignment(
            employee_id=c.employee_id,
            process_id=c.process_id,
            date=c.date,
            source=EntrySource.SOLVER,
        )
        for c in result.covers
    ]
    validation_issues = validate_roster_entries(db, month, engine_entries, engine_covers)
    issues_after = [
        IssueResponse(
            id=i.id,
            rule=i.rule,
            severity=i.severity,
            structural=i.structural,
            brand_id=i.brand_id,
            process_id=i.process_id,
            employee_id=i.employee_id,
            pod_id=i.pod_id,
            date=i.date,
            message=i.message,
            cause=i.cause,
            suggestion_hint=i.suggestion_hint,
        )
        for i in validation_issues
    ]

    if request.save:
        persist_roster_result(db, month, result, problem, principal.user_id)
        db.commit()

    stats = RosterGenerateResponse.model_fields["stats"].annotation(
        status=result.status,
        objective=result.objective,
        best_bound=result.best_bound,
        gaps_total=result.gaps_total,
        gaps_unresolved_by_reason=result.gaps_unresolved_by_reason,
        solve_ms=result.solve_ms,
    )

    return RosterRegenerateResponse(
        diff=diff,
        issues_before=issues_before,
        issues_after=issues_after,
        stats=stats,
    )


@router.get("/rosters/{month}", response_model=RosterResponse)
async def get_roster(
    month: str,
    view: str | None = Query(default=None, pattern=r"^(company|pod|brand|process|employee)$"),
    id: UUID | None = Query(default=None, alias="id"),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> RosterResponse:
    """Fetch roster with entries, covers, demand, coverage, and issues."""
    # Enforce role-based scoping: do not trust arbitrary view/id query parameters
    effective_view = view
    effective_id = id
    if principal.role == UserRole.POD_LEAD:
        if view == "pod" and id and id != principal.pod_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Pod Lead can only view assigned pod",
            )
        effective_view = "pod"
        effective_id = principal.pod_id
    elif principal.role == UserRole.EMPLOYEE:
        if view == "employee" and id and id != principal.employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Employee can only view own roster",
            )
        effective_view = "employee"
        effective_id = principal.employee_id

    data = get_roster_with_issues(
        db,
        month,
        effective_view,
        effective_id,
        principal.role.value,
        principal.pod_id,
        principal.employee_id,
    )

    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    roster = data["roster"]
    entries = data["entries"]
    covers = data["covers"]
    demand = data["demand"]
    coverage = data["coverage"]

    # Build employee metadata map
    emp_ids = list({e.employee_id for e in entries})
    employees_db = db.query(Employee).filter(Employee.id.in_(emp_ids)).all() if emp_ids else []
    pod_ids = list({e.pod_id for e in employees_db})
    pods_db = (
        {p.id: p.name for p in db.query(Pod).filter(Pod.id.in_(pod_ids)).all()} if pod_ids else {}
    )

    emp_meta_map = {
        e.id: EmployeeSummary(
            id=e.id,
            name=e.name,
            pod_id=e.pod_id,
            pod=PodSummary(id=e.pod_id, name=pods_db.get(e.pod_id, "")),
            role=e.role,
        )
        for e in employees_db
    }

    return RosterResponse(
        id=roster.id,
        month=roster.month,
        status=roster.status,
        generated_at=roster.generated_at,
        created_by=roster.created_by,
        created_at=roster.created_at,
        updated_at=roster.updated_at,
        entries=[
            RosterEntryResponse(
                id=e.id,
                roster_id=e.roster_id,
                employee_id=e.employee_id,
                employee=emp_meta_map.get(e.employee_id),
                date=e.date,
                status=DayStatus(e.status.value),
                locked=e.locked,
                source=EntrySource(e.source.value),
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
            for e in entries
        ],
        covers=[
            CoverAssignmentResponse(
                id=c.id,
                roster_id=c.roster_id,
                employee_id=c.employee_id,
                process_id=c.process_id,
                date=c.date,
                source=EntrySource(c.source.value),
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in covers
        ],
        employees=list(emp_meta_map.values()),
        demand=[
            DemandResponse(
                process_id=proc_id,
                date=d,
                required=req,
            )
            for (proc_id, d), req in demand.items()
        ],
        coverage=[
            CoverageResponse(
                process_id=proc_id,
                date=d,
                required=demand.get((proc_id, d), 0),
                supplied=coverage["supply"].get((proc_id, d), 0),
                cover_used=coverage["cover_used"].get((proc_id, d), 0),
                shortfall=coverage["shortfalls"].get((proc_id, d), 0),
                status="fully_covered"
                if coverage["shortfalls"].get((proc_id, d), 0) == 0
                else "gap"
                if coverage["supply"].get((proc_id, d), 0) == 0
                else "at_minimum",
            )
            for (proc_id, d) in demand.keys()
        ],
        approvals=[
            ApprovalResponse(
                id=a.id,
                roster_id=a.roster_id,
                pod_id=a.pod_id,
                status=a.status,
                comment=a.comment,
                decided_by=a.decided_by,
                decided_at=a.decided_at,
                created_at=a.created_at,
                updated_at=a.updated_at,
            )
            for a in roster.approvals
        ],
    )


@router.post("/rosters/{month}/validate", response_model=RosterValidateResponse)
async def validate_roster(
    month: str,
    request: RosterValidateRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> RosterValidateResponse:
    """Validate a roster (or draft state)."""
    # Build engine entries from request or current roster
    if request.entries is not None and request.covers is not None:
        engine_entries = request.entries
        engine_covers = request.covers
    else:
        # Use current roster
        data = get_roster_with_issues(db, month)
        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Roster not found",
            )
        entries = data["entries"]
        covers = data["covers"]
        engine_entries = [
            EngineRosterEntry(
                employee_id=e.employee_id,
                date=e.date,
                status=DayStatus(e.status.value),
                locked=e.locked,
                source=EntrySource(e.source.value),
            )
            for e in entries
        ]
        engine_covers = [
            EngineCoverAssignment(
                employee_id=c.employee_id,
                process_id=c.process_id,
                date=c.date,
                source=EntrySource(c.source.value),
            )
            for c in covers
        ]

    issues = validate_roster_entries(db, month, engine_entries, engine_covers)

    # Build summary
    summary = {
        "total": len(issues),
        "errors": sum(1 for i in issues if i.severity.value == "ERROR"),
        "warnings": sum(1 for i in issues if i.severity.value == "WARNING"),
        "infos": sum(1 for i in issues if i.severity.value == "INFO"),
        "structural": sum(1 for i in issues if i.structural),
    }

    return RosterValidateResponse(
        issues=[
            IssueResponse(
                id=i.id,
                rule=i.rule,
                severity=i.severity,
                structural=i.structural,
                brand_id=i.brand_id,
                process_id=i.process_id,
                employee_id=i.employee_id,
                pod_id=i.pod_id,
                date=i.date,
                message=i.message,
                cause=i.cause,
                suggestion_hint=i.suggestion_hint,
            )
            for i in issues
        ],
        summary=summary,
    )


@router.get("/rosters/{month}/issues", response_model=list[IssueResponse])
async def list_issues(
    month: str,
    severity: str | None = Query(default=None, pattern=r"^(ERROR|WARNING|INFO)$"),
    rule: str | None = Query(default=None),
    brand_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> list[IssueResponse]:
    """List issues for a roster with filters."""
    data = get_roster_with_issues(
        db,
        month,
        principal_pod_id=principal.pod_id,
        principal_employee_id=principal.employee_id,
        principal_role=principal.role.value,
    )

    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    issues = data["issues"]

    # Apply filters
    if severity:
        issues = [i for i in issues if i.severity.value == severity]
    if rule:
        issues = [i for i in issues if i.rule.value == rule]
    if brand_id:
        issues = [i for i in issues if i.brand_id == brand_id]

    return [
        IssueResponse(
            id=i.id,
            rule=i.rule,
            severity=i.severity,
            structural=i.structural,
            brand_id=i.brand_id,
            process_id=i.process_id,
            employee_id=i.employee_id,
            pod_id=i.pod_id,
            date=i.date,
            message=i.message,
            cause=i.cause,
            suggestion_hint=i.suggestion_hint,
        )
        for i in issues
    ]


@router.patch("/rosters/{month}/entries", response_model=EntryEditResponse)
async def edit_entry(
    month: str,
    request: EntryEditRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> EntryEditResponse:
    """Edit a roster entry."""
    # Check permissions
    if principal.role.value == "POD_LEAD":
        employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
        if not employee or employee.pod_id != principal.pod_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only edit entries for your pod",
            )

    try:
        entry, issues, impact = update_entry(
            db, month, request.employee_id, request.date, request.status, request.locked
        )
        db.commit()
    except ValueError as e:
        msg = str(e)
        if "published" in msg.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        if "locked" in msg.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        if "not found" in msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    return EntryEditResponse(
        entry=RosterEntryResponse(
            id=entry.id,
            roster_id=entry.roster_id,
            employee_id=entry.employee_id,
            date=entry.date,
            status=DayStatus(entry.status.value),
            locked=entry.locked,
            source=EntrySource(entry.source.value),
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        ),
        issues=[
            IssueResponse(
                id=i.id,
                rule=i.rule,
                severity=i.severity,
                structural=i.structural,
                brand_id=i.brand_id,
                process_id=i.process_id,
                employee_id=i.employee_id,
                pod_id=i.pod_id,
                date=i.date,
                message=i.message,
                cause=i.cause,
                suggestion_hint=i.suggestion_hint,
            )
            for i in issues
        ],
        impact=impact,
    )


@router.post(
    "/rosters/{month}/covers",
    response_model=CoverResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_cover_endpoint(
    month: str,
    request: CoverRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> CoverResponse:
    """Add a cover assignment."""
    # Check permissions
    if principal.role.value == "POD_LEAD":
        employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
        if not employee or employee.pod_id != principal.pod_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only add covers for your pod",
            )

    cover, issues = add_cover(db, month, request.employee_id, request.process_id, request.date)
    db.commit()

    return CoverResponse(
        cover=CoverAssignmentResponse(
            id=cover.id,
            roster_id=cover.roster_id,
            employee_id=cover.employee_id,
            process_id=cover.process_id,
            date=cover.date,
            source=EntrySource(cover.source.value),
            created_at=cover.created_at,
            updated_at=cover.updated_at,
        ),
        issues=[
            IssueResponse(
                id=i.id,
                rule=i.rule,
                severity=i.severity,
                structural=i.structural,
                brand_id=i.brand_id,
                process_id=i.process_id,
                employee_id=i.employee_id,
                pod_id=i.pod_id,
                date=i.date,
                message=i.message,
                cause=i.cause,
                suggestion_hint=i.suggestion_hint,
            )
            for i in issues
        ],
    )


@router.delete("/rosters/{month}/covers/{cover_id}", response_model=dict)
async def delete_cover(
    month: str,
    cover_id: UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> dict:
    """Delete a cover assignment."""
    deleted, issues = remove_cover(db, month, cover_id)
    db.commit()

    return {
        "deleted": deleted,
        "issues": [
            IssueResponse(
                id=i.id,
                rule=i.rule,
                severity=i.severity,
                structural=i.structural,
                brand_id=i.brand_id,
                process_id=i.process_id,
                employee_id=i.employee_id,
                pod_id=i.pod_id,
                date=i.date,
                message=i.message,
                cause=i.cause,
                suggestion_hint=i.suggestion_hint,
            )
            for i in issues
        ],
    }


@router.post("/rosters/{month}/lock", response_model=LockResponse)
async def lock_entries(
    month: str,
    request: LockRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_manager),
) -> LockResponse:
    """Lock/unlock entries in bulk."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    query = db.query(RosterEntry).filter(RosterEntry.roster_id == roster.id)

    if request.employee_id:
        query = query.filter(RosterEntry.employee_id == request.employee_id)
    if request.from_:
        query = query.filter(RosterEntry.date >= request.from_)
    if request.to:
        query = query.filter(RosterEntry.date <= request.to)

    entries = query.all()
    for entry in entries:
        entry.locked = request.locked
        entry.updated_at = datetime.utcnow()

    db.commit()

    return LockResponse(updated=len(entries))


@router.get("/rosters/{month}/fairness", response_model=list[FairnessRow])
async def get_fairness(
    month: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> list[FairnessRow]:
    """Get fairness report for a roster."""
    data = get_roster_with_issues(db, month)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    entries = data["entries"]

    # Calculate fairness metrics per employee
    from collections import defaultdict

    work_days = defaultdict(int)
    sunday_work = defaultdict(int)
    holiday_work = defaultdict(int)
    pref_off_missed = defaultdict(int)

    for entry in entries:
        if entry.status == DayStatus.WORK:
            work_days[entry.employee_id] += 1
            if entry.date.weekday() == 6:  # Sunday
                sunday_work[entry.employee_id] += 1
            # Check holidays
            from app.db.models import Holiday

            holiday = db.query(Holiday).filter(Holiday.date == entry.date).first()
            if holiday:
                holiday_work[entry.employee_id] += 1

    # Check preferred off days
    employees = db.query(Employee).filter(Employee.id.in_(work_days.keys())).all()
    for emp in employees:
        for pref_day in emp.preferred_off_days:
            # Count work days on preferred off day
            for entry in entries:
                if entry.employee_id == emp.id and entry.status == DayStatus.WORK:
                    if entry.date.weekday() == pref_day:
                        pref_off_missed[emp.id] += 1

    # Build fairness rows
    rows = []
    for emp_id, total in work_days.items():
        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if emp:
            pod = db.query(Pod).filter(Pod.id == emp.pod_id).first()
            rows.append(
                FairnessRow(
                    employee_id=emp_id,
                    employee_name=emp.name,
                    pod_name=pod.name if pod else "Unknown",
                    total_work_days=total,
                    sunday_work_days=sunday_work.get(emp_id, 0),
                    holiday_work_days=holiday_work.get(emp_id, 0),
                    preferred_off_missed=pref_off_missed.get(emp_id, 0),
                    fairness_score=0.0,  # Simplified
                )
            )

    return rows


def _sanitize_csv_cell(value: object) -> str:
    s = str(value) if value is not None else ""
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s}"
    return s


@router.get("/rosters/{month}/export.csv")
async def export_csv(
    month: str,
    view: str | None = Query(default=None),
    id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> Response:
    """Export roster as CSV with formula-injection safety."""
    data = get_roster_with_issues(db, month, view, id)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    roster = data["roster"]
    entries = db.query(RosterEntry).filter(RosterEntry.roster_id == roster.id).all()
    employees = {e.id: e.name for e in db.query(Employee).all()}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee", "Date", "Status", "Locked"])
    for entry in sorted(entries, key=lambda x: (employees.get(x.employee_id, ""), x.date)):
        emp_name = employees.get(entry.employee_id, str(entry.employee_id))
        writer.writerow(
            [
                _sanitize_csv_cell(emp_name),
                str(entry.date),
                entry.status.value,
                str(entry.locked),
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="roster-{month}.csv"'},
    )


@router.get("/rosters/{month}/export.xlsx")
async def export_xlsx(
    month: str,
    view: str | None = Query(default=None),
    id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> Response:
    """Export roster as XLSX."""
    import openpyxl

    data = get_roster_with_issues(db, month, view, id)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    roster = data["roster"]
    entries = db.query(RosterEntry).filter(RosterEntry.roster_id == roster.id).all()
    employees = {e.id: e.name for e in db.query(Employee).all()}

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Roster {month}"
    ws.append(["Employee", "Date", "Status", "Locked"])
    for entry in sorted(entries, key=lambda x: (employees.get(x.employee_id, ""), x.date)):
        emp_name = employees.get(entry.employee_id, str(entry.employee_id))
        ws.append(
            [
                _sanitize_csv_cell(emp_name),
                str(entry.date),
                entry.status.value,
                str(entry.locked),
            ]
        )

    bio = io.BytesIO()
    wb.save(bio)
    bio.seek(0)
    return Response(
        content=bio.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="roster-{month}.xlsx"'},
    )


async def _compute_structural_issues(month: str, db: Session) -> list[IssueResponse]:
    from app.engine.feasibility import (
        AssignMissingRule,
        StructHeadcountRule,
        StructNoBackupRule,
    )
    from app.engine.validator import Validator
    from app.services.engine_service import build_problem

    problem = build_problem(db, month)
    validator = Validator(
        [
            AssignMissingRule(),
            StructHeadcountRule(),
            StructNoBackupRule(),
        ]
    )
    issues = validator.validate(problem, [], [])
    return [
        IssueResponse(
            id=i.id,
            rule=i.rule,
            severity=i.severity,
            structural=True,
            brand_id=i.brand_id,
            process_id=i.process_id,
            employee_id=i.employee_id,
            pod_id=i.pod_id,
            date=i.date,
            message=i.message,
            cause=i.cause,
            suggestion_hint=i.suggestion_hint,
        )
        for i in issues
    ]


@router.get("/structural", response_model=list[IssueResponse])
async def get_structural_report(
    month: str = Query(default="2026-12", pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> list[IssueResponse]:
    """Fetch structural issues for the company (query param month)."""
    return await _compute_structural_issues(month, db)


@router.get("/rosters/{month}/structural", response_model=list[IssueResponse])
async def get_roster_structural_report(
    month: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> list[IssueResponse]:
    """Fetch structural issues for the company (path param month)."""
    return await _compute_structural_issues(month, db)
