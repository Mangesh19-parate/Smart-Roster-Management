from datetime import date
from uuid import uuid4

from app.engine.feasibility import AssignMissingRule, StructHeadcountRule, StructNoBackupRule
from app.engine.types import (
    Assignment,
    AssignmentType,
    DayStatus,
    Employee,
    EmployeeRole,
    EntrySource,
    Pod,
    Problem,
    Process,
    RosterEntry,
)


def test_struct_no_backup_zenith() -> None:
    """STRUCT_NO_BACKUP for 365-day brand with 1 employee and no backup."""
    emp_id = uuid4()
    pod_id = uuid4()
    brand_id = uuid4()
    proc_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Sole Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[6],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    pod = Pod(id=pod_id, name="Test Pod", lead_employee_id=None)

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
        pods=[pod],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[assignment],
        holidays=[],
        leaves=[],
        settings={"weekly_rest_days": 1, "max_consecutive_days": 6},
    )

    # Employee works all days (no rest possible)
    entries = {}
    for d in [
        date(2026, 12, 1),
        date(2026, 12, 2),
        date(2026, 12, 3),
        date(2026, 12, 4),
        date(2026, 12, 5),
        date(2026, 12, 6),
        date(2026, 12, 7),
    ]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )

    rule = StructNoBackupRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) >= 1
    assert any(i.rule.value == "STRUCT_NO_BACKUP" for i in issues)


def test_struct_no_backup_ok_with_floater() -> None:
    """STRUCT_NO_BACKUP not triggered when floater backup exists."""
    emp_id = uuid4()
    floater_id = uuid4()
    pod_id = uuid4()
    brand_id = uuid4()
    proc_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Sole Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[6],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    floater = Employee(
        id=floater_id,
        name="Floater",
        pod_id=pod_id,
        role=EmployeeRole.FLOATER,
        preferred_off_days=[6],
        max_consecutive_days=6,
        max_cover_per_day=3,
        active=True,
    )

    pod = Pod(id=pod_id, name="Test Pod", lead_employee_id=None)

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode="ALL_365",
        min_coverage=1,
    )

    primary_assignment = Assignment(
        employee_id=emp_id, process_id=proc_id, type=AssignmentType.PRIMARY
    )
    backup_assignment = Assignment(
        employee_id=floater_id, process_id=proc_id, type=AssignmentType.BACKUP
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee, floater],
        pods=[pod],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[primary_assignment, backup_assignment],
        holidays=[],
        leaves=[],
        settings={"weekly_rest_days": 1, "max_consecutive_days": 6},
    )

    # Both work all days in December - floater is available to cover any day
    from app.engine.lib.dates import days_in_range

    entries = {}
    for d in days_in_range(problem.month_start, problem.month_end):
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
        entries[(str(floater_id), d)] = RosterEntry(
            employee_id=floater_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )

    rule = StructNoBackupRule()
    issues = rule.check(problem, entries, {})

    # Should not flag because floater can cover
    struct_issues = [i for i in issues if i.rule.value == "STRUCT_NO_BACKUP"]
    assert len(struct_issues) == 0


def test_struct_headcount() -> None:
    """STRUCT_HEADCOUNT when required > eligible employees."""
    emp_id = uuid4()
    pod_id = uuid4()
    brand_id = uuid4()
    proc_id = uuid4()

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

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode="ALL_365",
        min_coverage=2,  # Need 2 but only 1 eligible
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
        settings={},
    )

    rule = StructHeadcountRule()
    issues = rule.check(problem, {}, {})

    assert len(issues) >= 1
    assert any(i.rule.value == "STRUCT_HEADCOUNT" for i in issues)


def test_assign_missing() -> None:
    """ASSIGN_MISSING when process has demand but no PRIMARY."""
    emp_id = uuid4()
    pod_id = uuid4()
    brand_id = uuid4()
    proc_id = uuid4()

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

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode="ALL_365",
        min_coverage=1,
    )

    # Only BACKUP assignment, no PRIMARY
    assignment = Assignment(employee_id=emp_id, process_id=proc_id, type=AssignmentType.BACKUP)

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
        settings={},
    )

    rule = AssignMissingRule()
    issues = rule.check(problem, {}, {})

    assert len(issues) == 1
    assert issues[0].rule.value == "ASSIGN_MISSING"
    assert issues[0].severity.value == "ERROR"
    assert issues[0].structural is True


def test_assign_missing_ok_with_primary() -> None:
    """ASSIGN_MISSING not triggered when PRIMARY exists."""
    emp_id = uuid4()
    pod_id = uuid4()
    brand_id = uuid4()
    proc_id = uuid4()

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
        settings={},
    )

    rule = AssignMissingRule()
    issues = rule.check(problem, {}, {})

    assert len(issues) == 0
