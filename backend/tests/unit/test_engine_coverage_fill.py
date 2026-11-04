from datetime import date
from uuid import uuid4

from app.engine.lib.dates import (
    week_bounds,
    is_full_week_in_month,
    weeks_in_month,
    add_months,
    format_month,
    parse_month,
    month_start_end,
)
from app.engine.availability import is_working_day, get_employee_blocked_days
from app.engine.demand import get_brand_demand, get_process_demand
from app.engine.coverage import get_supply_for_process, get_coverage_summary
from app.engine.validator import Validator, make_issue_id
from app.engine.checker import check_coverage_independent
from app.engine.types import (
    Employee,
    EmployeeRole,
    Process,
    Assignment,
    AssignmentType,
    CoverAssignment,
    EntrySource,
    RosterEntry,
    DayStatus,
    Issue,
    IssueSeverity,
    RuleID,
    Problem,
)


def test_dates_lib():
    # ponytail: test all untested date utilities compactly
    d = date(2025, 3, 15)  # Saturday
    mon, sun = week_bounds(d)
    assert mon == date(2025, 3, 10)
    assert sun == date(2025, 3, 16)

    assert is_full_week_in_month(date(2025, 3, 3), date(2025, 3, 9), date(2025, 3, 1), date(2025, 3, 31))
    assert not is_full_week_in_month(date(2025, 2, 24), date(2025, 3, 2), date(2025, 3, 1), date(2025, 3, 31))

    # weeks_in_month
    w = weeks_in_month(date(2025, 3, 1), date(2025, 3, 31))
    assert len(w) >= 5

    # add_months handling year rollover and leap year
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    assert add_months(date(2025, 1, 31), 1) == date(2025, 2, 28)
    assert add_months(date(2025, 11, 15), 2) == date(2026, 1, 15)

    assert format_month(date(2025, 5, 1)) == "2025-05"
    start, end = parse_month("2025-12")
    assert start == date(2025, 12, 1) and end == date(2025, 12, 31)

    s2, e2 = month_start_end(2025, 4)
    assert s2 == date(2025, 4, 1) and e2 == date(2025, 4, 30)


def test_availability_helpers():
    emp = Employee(
        id=uuid4(),
        name="Alice",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )
    blocked = {(str(emp.id), date(2025, 3, 5)): True}
    res = get_employee_blocked_days(emp, blocked, date(2025, 3, 1), date(2025, 3, 10))
    assert res == [date(2025, 3, 5)]

    entries = {(str(emp.id), date(2025, 3, 1)): "WORK", (str(emp.id), date(2025, 3, 2)): "OFF"}
    assert is_working_day(str(emp.id), date(2025, 3, 1), entries)
    assert not is_working_day(str(emp.id), date(2025, 3, 2), entries)


def test_demand_and_coverage_helpers():
    brand_id = uuid4()
    p1 = Process(id=uuid4(), brand_id=brand_id, name="Proc1", calendar_mode="ALL_365", min_coverage=1)
    p2 = Process(id=uuid4(), brand_id=uuid4(), name="Proc2", calendar_mode="ALL_365", min_coverage=1)
    d1 = date(2025, 3, 1)

    grid = {(str(p1.id), d1): 2, (str(p2.id), d1): 1}
    b_demand = get_brand_demand(str(brand_id), grid, [p1, p2])
    assert b_demand == {d1: 2}

    p_demand = get_process_demand(str(p1.id), grid)
    assert p_demand == {d1: 2}

    emp1_id = uuid4()
    emp2_id = uuid4()
    assignments = [
        Assignment(employee_id=emp1_id, process_id=p1.id, type=AssignmentType.PRIMARY),
        Assignment(employee_id=emp2_id, process_id=p1.id, type=AssignmentType.BACKUP),
    ]
    entries = [
        RosterEntry(employee_id=emp1_id, date=d1, status=DayStatus.WORK, locked=False, source=EntrySource.GENERATED),
        RosterEntry(employee_id=emp2_id, date=d1, status=DayStatus.WORK, locked=False, source=EntrySource.GENERATED),
    ]
    covers = [
        CoverAssignment(employee_id=emp2_id, process_id=p1.id, date=d1, source=EntrySource.GENERATED),
    ]

    supply = get_supply_for_process(entries, covers, assignments, str(p1.id), d1)
    assert supply == 2

    # summary
    summary = get_coverage_summary(entries, covers, assignments, [p1], grid)
    assert len(summary) == 1
    assert summary[0]["status"] == "at_minimum"
    assert summary[0]["supplied"] == 2

    # shortfall gap branch
    grid_gap = {(str(p1.id), d1): 3}
    summary_gap = get_coverage_summary(entries, covers, assignments, [p1], grid_gap)
    assert summary_gap[0]["status"] == "gap"
    assert summary_gap[0]["shortfall"] == 1


def test_validator_helpers():
    iss_err = Issue(
        id="1", rule=RuleID.COV_ZERO, severity=IssueSeverity.ERROR, structural=True,
        brand_id=None, process_id=None, employee_id=None, pod_id=None, date=None,
        message="err", cause="c", suggestion_hint="s"
    )
    iss_warn = Issue(
        id="2", rule=RuleID.CONSEC_MAX, severity=IssueSeverity.WARNING, structural=False,
        brand_id=None, process_id=None, employee_id=None, pod_id=None, date=None,
        message="warn", cause="c", suggestion_hint="s"
    )
    val = Validator([])
    issues = [iss_err, iss_warn]
    assert val.get_errors(issues) == [iss_err]
    assert val.get_warnings(issues) == [iss_warn]
    assert val.get_structural(issues) == [iss_err]

    iid = make_issue_id(RuleID.COV_ZERO, "proc_1", date(2025, 3, 1))
    assert "COV_ZERO" in iid and "proc_1" in iid and "2025-03-01" in iid


def test_checker_discrepancies():
    # test check_coverage_independent with deliberate discrepancy
    p = Process(id=uuid4(), brand_id=uuid4(), name="ProcA", calendar_mode="ALL_365", min_coverage=1)
    d = date(2025, 3, 1)
    problem = Problem(
        month_start=d,
        month_end=d,
        employees=[],
        pods=[],
        brands=[],
        processes=[p],
        assignments=[],
        leaves=[],
        holidays=[],
        coverage_overrides=[],
        settings={},
    )
    # Roster has no entries, so checker detects zero coverage
    result = check_coverage_independent(problem, [], [], validator_issues=[])
    assert not result.matches_validator
    assert len(result.discrepancies) > 0
