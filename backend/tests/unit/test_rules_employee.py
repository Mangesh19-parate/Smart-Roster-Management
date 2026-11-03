from datetime import date
from uuid import uuid4

from app.engine.rules.employee import (
    CapacityExceededRule,
    CompOffUnusedRule,
    ConsecMaxRule,
    WOMissingRule,
)
from app.engine.types import (
    Assignment,
    AssignmentType,
    DayStatus,
    Employee,
    EmployeeRole,
    EntrySource,
    Holiday,
    HolidayScope,
    Problem,
    Process,
    RosterEntry,
)


def make_employee_problem(max_consec: int = 6, max_cover: int = 2) -> Problem:
    """Create a problem with one employee."""
    emp_id = uuid4()
    pod_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Test Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[6],  # Sunday
        max_consecutive_days=max_consec,
        max_cover_per_day=max_cover,
        active=True,
    )

    return Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[],
        settings={"weekly_rest_days": 1, "max_consecutive_days": max_consec},
    )


def test_wo_missing_when_no_rest_day_in_week() -> None:
    """WO_MISSING when employee has no rest day in a week."""
    problem = make_employee_problem()
    emp_id = problem.employees[0].id

    # Build complete month but with one week missing rest day
    # Week 1 (Nov 30 - Dec 6): Dec 1-6 WORK, Dec 6 WO (Sunday)
    entries = {}
    for d in [date(2026, 12, 1), date(2026, 12, 2), date(2026, 12, 3),
              date(2026, 12, 4), date(2026, 12, 5)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    entries[(str(emp_id), date(2026, 12, 6))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 6),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )
    # Week 2 (Dec 7-13): Dec 7 WO, Dec 8-13 WORK
    entries[(str(emp_id), date(2026, 12, 7))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 7),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )
    for d in [date(2026, 12, 8), date(2026, 12, 9), date(2026, 12, 10),
              date(2026, 12, 11), date(2026, 12, 12), date(2026, 12, 13)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    # Week 3 (Dec 14-20): ALL WORK (no rest day!)
    for d in [date(2026, 12, 14), date(2026, 12, 15), date(2026, 12, 16),
              date(2026, 12, 17), date(2026, 12, 18), date(2026, 12, 19),
              date(2026, 12, 20)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    # Week 4 (Dec 21-27): Dec 21 WO, Dec 22-27 WORK
    entries[(str(emp_id), date(2026, 12, 21))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 21),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )
    for d in [date(2026, 12, 22), date(2026, 12, 23), date(2026, 12, 24),
              date(2026, 12, 25), date(2026, 12, 26), date(2026, 12, 27)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    # Week 5 (Dec 28 - Jan 3): Dec 28 WO, Dec 29-31 WORK
    entries[(str(emp_id), date(2026, 12, 28))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 28),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )
    for d in [date(2026, 12, 29), date(2026, 12, 30), date(2026, 12, 31)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )

    rule = WOMissingRule()
    issues = rule.check(problem, entries, {})

    # Should flag the week of Dec 14-20 (Monday Dec 14)
    assert len(issues) == 1
    assert issues[0].rule.value == "WO_MISSING"
    assert issues[0].severity.value == "ERROR"
    assert issues[0].date == date(2026, 12, 14)


def test_wo_not_missing_when_one_rest_day() -> None:
    """WO_MISSING not triggered when at least one rest day per week."""
    problem = make_employee_problem()
    emp_id = problem.employees[0].id

    # Build complete month with proper rest days each week
    # Week 1 (Nov 30 - Dec 6): Dec 1-5 WORK, Dec 6 WO (Sunday)
    entries = {}
    for d in [date(2026, 12, 1), date(2026, 12, 2), date(2026, 12, 3),
              date(2026, 12, 4), date(2026, 12, 5)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    entries[(str(emp_id), date(2026, 12, 6))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 6),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )
    # Week 2 (Dec 7-13): Dec 7 WO, Dec 8-13 WORK
    entries[(str(emp_id), date(2026, 12, 7))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 7),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )
    for d in [date(2026, 12, 8), date(2026, 12, 9), date(2026, 12, 10),
              date(2026, 12, 11), date(2026, 12, 12), date(2026, 12, 13)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    # Week 3 (Dec 14-20): Dec 14 WO, Dec 15-20 WORK
    entries[(str(emp_id), date(2026, 12, 14))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 14),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )
    for d in [date(2026, 12, 15), date(2026, 12, 16), date(2026, 12, 17),
              date(2026, 12, 18), date(2026, 12, 19), date(2026, 12, 20)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    # Week 4 (Dec 21-27): Dec 21 WO, Dec 22-27 WORK
    entries[(str(emp_id), date(2026, 12, 21))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 21),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )
    for d in [date(2026, 12, 22), date(2026, 12, 23), date(2026, 12, 24),
              date(2026, 12, 25), date(2026, 12, 26), date(2026, 12, 27)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    # Week 5 (Dec 28 - Jan 3): Dec 28 WO, Dec 29-31 WORK
    entries[(str(emp_id), date(2026, 12, 28))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 28),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )
    for d in [date(2026, 12, 29), date(2026, 12, 30), date(2026, 12, 31)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )

    rule = WOMissingRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) == 0


