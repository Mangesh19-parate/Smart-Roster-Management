"""
Engine service: bridges SQLAlchemy models and the pure Python engine.

This module converts DB models to engine Problem, runs solver/validator,
and converts results back to DB models.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.schemas import ImpactResponse
from app.db.models import (
    Assignment,
    AssignmentType,
    ApprovalStatus,
    Brand,
    CalendarMode,
    CoverageOverride,
    DayStatus,
    Employee,
    EntrySource,
    Holiday,
    HolidayScope,
    Leave,
    LeaveStatus,
    LeaveType,
    Pod,
    Process,
    Roster,
    RosterApproval,
    RosterStatus,
    Setting,
)
from app.db.models import (
    CoverAssignment as DBCoverAssignment,
)
from app.db.models import (
    RosterEntry as DBRosterEntry,
)
from app.engine.rules.coverage import CovBelowMinRule, CovZeroRule
from app.engine.rules.employee import (
    CapacityExceededRule,
    CompOffUnusedRule,
    ConsecMaxRule,
    WOMissingRule,
)
from app.engine.rules.preference import (
    FairnessSpreadRule,
    PodOffClusterRule,
    PrefOffMissedRule,
)
from app.engine.solver import SolverConfig, solve_roster, solve_roster_with_previous
from app.engine.types import (
    Assignment as EngineAssignment,
)
from app.engine.types import (
    CoverAssignment as EngineCoverAssignment,
)
from app.engine.types import (
    Employee as EngineEmployee,
)
from app.engine.types import (
    Holiday as EngineHoliday,
)
from app.engine.types import (
    Issue as EngineIssue,
)
from app.engine.types import (
    Leave as EngineLeave,
)
from app.engine.types import (
    Problem as EngineProblem,
)
from app.engine.types import (
    Process as EngineProcess,
)
from app.engine.types import (
    RosterEntry as EngineRosterEntry,
)
from app.engine.types import (
    SolverResult,
)
from app.engine.validator import Validator


def _month_to_dates(month: str) -> tuple[date, date]:
    """Convert YYYY-MM string to (month_start, month_end)."""
    year, month_num = map(int, month.split("-"))
    from calendar import monthrange
    _, last_day = monthrange(year, month_num)
    return date(year, month_num, 1), date(year, month_num, last_day)


def build_problem(
    db: Session,
    month: str,
    view: str | None = None,
    view_id: UUID | None = None,
    principal_pod_id: UUID | None = None,
    principal_employee_id: UUID | None = None,
    principal_role: str | None = None,
) -> EngineProblem:
    """
    Build an engine Problem from database for the given month and view.

    View filtering applies ownership rules in the query:
    - MANAGER: all data
    - POD_LEAD: only their pod
    - EMPLOYEE: only their own data
    """
    month_start, month_end = _month_to_dates(month)

    # Build base query for employees with view filtering
    emp_query = db.query(Employee).filter(Employee.active)

    if view == "pod" and view_id:
        emp_query = emp_query.filter(Employee.pod_id == view_id)
    elif view == "employee" and view_id:
        emp_query = emp_query.filter(Employee.id == view_id)
    elif principal_role == "POD_LEAD" and principal_pod_id:
        emp_query = emp_query.filter(Employee.pod_id == principal_pod_id)
    elif principal_role == "EMPLOYEE" and principal_employee_id:
        emp_query = emp_query.filter(Employee.id == principal_employee_id)

    employees = emp_query.all()

    # Get employee IDs for filtering related data
    emp_ids = [e.id for e in employees]

    # Build employees
    engine_employees = [
        EngineEmployee(
            id=e.id,
            name=e.name,
            pod_id=e.pod_id,
            role=e.role.value,
            preferred_off_days=list(e.preferred_off_days or []),
            max_consecutive_days=e.max_consecutive_days,
            max_cover_per_day=e.max_cover_per_day,
            active=e.active,
        )
        for e in employees
    ]

    # Get pods for these employees
    pod_ids = list(set(e.pod_id for e in employees))
    _ = db.query(Pod).filter(Pod.id.in_(pod_ids)).all()  # Not used in engine directly

    # Get brands and processes
    # First get process IDs from assignments of these employees
    proc_ids = db.query(Assignment.process_id).filter(Assignment.employee_id.in_(emp_ids)).distinct().all()
    proc_ids = [p[0] for p in proc_ids]

    processes = db.query(Process).filter(Process.id.in_(proc_ids)).all() if proc_ids else []
    brand_ids = list(set(p.brand_id for p in processes))
    brands = db.query(Brand).filter(Brand.id.in_(brand_ids)).all()

    # Build processes
    engine_processes = [
        EngineProcess(
            id=p.id,
            brand_id=p.brand_id,
            name=p.name,
            calendar_mode=CalendarMode(p.calendar_mode.value),
            min_coverage=p.min_coverage,
        )
        for p in processes
    ]

    # Build brands (not directly used in engine)
    _ = [
        EngineEmployee(  # Using Employee as placeholder, not used
            id=b.id,
            name=b.name,
            pod_id=UUID(int=0),
            role="",
            preferred_off_days=[],
            max_consecutive_days=0,
            max_cover_per_day=0,
            active=b.active,
        )
        for b in brands
    ]

    # Coverage overrides
    override_query = db.query(CoverageOverride).filter(
        CoverageOverride.process_id.in_(proc_ids)
    ) if proc_ids else db.query(CoverageOverride).filter(False)
    overrides = override_query.all()
    engine_overrides = [
        EngineProcess(  # Using Process as placeholder
            id=o.id,
            brand_id=UUID(int=0),
            name="",
            calendar_mode=CalendarMode.ALL_365,
            min_coverage=o.min_coverage,
        )
        for o in overrides
    ]
    # Actually build proper CoverageOverride engine types
    from app.engine.types import CoverageOverride as EngineCoverageOverride
    engine_overrides = [
        EngineCoverageOverride(
            process_id=o.process_id,
            weekday=o.weekday,
            date=o.date,
            min_coverage=o.min_coverage,
        )
        for o in overrides
    ]

    # Assignments
    assignment_query = db.query(Assignment).filter(Assignment.employee_id.in_(emp_ids))
    assignments = assignment_query.all()
    engine_assignments = [
        EngineAssignment(
            employee_id=a.employee_id,
            process_id=a.process_id,
            type=AssignmentType(a.type.value),
        )
        for a in assignments
    ]

    # Holidays in month
    holidays = db.query(Holiday).filter(
        and_(Holiday.date >= month_start, Holiday.date <= month_end)
    ).all()
    engine_holidays = [
        EngineHoliday(
            date=h.date,
            name=h.name,
            scope=HolidayScope(h.scope.value),
            brand_id=h.brand_id,
        )
        for h in holidays
    ]

    # Leaves (only APPROVED block days)
    leave_query = db.query(Leave).filter(
        and_(
            Leave.employee_id.in_(emp_ids),
            Leave.status == LeaveStatus.APPROVED,
            Leave.start_date <= month_end,
            Leave.end_date >= month_start,
        )
    )
    leaves = leave_query.all()
    engine_leaves = [
        EngineLeave(
            employee_id=leave.employee_id,
            start_date=leave.start_date,
            end_date=leave.end_date,
            type=LeaveType(leave.type.value),
            status=LeaveStatus(leave.status.value),
        )
        for leave in leaves
    ]

    # Settings
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

    return EngineProblem(
        month_start=month_start,
        month_end=month_end,
        employees=engine_employees,
        pods=[],  # Not used directly
        brands=[],  # Not used directly
        processes=engine_processes,
        coverage_overrides=engine_overrides,
        assignments=engine_assignments,
        holidays=engine_holidays,
        leaves=engine_leaves,
        settings=settings,
    )


def get_existing_roster_entries(
    db: Session,
    month: str,
    emp_ids: list[UUID],
) -> list[EngineRosterEntry]:
    """Get existing roster entries for a month (for minimal-change mode)."""
    month_start, month_end = _month_to_dates(month)
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        return []

    entries = db.query(DBRosterEntry).filter(
        and_(
            DBRosterEntry.roster_id == roster.id,
            DBRosterEntry.employee_id.in_(emp_ids),
        )
    ).all()

    return [
        EngineRosterEntry(
            employee_id=e.employee_id,
            date=e.date,
            status=DayStatus(e.status.value),
            locked=e.locked,
            source=EntrySource(e.source.value),
        )
        for e in entries
    ]


def get_existing_covers(
    db: Session,
    month: str,
    emp_ids: list[UUID],
) -> list[EngineCoverAssignment]:
    """Get existing cover assignments for a month."""
    month_start, month_end = _month_to_dates(month)
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        return []

    covers = db.query(DBCoverAssignment).filter(
        and_(
            DBCoverAssignment.roster_id == roster.id,
            DBCoverAssignment.employee_id.in_(emp_ids),
        )
    ).all()

    return [
        EngineCoverAssignment(
            employee_id=c.employee_id,
            process_id=c.process_id,
            date=c.date,
            source=EntrySource(c.source.value),
        )
        for c in covers
    ]


def solve_roster_for_month(
    db: Session,
    month: str,
    keep_locked: bool = True,
    time_limit_s: float | None = None,
) -> tuple[SolverResult, EngineProblem]:
    """
    Generate a roster for the month.

    Returns (SolverResult, Problem) for further processing.
    """
    problem = build_problem(db, month)

    if keep_locked:
        emp_ids = [e.id for e in problem.employees]
        prev_entries = get_existing_roster_entries(db, month, emp_ids)
        prev_covers = get_existing_covers(db, month, emp_ids)
        config = SolverConfig(max_time_seconds=time_limit_s or 15.0)
        result = solve_roster_with_previous(problem, prev_entries, prev_covers, config)
    else:
        config = SolverConfig(max_time_seconds=time_limit_s or 15.0)
        result = solve_roster(problem, config)

    return result, problem


def validate_roster_entries(
    db: Session,
    month: str,
    entries: list[EngineRosterEntry],
    covers: list[EngineCoverAssignment],
) -> list[EngineIssue]:
    """Validate roster entries using the full validator."""
    problem = build_problem(db, month)

    # Build full validator with all rules
    validator = Validator([
        CovZeroRule(),
        CovBelowMinRule(),
        WOMissingRule(),
        ConsecMaxRule(),
        CapacityExceededRule(),
        CompOffUnusedRule(),
        PrefOffMissedRule(),
        FairnessSpreadRule(),
        PodOffClusterRule(),
    ])

    return validator.validate(problem, entries, covers)


def persist_roster_result(
    db: Session,
    month: str,
    result: SolverResult,
    problem: EngineProblem,
    created_by: UUID | None = None,
) -> Roster:
    """Persist solver result to database."""
    # Create or get roster
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        roster = Roster(
            month=month,
            status=RosterStatus.DRAFT,
            generated_at=datetime.utcnow(),
            created_by=created_by,
        )
        db.add(roster)
        db.flush()
    else:
        # Clear existing entries and covers
        db.query(DBRosterEntry).filter(DBRosterEntry.roster_id == roster.id).delete()
        db.query(DBCoverAssignment).filter(DBCoverAssignment.roster_id == roster.id).delete()
        roster.status = RosterStatus.DRAFT
        roster.generated_at = datetime.utcnow()
        roster.created_by = created_by

    # Persist entries
    for entry in result.entries:
        db_entry = DBRosterEntry(
            roster_id=roster.id,
            employee_id=entry.employee_id,
            date=entry.date,
            status=entry.status,
            locked=entry.locked,
            source=entry.source,
        )
        db.add(db_entry)

    # Persist covers
    for cover in result.covers:
        db_cover = DBCoverAssignment(
            roster_id=roster.id,
            employee_id=cover.employee_id,
            process_id=cover.process_id,
            date=cover.date,
            source=cover.source,
        )
        db.add(db_cover)

    db.flush()
    return roster


def get_roster_with_issues(
    db: Session,
    month: str,
    view: str | None = None,
    view_id: UUID | None = None,
    principal_role: str | None = None,
    principal_pod_id: UUID | None = None,
    principal_employee_id: UUID | None = None,
) -> dict[str, Any]:
    """Get roster with entries, covers, demand, coverage, and issues."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        return None

    # Build problem with view filtering
    problem = build_problem(
        db, month, view, view_id,
        principal_pod_id, principal_employee_id, principal_role
    )

    # Get entries
    emp_ids = [e.id for e in problem.employees]
    entries = db.query(DBRosterEntry).filter(
        and_(
            DBRosterEntry.roster_id == roster.id,
            DBRosterEntry.employee_id.in_(emp_ids),
        )
    ).all()

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

    # Get covers
    covers = db.query(DBCoverAssignment).filter(
        and_(
            DBCoverAssignment.roster_id == roster.id,
            DBCoverAssignment.employee_id.in_(emp_ids),
        )
    ).all()

    engine_covers = [
        EngineCoverAssignment(
            employee_id=c.employee_id,
            process_id=c.process_id,
            date=c.date,
            source=EntrySource(c.source.value),
        )
        for c in covers
    ]

    # Calculate demand and coverage
    from app.engine.coverage import calculate_coverage
    from app.engine.demand import build_demand_grid

    demand_grid = build_demand_grid(problem)
    coverage = calculate_coverage(
        engine_entries, engine_covers, problem.assignments, problem.processes, demand_grid
    )

    # Validate
    issues = validate_roster_entries(db, month, engine_entries, engine_covers)

    return {
        "roster": roster,
        "entries": entries,
        "covers": covers,
        "demand": demand_grid,
        "coverage": coverage,
        "issues": issues,
    }


