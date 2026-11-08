"""Tests for the CP-SAT solver."""

from datetime import date
from uuid import uuid4

from app.engine.solver import RosterSolver, SolverConfig, solve_roster, solve_roster_with_previous
from app.engine.types import (
    Assignment,
    AssignmentType,
    CalendarMode,
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


def make_simple_problem() -> Problem:
    """Create a simple problem with 1 employee, 1 process."""
    emp_id = uuid4()
    proc_id = uuid4()
    brand_id = uuid4()
    pod_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[6],  # Sunday
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

    return Problem(
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
    )


def make_problem_with_backup() -> Problem:
    """Create a problem with primary and backup."""
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
        preferred_off_days=[6],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    backup = Employee(
        id=backup_id,
        name="Backup",
        pod_id=pod_id,
        role=EmployeeRole.FLOATER,
        preferred_off_days=[6],
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

    primary_assignment = Assignment(
        employee_id=emp_id, process_id=proc_id, type=AssignmentType.PRIMARY
    )
    backup_assignment = Assignment(
        employee_id=backup_id, process_id=proc_id, type=AssignmentType.BACKUP
    )

    return Problem(
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
    )


def test_solver_builds_model() -> None:
    """Test that solver can build model without errors."""
    problem = make_simple_problem()
    solver = RosterSolver(problem)
    solver.build()
    # Should not raise


def test_solver_solves_simple() -> None:
    """Test solver on simple feasible problem."""
    problem = make_simple_problem()
    config = SolverConfig(max_time_seconds=5.0)
    result = solve_roster(problem, config)

    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert len(result.entries) == 31  # One entry per day
    # Weekly rest creates gaps on WO days (5 Sundays/partial weeks in Dec 2026)
    assert result.gaps_total >= 4  # At least 4 weekly rest days


def test_solver_respects_weekly_rest() -> None:
    """Test that solver gives at least 1 rest day per week."""
    problem = make_simple_problem()
    result = solve_roster(problem)

    # Check each week has at least 1 non-WORK day
    from app.engine.lib.dates import days_in_range, monday_of_week, sunday_of_week

    current_monday = monday_of_week(problem.month_start)
    month_end_sunday = sunday_of_week(problem.month_end)

    while current_monday <= month_end_sunday:
        week_end = sunday_of_week(current_monday)
        week_dates = [
            d
            for d in days_in_range(current_monday, week_end)
            if problem.month_start <= d <= problem.month_end
        ]
        if len(week_dates) >= 4:
            work_days = sum(
                1
                for d in week_dates
                for e in result.entries
                if e.date == d and e.status == DayStatus.WORK
            )
            assert work_days <= len(week_dates) - 1, f"Week {current_monday} has no rest day"
        current_monday = week_end + __import__("datetime").timedelta(days=1)


def test_solver_respects_max_consecutive() -> None:
    """Test that solver respects max consecutive days."""
    problem = make_simple_problem()
    result = solve_roster(problem)

    # Check no employee works more than 6 consecutive days
    emp_id = str(problem.employees[0].id)
    work_dates = sorted(
        e.date
        for e in result.entries
        if str(e.employee_id) == emp_id and e.status == DayStatus.WORK
    )

    max_consec = 1
    current_consec = 1
    for i in range(1, len(work_dates)):
        if (work_dates[i] - work_dates[i - 1]).days == 1:
            current_consec += 1
            max_consec = max(max_consec, current_consec)
        else:
            current_consec = 1

    assert max_consec <= 6


def test_solver_with_backup_covers_rest() -> None:
    """Test that backup covers when primary rests."""
    problem = make_problem_with_backup()
    result = solve_roster(problem)

    assert result.gaps_total == 0
    # Should have cover assignments
    assert len(result.covers) > 0


def test_solver_deterministic() -> None:
    """Test that same input gives identical output."""
    problem = make_simple_problem()
    config = SolverConfig(max_time_seconds=5.0, random_seed=42)

    result1 = solve_roster(problem, config)
    result2 = solve_roster(problem, config)

    assert result1.status == result2.status
    assert result1.objective == result2.objective
    assert len(result1.entries) == len(result2.entries)


def test_solver_with_holidays() -> None:
    """Test solver respects holidays."""
    emp_id = uuid4()
    proc_id = uuid4()
    brand_id = uuid4()
    pod_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[6],
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

    christmas = Holiday(
        date=date(2026, 12, 25), name="Christmas", scope=HolidayScope.COMPANY, brand_id=None
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[assignment],
        holidays=[christmas],
        leaves=[],
        settings={"weekly_rest_days": 1, "max_consecutive_days": 6},
    )

    result = solve_roster(problem)

    # Employee should not work on Christmas
    christmas_entry = next(e for e in result.entries if e.date == date(2026, 12, 25))
    assert christmas_entry.status == DayStatus.PH


def test_solver_minimal_change_mode() -> None:
    """Test minimal-change mode with previous roster."""
    problem = make_simple_problem()

    # Previous roster: employee works all days
    prev_entries = [
        RosterEntry(
            employee_id=problem.employees[0].id,
            date=d,
            status=DayStatus.WORK,
            locked=False,
            source=EntrySource.GENERATED,
        )
        for d in [date(2026, 12, 1), date(2026, 12, 2), date(2026, 12, 3)]
    ]

    # Now solve with minimal change
    result = solve_roster_with_previous(problem, prev_entries, [])

    assert result.status in ("OPTIMAL", "FEASIBLE")
    # Should try to keep previous assignments where possible


def test_solver_impossible_coverage_returns_gaps() -> None:
    """Test that impossible coverage yields gaps, not error."""
    # Process needs 2 but only 1 employee
    emp_id = uuid4()
    proc_id = uuid4()
    brand_id = uuid4()
    pod_id = uuid4()

    employee = Employee(
        id=emp_id,
        name="Agent",
        pod_id=pod_id,
        role=EmployeeRole.AGENT,
        preferred_off_days=[6],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="CS",
        calendar_mode=CalendarMode.ALL_365,
        min_coverage=2,  # Need 2 but only 1 person
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
    )

    result = solve_roster(problem)

    # Should find feasible solution with shortfall
    assert result.status in ("OPTIMAL", "FEASIBLE")
    assert result.gaps_total > 0  # Should have gaps


def test_locked_entries_preserve_status_and_lock_flag() -> None:
    """Test that locked entries preserve their actual status (e.g. WO) and lock flag."""
    problem = make_simple_problem()
    emp_id = problem.employees[0].id
    locked_date = date(2026, 12, 10)

    prev_entries = [
        RosterEntry(
            employee_id=emp_id,
            date=locked_date,
            status=DayStatus.WO,
            locked=True,
            source=EntrySource.MANUAL,
        )
    ]

    result = solve_roster_with_previous(problem, prev_entries, [])
    assert result.status in ("OPTIMAL", "FEASIBLE")

    entry_on_locked_date = next(e for e in result.entries if e.date == locked_date)
    assert entry_on_locked_date.status == DayStatus.WO
    assert entry_on_locked_date.locked is True


def test_shortfall_when_zero_eligible_employees() -> None:
    """When a process has required coverage but zero eligible suppliers, shortfall equals requirement."""
    proc_id = uuid4()
    brand_id = uuid4()

    process = Process(
        id=proc_id,
        brand_id=brand_id,
        name="Unstaffed CS",
        calendar_mode=CalendarMode.ALL_365,
        min_coverage=2,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 5),  # 5 days
        employees=[],
        pods=[],
        brands=[],
        processes=[process],
        coverage_overrides=[],
        assignments=[],  # zero eligible employees
        holidays=[],
        leaves=[],
        settings={"weekly_rest_days": 1, "max_consecutive_days": 6},
    )

    result = solve_roster(problem)
    assert result.status in ("OPTIMAL", "FEASIBLE")
    # 5 days * 2 required = 10 gaps
    assert result.gaps_total == 10