def test_consec_max_exceeded() -> None:
    """CONSEC_MAX when employee exceeds max consecutive days."""
    problem = make_employee_problem(max_consec=3)
    emp_id = problem.employees[0].id

    # Work 4 consecutive days (Dec 1-4)
    entries = {}
    for d in [date(2026, 12, 1), date(2026, 12, 2), date(2026, 12, 3), date(2026, 12, 4)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )

    rule = ConsecMaxRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) == 1
    assert issues[0].rule.value == "CONSEC_MAX"
    assert issues[0].severity.value == "ERROR"
    assert "4 consecutive" in issues[0].message


def test_consec_max_not_exceeded() -> None:
    """CONSEC_MAX not triggered when within limit."""
    problem = make_employee_problem(max_consec=6)
    emp_id = problem.employees[0].id

    # Work 5 consecutive days, then rest
    entries = {}
    for d in [date(2026, 12, 1), date(2026, 12, 2), date(2026, 12, 3),
              date(2026, 12, 4), date(2026, 12, 5)]:
        entries[(str(emp_id), d)] = RosterEntry(
            employee_id=emp_id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
    entries[(str(emp_id), date(2026, 12, 6))] = RosterEntry(
        employee_id=emp_id,
        date=date(2026, 12, 6),
        status=DayStatus.WO,
        locked=False,
        source=EntrySource.GENERATED,
    )

    rule = ConsecMaxRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) == 0


def test_capacity_exceeded() -> None:
    """CAPACITY_EXCEEDED when covers > max_cover_per_day."""
    problem = make_employee_problem(max_cover=1)
    emp_id = problem.employees[0].id

    from app.engine.types import CoverAssignment
    proc_id1 = uuid4()
    proc_id2 = uuid4()
    covers = {
        (str(emp_id), str(proc_id1), date(2026, 12, 15)): CoverAssignment(
            employee_id=emp_id,
            process_id=proc_id1,
            date=date(2026, 12, 15),
            source=EntrySource.GENERATED,
        ),
        (str(emp_id), str(proc_id2), date(2026, 12, 15)): CoverAssignment(
            employee_id=emp_id,
            process_id=proc_id2,
            date=date(2026, 12, 15),
            source=EntrySource.GENERATED,
        ),
    }

    rule = CapacityExceededRule()
    issues = rule.check(problem, {}, covers)

    assert len(issues) == 1
    assert issues[0].rule.value == "CAPACITY_EXCEEDED"
    assert issues[0].severity.value == "ERROR"
    assert "2 cover" in issues[0].message


def test_compoff_unused_warning() -> None:
    """COMPOFF_UNUSED when PH worked but no comp-off taken."""
    emp_id = uuid4()
    pod_id = uuid4()
    proc_id = uuid4()
    brand_id = uuid4()

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

    holiday = Holiday(date=date(2026, 12, 25), name="Christmas", scope=HolidayScope.COMPANY, brand_id=None)

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[assignment],
        holidays=[holiday],
        leaves=[],
        settings={},
    )

    # Employee WORKs on the holiday
    entries = {
        (str(emp_id), date(2026, 12, 25)): RosterEntry(
            employee_id=emp_id,
            date=date(2026, 12, 25),
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        ),
    }

    rule = CompOffUnusedRule()
    issues = rule.check(problem, entries, {})

    assert len(issues) == 1
    assert issues[0].rule.value == "COMPOFF_UNUSED"
    assert issues[0].severity.value == "WARNING"
    assert "comp-off" in issues[0].cause.lower()