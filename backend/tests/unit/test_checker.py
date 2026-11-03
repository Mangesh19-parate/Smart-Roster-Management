"""Tests for the independent brute-force checker."""

from datetime import date
from uuid import uuid4

from app.engine.checker import check_coverage_independent, compute_coverage_brute_force
from app.engine.rules.coverage import CovBelowMinRule, CovZeroRule
from app.engine.types import (
    Assignment,
    AssignmentType,
    CalendarMode,
    CoverAssignment,
    DayStatus,
    Employee,
    EmployeeRole,
    EntrySource,
    Problem,
    Process,
    RosterEntry,
    RuleID,
)
from app.engine.validator import Validator


def make_basic_problem() -> Problem:
    """Create a basic problem for testing."""
    emp_id = uuid4()
    proc_id = uuid4()
    brand_id = uuid4()
    pod_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Test Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode=CalendarMode.ALL_365,
        min_coverage=1,
    )

    assignment = Assignment(employee_id=emp_id, process_id=proc_id, type=AssignmentType.PRIMARY)

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[assignment],
        holidays=[],
        leaves=[],
        settings={"weekly_rest_days": 1, "max_consecutive_days": 6},
        demand_grid=None,
    )
    # Build demand grid
    from app.engine.demand import build_demand_grid
    return Problem(
        month_start=problem.month_start,
        month_end=problem.month_end,
        employees=problem.employees,
        pods=problem.pods,
        brands=problem.brands,
        processes=problem.processes,
        coverage_overrides=problem.coverage_overrides,
        assignments=problem.assignments,
        holidays=problem.holidays,
        leaves=problem.leaves,
        settings=problem.settings,
        demand_grid=build_demand_grid(problem),
    )


def make_full_month_entries(problem: Problem, emp_id: uuid4, default_status: DayStatus = DayStatus.WORK) -> list[RosterEntry]:
    """Create entries for all days in the month."""
    from app.engine.lib.dates import days_in_range
    entries = []
    for d in days_in_range(problem.month_start, problem.month_end):
        entries.append(RosterEntry(
            employee_id=emp_id,
            date=d,
            status=default_status,
            locked=False,
            source=EntrySource.GENERATED,
        ))
    return entries


def test_brute_force_coverage_matches_validator() -> None:
    """Test that brute-force checker matches validator on fully covered roster."""
    problem = make_basic_problem()
    emp_id = problem.employees[0].id

    # Employee works all days
    entries = make_full_month_entries(problem, emp_id)

    # Run validator
    validator = Validator([
        CovZeroRule(),
        CovBelowMinRule(),
    ])
    validator_issues = validator.validate(problem, entries, {})

    # Run independent checker
    check_result = check_coverage_independent(problem, entries, [], validator_issues)

    # Should match (no gaps)
    assert check_result.matches_validator
    assert check_result.total_gaps == 0
    assert len(check_result.discrepancies) == 0


def test_brute_force_detects_cov_zero() -> None:
    """Test checker detects COV_ZERO when employee on leave."""
    problem = make_basic_problem()
    emp_id = problem.employees[0].id

    # Employee on leave Dec 15
    entries = make_full_month_entries(problem, emp_id)
    entries[14] = RosterEntry(  # Dec 15 (0-indexed from Dec 1)
        employee_id=emp_id,
        date=date(2026, 12, 15),
        status=DayStatus.LEAVE,
        locked=False,
        source=EntrySource.GENERATED,
    )

    # Run validator
    validator = Validator([
        CovZeroRule(),
        CovBelowMinRule(),
    ])
    validator_issues = validator.validate(problem, entries, {})

    # Run checker
    check_result = check_coverage_independent(problem, entries, [], validator_issues)

    # Should match
    assert check_result.matches_validator
    assert check_result.total_gaps == 1
    assert len(check_result.checker_issues) == 1
    assert check_result.checker_issues[0].rule == RuleID.COV_ZERO


