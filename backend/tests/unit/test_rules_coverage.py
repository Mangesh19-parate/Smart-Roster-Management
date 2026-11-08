from datetime import date
from uuid import uuid4

from app.engine.demand import build_demand_grid
from app.engine.lib.dates import days_in_range
from app.engine.rules.coverage import CovBelowMinRule, CovZeroRule
from app.engine.types import (
    Assignment,
    AssignmentType,
    CoverAssignment,
    DayStatus,
    Employee,
    EmployeeRole,
    EntrySource,
    Problem,
    Process,
    RosterEntry,
)


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
        calendar_mode="ALL_365",
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
    return problem


def make_full_month_entries(
    emp_id: uuid4, problem: Problem, default_status: DayStatus = DayStatus.WORK
) -> dict:
    """Create entries for all days in the month."""
    entries = {}
    for d in days_in_range(problem.month_start, problem.month_end):
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=default_status,
            locked=False,
            source=EntrySource.GENERATED,
        )
    return entries


def test_cov_zero_when_employee_on_leave() -> None:
    """COV_ZERO when sole employee on leave."""
    problem = make_basic_problem()
    emp_id = problem.employees[0].id
    proc_id = problem.processes[0].id

    # Employee works all days except Dec 15 (on leave)
    entries = make_full_month_entries(emp_id, problem)
    entries[(str(emp_id), date(2026, 12, 15))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 15),
        status=DayStatus.LEAVE,
        locked=False,
        source=EntrySource.GENERATED,
    )

    rule = CovZeroRule()
    issues = rule.check(problem, entries, {})

    # Should only flag Dec 15
    assert len(issues) == 1
    assert issues[0].rule.value == "COV_ZERO"
    assert issues[0].severity.value == "ERROR"
    assert issues[0].process_id == proc_id
    assert issues[0].date == date(2026, 12, 15)
    assert "leave" in issues[0].cause.lower()


def test_cov_zero_when_employee_on_wo() -> None:
    """COV_ZERO when sole employee on weekly off."""
    problem = make_basic_problem()
    emp_id = problem.employees[0].id

    # Employee works all days except Dec 15 (weekly off)
    entries = make_full_month_entries(emp_id, problem)
    entries[(str(emp_id), date(2026, 12, 15))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 15),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )

    rule = CovZeroRule()
    issues = rule.check(problem, entries, {})

    # Should only flag Dec 15
    assert len(issues) == 1
    assert issues[0].rule.value == "COV_ZERO"
    assert "weekly off" in issues[0].cause.lower()


def test_cov_zero_when_employee_on_ph() -> None:
    """COV_ZERO when sole employee on public holiday."""
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
        calendar_mode="ALL_365",
        min_coverage=1,
    )

    assignment = Assignment(employee_id=emp_id, process_id=proc_id, type=AssignmentType.PRIMARY)

    # No holiday in problem - process is open on Dec 25
    # Employee is on PH (public holiday) but process still needs coverage

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

    # Employee works all days except Dec 25 (public holiday)
    entries = make_full_month_entries(emp_id, problem)
    entries[(str(emp_id), date(2026, 12, 25))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 25),
        status=DayStatus.PH,
        locked=False,
        source=EntrySource.GENERATED,
    )

    rule = CovZeroRule()
    issues = rule.check(problem, entries, {})

    # Should only flag Dec 25
    assert len(issues) == 1
    assert issues[0].rule.value == "COV_ZERO"
    assert "holiday" in issues[0].cause.lower()


def test_cov_below_min() -> None:
    """COV_BELOW_MIN when coverage exists but below minimum."""
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
        calendar_mode="ALL_365",
        min_coverage=2,  # Higher min_coverage
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

    # Employee works all days
    entries = make_full_month_entries(emp_id, problem)

    rule = CovBelowMinRule()
    issues = rule.check(problem, entries, {})

    # Should flag ALL days since coverage is 1 but min is 2
    assert len(issues) == 31
    assert all(i.rule.value == "COV_BELOW_MIN" for i in issues)


def test_no_issue_when_fully_covered() -> None:
    """No COV_ZERO or COV_BELOW_MIN when fully covered."""
    problem = make_basic_problem()
    emp_id = problem.employees[0].id

    # Employee works all days
    entries = make_full_month_entries(emp_id, problem)

    cov_zero = CovZeroRule()
    issues_zero = cov_zero.check(problem, entries, {})
    assert len(issues_zero) == 0

    cov_below = CovBelowMinRule()
    issues_below = cov_below.check(problem, entries, {})
    assert len(issues_below) == 0


def test_backup_cover_resolves_cov_zero() -> None:
    """Backup cover resolves COV_ZERO."""
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
        calendar_mode="ALL_365",
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

    # Primary on leave on Dec 15
    primary_entry = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 15),
        status=DayStatus.LEAVE,
        locked=False,
        source=EntrySource.GENERATED,
    )

    # Backup working with cover on Dec 15
    backup_id = uuid4()
    backup_employee = Employee(
        id=backup_id,
        name="Backup",
        pod_id=uuid4(),
        role=EmployeeRole.FLOATER,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    # Add backup employee and assignment
    problem = Problem(
        month_start=problem.month_start,
        month_end=problem.month_end,
        employees=problem.employees + [backup_employee],
        pods=problem.pods,
        brands=problem.brands,
        processes=problem.processes,
        coverage_overrides=problem.coverage_overrides,
        assignments=problem.assignments
        + [Assignment(employee_id=backup_id, process_id=proc_id, type=AssignmentType.BACKUP)],
        holidays=problem.holidays,
        leaves=problem.leaves,
        settings=problem.settings,
        demand_grid=build_demand_grid(problem),
    )

    # Both employees work all days except primary on leave Dec 15
    entries = make_full_month_entries(emp_id, problem)
    entries[(str(emp_id), date(2026, 12, 15))] = primary_entry

    backup_entry = RosterEntry(
        employee_id=backup_id,
        date=date(2026, 12, 15),
        status=DayStatus.WORK,
        locked=False,
        source=EntrySource.GENERATED,
    )
    # Backup also works all days
    entries.update(make_full_month_entries(backup_id, problem))
    entries[(str(backup_id), date(2026, 12, 15))] = backup_entry

    cover = CoverAssignment(
        employee_id=backup_id,
        process_id=proc_id,
        date=date(2026, 12, 15),
        source=EntrySource.GENERATED,
    )
    covers = {(str(backup_id), str(proc_id), date(2026, 12, 15)): cover}

    rule = CovZeroRule()
    issues = rule.check(problem, entries, covers)

    # Should have no issues because backup covers Dec 15
    assert len(issues) == 0