def update_entry(
    db: Session,
    month: str,
    employee_id: UUID,
    entry_date: date,
    status: DayStatus,
    locked: bool | None = None,
) -> tuple[DBRosterEntry, list[EngineIssue], ImpactResponse]:
    """Update a single roster entry and return updated entry, issues, and impact."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise ValueError("Roster not found")

    # Check roster status
    if roster.status == RosterStatus.PUBLISHED:
        raise ValueError("Cannot edit published roster; use /amend")

    entry = db.query(DBRosterEntry).filter(
        and_(
            DBRosterEntry.roster_id == roster.id,
            DBRosterEntry.employee_id == employee_id,
            DBRosterEntry.date == entry_date,
        )
    ).first()

    if not entry:
        raise ValueError("Entry not found")

    # Check if locked
    if entry.locked and locked is not False:
        raise ValueError("Entry is locked; unlock first")

    # Store old state for impact
    _ = entry.status
    _ = entry.locked

    # Update
    entry.status = status
    if locked is not None:
        entry.locked = locked
    entry.updated_at = datetime.utcnow()

    # Reset affected pod's approval if roster is IN_REVIEW
    if roster.status == RosterStatus.IN_REVIEW:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if emp and emp.pod_id:
            pod_approval = db.query(RosterApproval).filter(
                and_(
                    RosterApproval.roster_id == roster.id,
                    RosterApproval.pod_id == emp.pod_id,
                )
            ).first()
            if pod_approval:
                pod_approval.status = ApprovalStatus.PENDING
                pod_approval.comment = None
                pod_approval.decided_by = None
                pod_approval.decided_at = None

    # Validate
    _ = build_problem(db, month)
    entries = db.query(DBRosterEntry).filter(DBRosterEntry.roster_id == roster.id).all()
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

    covers = db.query(DBCoverAssignment).filter(DBCoverAssignment.roster_id == roster.id).all()
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

    # Calculate impact (diff from previous validation)
    # For now, return all issues as new_issues
    from app.api.schemas import ImpactResponse, IssueResponse

    impact = ImpactResponse(
        new_issues=[
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
        resolved_issues=[],
        affected_brands=list(set(str(i.brand_id) for i in issues if i.brand_id)),
    )

    db.flush()
    return entry, issues, impact


def add_cover(
    db: Session,
    month: str,
    employee_id: UUID,
    process_id: UUID,
    date: date,
) -> tuple[DBCoverAssignment, list[EngineIssue]]:
    """Add a cover assignment."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise ValueError("Roster not found")

    # Check if employee is working on that date
    entry = db.query(DBRosterEntry).filter(
        and_(
            DBRosterEntry.roster_id == roster.id,
            DBRosterEntry.employee_id == employee_id,
            DBRosterEntry.date == date,
        )
    ).first()

    if not entry or entry.status != DayStatus.WORK:
        raise ValueError("Employee must be working on that date to cover")

    # Check if cover already exists
    existing = db.query(DBCoverAssignment).filter(
        and_(
            DBCoverAssignment.roster_id == roster.id,
            DBCoverAssignment.employee_id == employee_id,
            DBCoverAssignment.process_id == process_id,
            DBCoverAssignment.date == date,
        )
    ).first()

    if existing:
        raise ValueError("Cover already exists")

    # Check capacity
    covers_on_day = db.query(DBCoverAssignment).filter(
        and_(
            DBCoverAssignment.roster_id == roster.id,
            DBCoverAssignment.employee_id == employee_id,
            DBCoverAssignment.date == date,
        )
    ).count()

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if covers_on_day >= employee.max_cover_per_day:
        raise ValueError("Employee cover capacity exceeded for this date")

    cover = DBCoverAssignment(
        roster_id=roster.id,
        employee_id=employee_id,
        process_id=process_id,
        date=date,
        source=EntrySource.MANUAL,
    )
    db.add(cover)
    db.flush()

    # Validate
    _ = build_problem(db, month)
    entries = db.query(DBRosterEntry).filter(DBRosterEntry.roster_id == roster.id).all()
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

    covers_all = db.query(DBCoverAssignment).filter(DBCoverAssignment.roster_id == roster.id).all()
    engine_covers = [
        EngineCoverAssignment(
            employee_id=c.employee_id,
            process_id=c.process_id,
            date=c.date,
            source=EntrySource(c.source.value),
        )
        for c in covers_all
    ]

    issues = validate_roster_entries(db, month, engine_entries, engine_covers)

    return cover, issues