def test_brute_force_detects_cov_below_min() -> None:
    """Test checker detects COV_BELOW_MIN when coverage < required."""
    emp_id = uuid4()
    proc_id = uuid4()
    brand_id = uuid4()
    pod_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Test Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode=CalendarMode.ALL_365,
        min_coverage=2,  # Need 2
    )

    assignment = Assignment(employee_id=emp_id, process_id=proc_id, type=AssignmentType.PRIMARY)

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[assignment],
        holidays=[],
        leaves=[],
        settings={"weekly_rest_days": 1, "max_consecutive_days": 6},
        demand_grid=None,
    )
    from app.engine.demand import build_demand_grid
    problem = Problem(
        month_start=problem.month_start,
        month_end=problem.month_end,
        employees=problem.employees,
        pods=problem.pods,
        brands=problem.brands,
        processes=problem.processes,
        coverage_overrides=problem.coverage_overrides,
        assignments=problem.assignments,
        holidays=problem.holidays,
        leaves=problem.leaves,
        settings=problem.settings,
        demand_grid=build_demand_grid(problem),
    )

    # Employee works all days (only 1 person for 2 required)
    entries = make_full_month_entries(problem, emp_id)

    # Run validator
    validator = Validator([
        CovZeroRule(),
        CovBelowMinRule(),
    ])
    validator_issues = validator.validate(problem, entries, {})

    # Run checker
    check_result = check_coverage_independent(problem, entries, [], validator_issues)

    # Should match
    assert check_result.matches_validator
    assert check_result.total_gaps == 31  # 31 days * 1 gap each
    assert len(check_result.checker_issues) == 31
    assert all(i.rule == RuleID.COV_BELOW_MIN for i in check_result.checker_issues)


def test_brute_force_with_backup_cover() -> None:
    """Test checker with backup cover resolving COV_ZERO."""
    emp_id = uuid4()
    backup_id = uuid4()
    proc_id = uuid4()
    brand_id = uuid4()
    pod_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    backup = Employee(
        id=backup_id,
        name="Backup",
        pod_id=pod_id,
        role=EmployeeRole.FLOATER,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode=CalendarMode.ALL_365,
        min_coverage=1,
    )

    primary_assignment = Assignment(employee_id=emp_id, process_id=proc_id, type=AssignmentType.PRIMARY)
    backup_assignment = Assignment(employee_id=backup_id, process_id=proc_id, type=AssignmentType.BACKUP)

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee, backup],
        pods=[],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[primary_assignment, backup_assignment],
        holidays=[],
        leaves=[],
        settings={"weekly_rest_days": 1, "max_consecutive_days": 6},
        demand_grid=None,
    )
    from app.engine.demand import build_demand_grid
    problem = Problem(
        month_start=problem.month_start,
        month_end=problem.month_end,
        employees=problem.employees,
        pods=problem.pods,
        brands=problem.brands,
        processes=problem.processes,
        coverage_overrides=problem.coverage_overrides,
        assignments=problem.assignments,
        holidays=problem.holidays,
        leaves=problem.leaves,
        settings=problem.settings,
        demand_grid=build_demand_grid(problem),
    )

    # Primary on leave Dec 15, backup covers
    entries = make_full_month_entries(problem, emp_id)
    entries[14] = RosterEntry(  # Dec 15
        employee_id=emp_id,
        date=date(2026, 12, 15),
        status=DayStatus.LEAVE,
        locked=False,
        source=EntrySource.GENERATED,
    )

    # Backup works Dec 15
    backup_entries = make_full_month_entries(problem, backup_id)
    backup_entries[14] = RosterEntry(
        employee_id=backup_id,
        date=date(2026, 12, 15),
        status=DayStatus.WORK,
        locked=False,
        source=EntrySource.GENERATED,
    )
    entries.extend(backup_entries)

    # Cover assignment
    covers = [CoverAssignment(
        employee_id=backup_id,
        process_id=proc_id,
        date=date(2026, 12, 15),
        source=EntrySource.GENERATED,
    )]

    # Run validator
    validator = Validator([
        CovZeroRule(),
        CovBelowMinRule(),
    ])
    validator_issues = validator.validate(problem, entries, covers)

    # Run checker
    check_result = check_coverage_independent(problem, entries, covers, validator_issues)

    # Should match - no gaps
    assert check_result.matches_validator
    assert check_result.total_gaps == 0


def test_compute_coverage_brute_force() -> None:
    """Test the raw coverage computation function."""
    problem = make_basic_problem()
    emp_id = problem.employees[0].id

    entries = make_full_month_entries(problem, emp_id)

    supply = compute_coverage_brute_force(problem, entries, [])

    # Should have 31 days of supply = 1
    assert len(supply) == 31
    for d in supply:
        assert supply[d] == 1