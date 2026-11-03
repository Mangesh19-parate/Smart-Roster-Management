from datetime import date

from app.engine.lib.dates import days_in_range
from app.engine.types import Employee, LeaveStatus, LeaveType, Problem


def build_blocked_days(problem: Problem) -> dict[tuple[str, date], bool]:
    """
    Build blocked days map: (employee_id_str, date) -> True if blocked.
    Only APPROVED leave and COMP_OFF block days.
    """
    blocked: dict[tuple[str, date], bool] = {}

    # Process leaves
    for leave in problem.leaves:
        if leave.status != LeaveStatus.APPROVED:
            continue  # PENDING and REJECTED do not block
        if leave.type not in (LeaveType.PLANNED, LeaveType.COMP_OFF, LeaveType.SICK):
            continue

        emp_id = str(leave.employee_id)
        for d in days_in_range(leave.start_date, leave.end_date):
            if problem.month_start <= d <= problem.month_end:
                blocked[(emp_id, d)] = True

    return blocked


def is_blocked(employee_id: str, d: date, blocked_days: dict[tuple[str, date], bool]) -> bool:
    """Check if an employee is blocked on a given date."""
    return blocked_days.get((employee_id, d), False)


def get_employee_blocked_days(employee: Employee, blocked_days: dict[tuple[str, date], bool],
                               month_start: date, month_end: date) -> list[date]:
    """Get all blocked days for an employee in the month."""
    return [d for d in days_in_range(month_start, month_end)
            if is_blocked(str(employee.id), d, blocked_days)]


def is_working_day(employee_id: str, d: date, entries: dict[tuple[str, date], str]) -> bool:
    """Check if employee is working on a date based on roster entries."""
    return entries.get((employee_id, d)) == "WORK"