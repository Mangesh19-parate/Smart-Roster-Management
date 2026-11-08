from datetime import date

from app.engine.coverage import calculate_coverage
from app.engine.types import (
    AssignmentType,
    CoverAssignment,
    Issue,
    IssueSeverity,
    Problem,
    Process,
    RosterEntry,
    RuleID,
)
from app.engine.validator import Rule, make_issue_id


class CovZeroRule(Rule):
    """COV_ZERO: Process has zero coverage on a required day."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.COV_ZERO

    @property
    def severity(self) -> IssueSeverity:
        return IssueSeverity.ERROR

    @property
    def is_structural(self) -> bool:
        return False

    def check(
        self,
        problem: Problem,
        entries: dict[tuple[str, date], RosterEntry],
        covers: dict[tuple[str, str, date], CoverAssignment],
    ) -> list[Issue]:
        issues = []
        demand_grid = problem.demand_grid or {}
        coverage = calculate_coverage(
            list(entries.values()),
            list(covers.values()),
            problem.assignments,
            problem.processes,
            demand_grid,
        )

        supply = coverage["supply"]
        shortfalls = coverage["shortfalls"]
        for (proc_id, d), _shortfall in shortfalls.items():
            # COV_ZERO only when supply is exactly 0
            if supply.get((proc_id, d), 0) != 0:
                continue
            # Find the process
            process = next((p for p in problem.processes if str(p.id) == proc_id), None)
            if not process:
                continue

            # Determine cause
            cause = self._determine_cause(problem, process, d, entries, covers)

            issue = Issue(
                id=make_issue_id(RuleID.COV_ZERO, proc_id, d),
                rule=RuleID.COV_ZERO,
                severity=IssueSeverity.ERROR,
                structural=False,
                brand_id=process.brand_id,
                process_id=process.id,
                employee_id=None,
                pod_id=None,
                date=d,
                message=f"Zero coverage for {process.name} on {d.isoformat()}",
                cause=cause,
                suggestion_hint="Add cover from backup or shift a rest day",
            )
            issues.append(issue)

        return issues

    def _determine_cause(
        self,
        problem: Problem,
        process: Process,
        d: date,
        entries: dict[tuple[str, date], RosterEntry],
        covers: dict[tuple[str, str, date], CoverAssignment],
    ) -> str:
        # Find all primary employees for this process
        primary_emps = [
            str(a.employee_id)
            for a in problem.assignments
            if str(a.process_id) == str(process.id) and a.type == AssignmentType.PRIMARY
        ]

        if not primary_emps:
            return "No primary employee assigned to process"

        # Check each primary employee's status
        reasons = []
        for emp_id in primary_emps:
            entry = entries.get((emp_id, d))
            if not entry:
                reasons.append(f"Employee {emp_id}: no entry")
            elif entry.status == "LEAVE":
                reasons.append(f"Employee {emp_id}: on approved leave")
            elif entry.status == "COMP_OFF":
                reasons.append(f"Employee {emp_id}: on comp-off")
            elif entry.status == "WO":
                reasons.append(f"Employee {emp_id}: weekly off")
            elif entry.status == "PH":
                reasons.append(f"Employee {emp_id}: public holiday")
            elif entry.status != "WORK":
                reasons.append(f"Employee {emp_id}: status {entry.status}")

        if len(reasons) == 1:
            return f"Sole resource {reasons[0].split(':')[0].strip()} ({reasons[0].split(':')[1].strip()})"
        return f"All {len(primary_emps)} primary employees unavailable: {'; '.join(reasons)}"


class CovBelowMinRule(Rule):
    """COV_BELOW_MIN: Process has coverage but below minimum required."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.COV_BELOW_MIN

    @property
    def severity(self) -> IssueSeverity:
        return IssueSeverity.ERROR

    @property
    def is_structural(self) -> bool:
        return False

    def check(
        self,
        problem: Problem,
        entries: dict[tuple[str, date], RosterEntry],
        covers: dict[tuple[str, str, date], CoverAssignment],
    ) -> list[Issue]:
        issues = []
        demand_grid = problem.demand_grid or {}
        coverage = calculate_coverage(
            list(entries.values()),
            list(covers.values()),
            problem.assignments,
            problem.processes,
            demand_grid,
        )

        supply = coverage["supply"]
        for (proc_id, d), supplied in supply.items():
            required = demand_grid.get((proc_id, d), 0)
            if 0 < supplied < required:
                process = next((p for p in problem.processes if str(p.id) == proc_id), None)
                if not process:
                    continue

                issue = Issue(
                    id=make_issue_id(RuleID.COV_BELOW_MIN, proc_id, d),
                    rule=RuleID.COV_BELOW_MIN,
                    severity=IssueSeverity.ERROR,
                    structural=False,
                    brand_id=process.brand_id,
                    process_id=process.id,
                    employee_id=None,
                    pod_id=None,
                    date=d,
                    message=f"Coverage below minimum for {process.name} on {d.isoformat()}: {supplied}/{required}",
                    cause=f"Only {supplied} of {required} required employees available",
                    suggestion_hint="Add backup cover or adjust assignments",
                )
                issues.append(issue)

        return issues
