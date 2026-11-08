from datetime import date
from uuid import uuid4

from app.engine.availability import build_blocked_days, is_blocked
from app.engine.types import (
    Employee,
    EmployeeRole,
    Leave,
    LeaveStatus,
    LeaveType,
    Problem,
)


def test_approved_leave_blocks_days() -> None:
    """APPROVED leave blocks days."""
    emp_id = uuid4()
    employee = Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    leave = Leave(
        employee_id=emp_id,
        start_date=date(2026, 12, 10),
        end_date=date(2026, 12, 12),
        type=LeaveType.PLANNED,
        status=LeaveStatus.APPROVED,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[leave],
        settings={},
    )

    blocked = build_blocked_days(problem)

    assert is_blocked(str(emp_id), date(2026, 12, 10), blocked) is True
    assert is_blocked(str(emp_id), date(2026, 12, 11), blocked) is True
    assert is_blocked(str(emp_id), date(2026, 12, 12), blocked) is True
    assert is_blocked(str(emp_id), date(2026, 12, 9), blocked) is False
    assert is_blocked(str(emp_id), date(2026, 12, 13), blocked) is False


def test_pending_leave_does_not_block() -> None:
    """PENDING leave does NOT block days."""
    emp_id = uuid4()
    employee = Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    leave = Leave(
        employee_id=emp_id,
        start_date=date(2026, 12, 10),
        end_date=date(2026, 12, 12),
        type=LeaveType.PLANNED,
        status=LeaveStatus.PENDING,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[leave],
        settings={},
    )

    blocked = build_blocked_days(problem)

    assert is_blocked(str(emp_id), date(2026, 12, 10), blocked) is False
    assert is_blocked(str(emp_id), date(2026, 12, 11), blocked) is False


def test_rejected_leave_does_not_block() -> None:
    """REJECTED leave does NOT block days."""
    emp_id = uuid4()
    employee = Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    leave = Leave(
        employee_id=emp_id,
        start_date=date(2026, 12, 10),
        end_date=date(2026, 12, 12),
        type=LeaveType.PLANNED,
        status=LeaveStatus.REJECTED,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[leave],
        settings={},
    )

    blocked = build_blocked_days(problem)

    assert is_blocked(str(emp_id), date(2026, 12, 10), blocked) is False


def test_comp_off_blocks_days() -> None:
    """COMP_OFF leave blocks days."""
    emp_id = uuid4()
    employee = Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    leave = Leave(
        employee_id=emp_id,
        start_date=date(2026, 12, 10),
        end_date=date(2026, 12, 10),
        type=LeaveType.COMP_OFF,
        status=LeaveStatus.APPROVED,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[leave],
        settings={},
    )

    blocked = build_blocked_days(problem)

    assert is_blocked(str(emp_id), date(2026, 12, 10), blocked) is True


def test_sick_leave_blocks_days() -> None:
    """SICK leave blocks days."""
    emp_id = uuid4()
    employee = Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    leave = Leave(
        employee_id=emp_id,
        start_date=date(2026, 12, 10),
        end_date=date(2026, 12, 12),
        type=LeaveType.SICK,
        status=LeaveStatus.APPROVED,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[leave],
        settings={},
    )

    blocked = build_blocked_days(problem)

    assert is_blocked(str(emp_id), date(2026, 12, 10), blocked) is True
    assert is_blocked(str(emp_id), date(2026, 12, 11), blocked) is True
    assert is_blocked(str(emp_id), date(2026, 12, 12), blocked) is True


def test_leave_spanning_months() -> None:
    """Leave spanning month boundaries only blocks days within the month."""
    emp_id = uuid4()
    employee = Employee(
        id=emp_id,
        name="Test",
        pod_id=uuid4(),
        role=EmployeeRole.AGENT,
        preferred_off_days=[],
        max_consecutive_days=6,
        max_cover_per_day=2,
        active=True,
    )

    leave = Leave(
        employee_id=emp_id,
        start_date=date(2026, 11, 28),
        end_date=date(2026, 12, 3),
        type=LeaveType.PLANNED,
        status=LeaveStatus.APPROVED,
    )

    problem = Problem(
        month_start=date(2026, 12, 1),
        month_end=date(2026, 12, 31),
        employees=[employee],
        pods=[],
        brands=[],
        processes=[],
        coverage_overrides=[],
        assignments=[],
        holidays=[],
        leaves=[leave],
        settings={},
    )

    blocked = build_blocked_days(problem)

    # Only Dec 1-3 should be blocked
    assert is_blocked(str(emp_id), date(2026, 12, 1), blocked) is True
    assert is_blocked(str(emp_id), date(2026, 12, 2), blocked) is True
    assert is_blocked(str(emp_id), date(2026, 12, 3), blocked) is True
    assert is_blocked(str(emp_id), date(2026, 12, 4), blocked) is False
