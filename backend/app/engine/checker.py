"""
Independent brute-force checker for roster validation.

This module provides a simple, deterministic verification of coverage
that does not depend on the CP-SAT solver or the validator.
It recomputes coverage from first principles and compares with validator results.
"""

from dataclasses import dataclass
from datetime import date

from app.engine.demand import build_demand_grid
from app.engine.types import (
    AssignmentType,
    CoverAssignment,
    DayStatus,
    Issue,
    IssueSeverity,
    Problem,
    RosterEntry,
    RuleID,
)


@dataclass(frozen=True)
class CheckResult:
    """Result of independent coverage check."""
    matches_validator: bool
    discrepancies: list[str]
    total_gaps: int
    validator_issues: list[Issue]
    checker_issues: list[Issue]


def compute_coverage_brute_force(
    problem: Problem,
    entries: list[RosterEntry],
    covers: list[CoverAssignment],
) -> dict[tuple[str, date], int]:
    """
    Compute coverage from first principles.

    Returns: (process_id, date) -> number of people covering.
    """
    # Build lookup maps
    entry_map = {(str(e.employee_id), e.date): e for e in entries}
    cover_map = {(str(c.employee_id), str(c.process_id), c.date): c for c in covers}

    demand_grid = build_demand_grid(problem)
    supply: dict[tuple[str, date], int] = {}

    for (proc_id, d), req in demand_grid.items():
        if req == 0:
            continue

        supplied = 0
        process = next((p for p in problem.processes if str(p.id) == proc_id), None)
        if not process:
            continue

        # Count primary employees working
        for assignment in problem.assignments:
            if (
                str(assignment.process_id) == proc_id
                and assignment.type == AssignmentType.PRIMARY
            ):
                emp_id = str(assignment.employee_id)
                entry = entry_map.get((emp_id, d))
                if entry and entry.status == DayStatus.WORK:
                    supplied += 1

        # Count backup covers
        for assignment in problem.assignments:
            if (
                str(assignment.process_id) == proc_id
                and assignment.type == AssignmentType.BACKUP
            ):
                emp_id = str(assignment.employee_id)
                cover = cover_map.get((emp_id, proc_id, d))
                entry = entry_map.get((emp_id, d))
                if cover and entry and entry.status == DayStatus.WORK:
                    supplied += 1

        supply[(proc_id, d)] = supplied

    return supply


def check_coverage_independent(
    problem: Problem,
    entries: list[RosterEntry],
    covers: list[CoverAssignment],
    validator_issues: list[Issue],
) -> CheckResult:
    """
    Independent coverage check that doesn't use the validator.

    Compares brute-force coverage calculation with validator's COV_ZERO and COV_BELOW_MIN issues.
    """
    discrepancies = []

    # Compute coverage from scratch
    supply = compute_coverage_brute_force(problem, entries, covers)
    demand_grid = build_demand_grid(problem)

    # Find COV_ZERO and COV_BELOW_MIN from validator
    validator_cov_zero = {
        (i.process_id, i.date): i for i in validator_issues if i.rule == RuleID.COV_ZERO
    }
    validator_cov_below = {
        (i.process_id, i.date): i for i in validator_issues if i.rule == RuleID.COV_BELOW_MIN
    }

    checker_cov_zero: list[Issue] = []
    checker_cov_below: list[Issue] = []

    for (proc_id, d), req in demand_grid.items():
        if req == 0:
            continue

        supplied = supply.get((proc_id, d), 0)
        process = next((p for p in problem.processes if str(p.id) == proc_id), None)
        if not process:
            continue

        # Check COV_ZERO
        if supplied == 0:
            checker_cov_zero.append(Issue(
                id=f"CHECKER_COV_ZERO_{proc_id}_{d.isoformat()}",
                rule=RuleID.COV_ZERO,
                severity=IssueSeverity.ERROR,
                structural=False,
                brand_id=process.brand_id,
                process_id=process.id,
                employee_id=None,
                pod_id=None,
                date=d,
                message=f"Checker: Zero coverage for {process.name} on {d.isoformat()}",
                cause="Brute-force check found no coverage",
                suggestion_hint="Add cover from backup or shift a rest day",
            ))

        # Check COV_BELOW_MIN
        if 0 < supplied < req:
            checker_cov_below.append(Issue(
                id=f"CHECKER_COV_BELOW_MIN_{proc_id}_{d.isoformat()}",
                rule=RuleID.COV_BELOW_MIN,
                severity=IssueSeverity.ERROR,
                structural=False,
                brand_id=process.brand_id,
                process_id=process.id,
                employee_id=None,
                pod_id=None,
                date=d,
                message=(
                    f"Checker: Coverage below minimum for {process.name} "
                    f"on {d.isoformat()}: {supplied}/{req}"
                ),
                cause=f"Brute-force check found only {supplied} of {req} required",
                suggestion_hint="Add backup cover or adjust assignments",
            ))

    # Compare with validator
    for key, _v_issue in validator_cov_zero.items():
        if key not in {(i.process_id, i.date) for i in checker_cov_zero}:
            discrepancies.append(
                f"Validator has COV_ZERO for {key} but checker does not"
            )

    for key, _c_issue in {(i.process_id, i.date): i for i in checker_cov_zero}.items():
        if key not in validator_cov_zero:
            discrepancies.append(
                f"Checker has COV_ZERO for {key} but validator does not"
            )

    for key, _v_issue in validator_cov_below.items():
        if key not in {(i.process_id, i.date) for i in checker_cov_below}:
            discrepancies.append(
                f"Validator has COV_BELOW_MIN for {key} but checker does not"
            )

    for key, _c_issue in {(i.process_id, i.date): i for i in checker_cov_below}.items():
        if key not in validator_cov_below:
            discrepancies.append(
                f"Checker has COV_BELOW_MIN for {key} but validator does not"
            )

    all_checker_issues = checker_cov_zero + checker_cov_below
    total_gaps = sum(
        max(0, demand_grid.get((proc_id, d), 0) - supply.get((proc_id, d), 0))
        for (proc_id, d) in demand_grid
    )

    return CheckResult(
        matches_validator=len(discrepancies) == 0,
        discrepancies=discrepancies,
        total_gaps=total_gaps,
        validator_issues=[
            i for i in validator_issues
            if i.rule in (RuleID.COV_ZERO, RuleID.COV_BELOW_MIN)
        ],
        checker_issues=all_checker_issues,
    )