def remove_cover(
    db: Session,
    month: str,
    cover_id: UUID,
) -> tuple[bool, list[EngineIssue]]:
    """Remove a cover assignment."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise ValueError("Roster not found")

    cover = db.query(DBCoverAssignment).filter(
        and_(
            DBCoverAssignment.roster_id == roster.id,
            DBCoverAssignment.id == cover_id,
        )
    ).first()

    if not cover:
        return False, []

    db.delete(cover)
    db.flush()

    # Validate
    _ = build_problem(db, month)
    entries = db.query(DBRosterEntry).filter(DBRosterEntry.roster_id == roster.id).all()
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

    covers_all = db.query(DBCoverAssignment).filter(DBCoverAssignment.roster_id == roster.id).all()
    engine_covers = [
        EngineCoverAssignment(
            employee_id=c.employee_id,
            process_id=c.process_id,
            date=c.date,
            source=EntrySource(c.source.value),
        )
        for c in covers_all
    ]

    issues = validate_roster_entries(db, month, engine_entries, engine_covers)

    return True, issues


def get_impact_preview(
    db: Session,
    month: str,
    employee_id: UUID,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:
    """Get impact preview for a leave request."""
    # Build problem
    problem = build_problem(db, month)

    # Get current roster entries
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        current_entries = []
        current_covers = []
    else:
        entries = db.query(DBRosterEntry).filter(DBRosterEntry.roster_id == roster.id).all()
        current_entries = [
            EngineRosterEntry(
                employee_id=e.employee_id,
                date=e.date,
                status=DayStatus(e.status.value),
                locked=e.locked,
                source=EntrySource(e.source.value),
            )
            for e in entries
        ]

        covers = db.query(DBCoverAssignment).filter(DBCoverAssignment.roster_id == roster.id).all()
        current_covers = [
            EngineCoverAssignment(
                employee_id=c.employee_id,
                process_id=c.process_id,
                date=c.date,
                source=EntrySource(c.source.value),
            )
            for c in covers
        ]

    # Validate current state
    current_issues = validate_roster_entries(db, month, current_entries, current_covers)

    # Create simulated leave
    from app.engine.types import Leave as EngineLeave
    from app.engine.types import LeaveStatus, LeaveType
    simulated_leave = EngineLeave(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        type=LeaveType.PLANNED,
        status=LeaveStatus.APPROVED,
    )

    # Build problem with simulated leave
    problem_with_leave = EngineProblem(
        month_start=problem.month_start,
        month_end=problem.month_end,
        employees=problem.employees,
        pods=problem.pods,
        brands=problem.brands,
        processes=problem.processes,
        coverage_overrides=problem.coverage_overrides,
        assignments=problem.assignments,
        holidays=problem.holidays,
        leaves=problem.leaves + [simulated_leave],
        settings=problem.settings,
    )

    # Get current entries (employee will be blocked on leave days)
    # Note: the validator will see the leave and mark those days as blocked

    # Validate with simulated leave
    simulated_issues = validate_roster_entries(db, month, current_entries, current_covers)

    # Actually need to re-validate with the leave in problem
    # The validator uses problem.leaves to determine blocked days
    # Let's create a new validator run with the updated problem

    from app.engine.rules.coverage import CovBelowMinRule, CovZeroRule
    from app.engine.rules.employee import (
        CapacityExceededRule,
        CompOffUnusedRule,
        ConsecMaxRule,
        WOMissingRule,
    )
    from app.engine.rules.preference import FairnessSpreadRule, PodOffClusterRule, PrefOffMissedRule
    from app.engine.validator import Validator

    validator = Validator([
        CovZeroRule(),
        CovBelowMinRule(),
        WOMissingRule(),
        ConsecMaxRule(),
        CapacityExceededRule(),
        CompOffUnusedRule(),
        PrefOffMissedRule(),
        FairnessSpreadRule(),
        PodOffClusterRule(),
    ])

    simulated_issues = validator.validate(problem_with_leave, current_entries, current_covers)

    # Calculate diff
    current_issue_ids = {i.id for i in current_issues}
    simulated_issue_ids = {i.id for i in simulated_issues}

    new_issues = [i for i in simulated_issues if i.id not in current_issue_ids]
    resolved_issues = [i for i in current_issues if i.id not in simulated_issue_ids]

    from app.api.schemas import ImpactResponse, IssueResponse

    return ImpactResponse(
        new_issues=[
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
            for i in new_issues
        ],
        resolved_issues=[
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
            for i in resolved_issues
        ],
        affected_brands=list(set(str(i.brand_id) for i in new_issues if i.brand_id)),
    )


def generate_suggestions(
    db: Session,
    month: str,
    issue_ids: list[str],
) -> list[dict[str, Any]]:
    """
    Generate suggestions for given issues.
    This is a simplified implementation - the full version would try multiple
    strategies and rank them.
    """
    # Get current roster state
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        return []

    problem = build_problem(db, month)

    entries = db.query(DBRosterEntry).filter(DBRosterEntry.roster_id == roster.id).all()
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

    covers = db.query(DBCoverAssignment).filter(DBCoverAssignment.roster_id == roster.id).all()
    engine_covers = [
        EngineCoverAssignment(
            employee_id=c.employee_id,
            process_id=c.process_id,
            date=c.date,
            source=EntrySource(c.source.value),
        )
        for c in covers
    ]

    # Get issues
    all_issues = validate_roster_entries(db, month, engine_entries, engine_covers)
    target_issues = [i for i in all_issues if i.id in issue_ids]

    suggestions = []

    for issue in target_issues:
        if issue.rule.value == "COV_ZERO":
            # Try to find a backup who can cover
            if issue.process_id and issue.date:
                # Find BACKUP assignments for this process
                backup_assignments = [
                    a for a in problem.assignments
                    if str(a.process_id) == str(issue.process_id)
                    and a.type.value == "BACKUP"
                ]

                for ba in backup_assignments:
                    # Check if backup is working on that day
                    backup_entry = next(
                        (e for e in engine_entries
                         if e.employee_id == ba.employee_id and e.date == issue.date
                         and e.status == DayStatus.WORK),
                        None
                    )
                    if backup_entry:
                        # Check if already covering
                        existing_cover = next(
                            (c for c in engine_covers
                             if c.employee_id == ba.employee_id
                             and c.process_id == ba.process_id
                             and c.date == issue.date),
                            None
                        )
                        if not existing_cover:
                            suggestions.append({
                                "id": f"sugg_{issue.id}_cover_{ba.employee_id}",
                                "kind": "ADD_COVER",
                                "description": f"Add {ba.employee_id} as cover for {issue.process_id} on {issue.date}",
                                "fixes": [issue],
                                "may_break": [],
                                "entries_changed": 0,
                                "fairness_delta": 0.0,
                                "actions": [{
                                    "type": "ADD_COVER",
                                    "employee_id": str(ba.employee_id),
                                    "process_id": str(ba.process_id),
                                    "date": issue.date.isoformat(),
                                }],
                            })

        elif issue.rule.value == "WO_MISSING":
            # Suggest shifting a rest day
            pass  # More complex, simplified for now

    return suggestions


def apply_suggestion(
    db: Session,
    month: str,
    suggestion: dict[str, Any],
) -> tuple[list[EngineRosterEntry], list[EngineCoverAssignment], list[EngineIssue]]:
    """Apply a suggestion and return new state with issues."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise ValueError("Roster not found")

    # Apply actions
    for action in suggestion.get("actions", []):
        if action["type"] == "ADD_COVER":
            cover = DBCoverAssignment(
                roster_id=roster.id,
                employee_id=UUID(action["employee_id"]),
                process_id=UUID(action["process_id"]),
                date=date.fromisoformat(action["date"]),
                source=EntrySource.SUGGESTION,
            )
            db.add(cover)

    db.flush()

    # Re-validate
    _ = build_problem(db, month)
    entries = db.query(DBRosterEntry).filter(DBRosterEntry.roster_id == roster.id).all()
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

    covers = db.query(DBCoverAssignment).filter(DBCoverAssignment.roster_id == roster.id).all()
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

    return engine_entries, engine_covers, issues