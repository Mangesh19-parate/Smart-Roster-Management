from collections import defaultdict
from datetime import date
from typing import Any

from app.engine.types import (
    Assignment,
    AssignmentType,
    CoverAssignment,
    Process,
    RosterEntry,
)


def calculate_coverage(
    entries: list[RosterEntry],
    covers: list[CoverAssignment],
    assignments: list[Assignment],
    processes: list[Process],
    demand_grid: dict[tuple[str, date], int],
) -> dict[str, Any]:
    """
    Calculate supply vs demand for each process and date.
    Returns coverage analysis.
    """
    # Build lookup maps
    {(str(e.employee_id), e.date): e for e in entries}
    covers_by_emp_proc_date = {(str(c.employee_id), str(c.process_id), c.date): c for c in covers}

    # Employee -> process assignments
    primary_assignments: dict[str, list[str]] = defaultdict(list)
    backup_assignments: dict[str, list[str]] = defaultdict(list)
    for a in assignments:
        emp_id = str(a.employee_id)
        proc_id = str(a.process_id)
        if a.type == AssignmentType.PRIMARY:
            primary_assignments[emp_id].append(proc_id)
        elif a.type == AssignmentType.BACKUP:
            backup_assignments[emp_id].append(proc_id)

    # Calculate supply
    supply: dict[tuple[str, date], int] = defaultdict(int)
    cover_used: dict[tuple[str, date], int] = defaultdict(int)

    for entry in entries:
        if entry.status != "WORK":
            continue
        emp_id = str(entry.employee_id)
        d = entry.date

        # Primary processes covered
        for proc_id in primary_assignments.get(emp_id, []):
            supply[(proc_id, d)] += 1

        # Backup covers (only if explicit cover assignment exists)
        for proc_id in backup_assignments.get(emp_id, []):
            if (emp_id, proc_id, d) in covers_by_emp_proc_date:
                supply[(proc_id, d)] += 1
                cover_used[(proc_id, d)] += 1

    # Calculate shortfalls
    shortfalls: dict[tuple[str, date], int] = {}
    for (proc_id, d), required in demand_grid.items():
        supplied = supply.get((proc_id, d), 0)
        if supplied < required:
            shortfalls[(proc_id, d)] = required - supplied

    return {
        "supply": dict(supply),
        "cover_used": dict(cover_used),
        "shortfalls": shortfalls,
        "fully_covered": len(shortfalls) == 0,
    }


def get_supply_for_process(entries: list[RosterEntry], covers: list[CoverAssignment],
                           assignments: list[Assignment], process_id: str, d: date) -> int:
    """Get total supply for a process on a date."""
    entries_by_emp_date = {(str(e.employee_id), e.date): e for e in entries}
    covers_by_emp_proc_date = {(str(c.employee_id), str(c.process_id), c.date): c for c in covers}

    primary_assignments = {str(a.employee_id) for a in assignments
                          if str(a.process_id) == process_id and a.type == AssignmentType.PRIMARY}
    backup_assignments = {str(a.employee_id) for a in assignments
                         if str(a.process_id) == process_id and a.type == AssignmentType.BACKUP}

    supply = 0
    for emp_id in primary_assignments:
        entry = entries_by_emp_date.get((emp_id, d))
        if entry and entry.status == "WORK":
            supply += 1

    for emp_id in backup_assignments:
        if (emp_id, process_id, d) in covers_by_emp_proc_date:
            entry = entries_by_emp_date.get((emp_id, d))
            if entry and entry.status == "WORK":
                supply += 1

    return supply


def get_coverage_summary(
    entries: list[RosterEntry],
    covers: list[CoverAssignment],
    assignments: list[Assignment],
    processes: list[Process],
    demand_grid: dict[tuple[str, date], int],
) -> list[dict[str, Any]]:
    """Get coverage summary for UI display."""
    coverage = calculate_coverage(entries, covers, assignments, processes, demand_grid)
    shortfalls = coverage["shortfalls"]

    summary = []
    for process in processes:
        proc_id = str(process.id)
        for d in sorted(set(d for (pid, d) in demand_grid.keys() if pid == proc_id)):
            required = demand_grid.get((proc_id, d), 0)
            supplied = coverage["supply"].get((proc_id, d), 0)
            cover_used = coverage["cover_used"].get((proc_id, d), 0)
            shortfall = shortfalls.get((proc_id, d), 0)

            status = "fully_covered"
            if shortfall > 0:
                status = "gap"
            elif supplied == required and required > 0:
                status = "at_minimum"

            summary.append({
                "process_id": proc_id,
                "process_name": process.name,
                "brand_id": str(process.brand_id),
                "date": d.isoformat(),
                "required": required,
                "supplied": supplied,
                "cover_used": cover_used,
                "shortfall": shortfall,
                "status": status,
            })

    return summary