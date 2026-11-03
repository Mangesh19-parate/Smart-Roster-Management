from datetime import date

from app.engine.lib.dates import days_in_range
from app.engine.types import (
    CoverAssignment,
    Issue,
    IssueSeverity,
    Problem,
    RosterEntry,
    RuleID,
)
from app.engine.validator import Rule, make_issue_id


class PrefOffMissedRule(Rule):
    """PREF_OFF_MISSED: Employee's preferred off day not honored (soft constraint)."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.PREF_OFF_MISSED

    @property
    def severity(self) -> IssueSeverity:
        return IssueSeverity.WARNING

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

        for employee in problem.employees:
            if not employee.active or not employee.preferred_off_days:
                continue

            emp_id = str(employee.id)
            preferred_days = set(employee.preferred_off_days)  # weekday numbers (0=Mon, 6=Sun)

            for d in days_in_range(problem.month_start, problem.month_end):
                if d.weekday() in preferred_days:
                    entry = entries.get((emp_id, d))
                    if entry and entry.status == "WORK":
                        issue = Issue(
                            id=make_issue_id(RuleID.PREF_OFF_MISSED, emp_id, d),
                            rule=RuleID.PREF_OFF_MISSED,
                            severity=IssueSeverity.WARNING,
                            structural=False,
                            brand_id=None,
                            process_id=None,
                            employee_id=employee.id,
                            pod_id=employee.pod_id,
                            date=d,
                            message=f"{employee.name} worked on preferred off day {d.isoformat()} (weekday {d.weekday()})",
                            cause=f"Preferred off day (weekday {d.weekday()}) not honored due to coverage needs",
                            suggestion_hint="Consider if coverage allows shifting this day",
                        )
                        issues.append(issue)

        return issues


class FairnessSpreadRule(Rule):
    """FAIRNESS_SPREAD: Uneven distribution of Sunday/holiday work across employees."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.FAIRNESS_SPREAD

    @property
    def severity(self) -> IssueSeverity:
        return IssueSeverity.WARNING

    @property
    def is_structural(self) -> bool:
        return False

    def check(
        self,
        problem: Problem,
        entries: dict[tuple[str, date], RosterEntry],
        covers: dict[tuple[str, str, date], CoverAssignment],
    ) -> list[Issue]:
        issues: list[Issue] = []

        # Count Sunday and holiday work per employee
        work_counts: dict[str, int] = {}
        for employee in problem.employees:
            if not employee.active:
                continue
            emp_id = str(employee.id)
            count = 0
            for d in days_in_range(problem.month_start, problem.month_end):
                entry = entries.get((emp_id, d))
                if entry and entry.status == "WORK":
                    # Check if Sunday or PH
                    is_sunday = d.weekday() == 6
                    is_ph = False
                    for h in problem.holidays:
                        if h.date == d and h.scope.value == "COMPANY":
                            is_ph = True
                            break
                    if is_sunday or is_ph:
                        count += 1
            work_counts[emp_id] = count

        if not work_counts:
            return issues

        min_work = min(work_counts.values())
        max_work = max(work_counts.values())
        spread = max_work - min_work

        # Warn if spread > 2
        if spread > 2:
            # Find employees at extremes
            [eid for eid, c in work_counts.items() if c == min_work]
            max_emps = [eid for eid, c in work_counts.items() if c == max_work]

            for emp_id in max_emps:
                employee = next(e for e in problem.employees if str(e.id) == emp_id)
                issue = Issue(
                    id=make_issue_id(RuleID.FAIRNESS_SPREAD, emp_id, problem.month_start),
                    rule=RuleID.FAIRNESS_SPREAD,
                    severity=IssueSeverity.WARNING,
                    structural=False,
                    brand_id=None,
                    process_id=None,
                    employee_id=employee.id,
                    pod_id=employee.pod_id,
                    date=problem.month_start,
                    message=f"{employee.name} worked {max_work} Sunday/holiday days (spread: {spread}, min: {min_work})",
                    cause=f"Unfair distribution of Sunday/holiday work across team (spread={spread})",
                    suggestion_hint="Rebalance Sunday/holiday assignments",
                )
                issues.append(issue)

        return issues


class PodOffClusterRule(Rule):
    """POD_OFF_CLUSTER: Too many employees from same pod off on the same day."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.POD_OFF_CLUSTER

    @property
    def severity(self) -> IssueSeverity:
        return IssueSeverity.WARNING

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

        # Group employees by pod
        pods: dict[str, list[str]] = {}
        for employee in problem.employees:
            if not employee.active:
                continue
            pod_id = str(employee.pod_id)
            if pod_id not in pods:
                pods[pod_id] = []
            pods[pod_id].append(str(employee.id))

        # Check each day
        for d in days_in_range(problem.month_start, problem.month_end):
            for pod_id, emp_ids in pods.items():
                off_count = 0
                for emp_id in emp_ids:
                    entry = entries.get((emp_id, d))
                    if entry and entry.status in ("WO", "PH", "LEAVE", "COMP_OFF"):
                        off_count += 1

                # Warn if more than 50% of pod is off
                if len(emp_ids) > 2 and off_count > len(emp_ids) // 2:
                    pod = next((p for p in problem.pods if str(p.id) == pod_id), None)
                    if pod:
                        issue = Issue(
                            id=make_issue_id(RuleID.POD_OFF_CLUSTER, pod_id, d),
                            rule=RuleID.POD_OFF_CLUSTER,
                            severity=IssueSeverity.WARNING,
                            structural=False,
                            brand_id=None,
                            process_id=None,
                            employee_id=None,
                            pod_id=pod.id,
                            date=d,
                            message=f"Pod {pod.name} has {off_count}/{len(emp_ids)} employees off on {d.isoformat()}",
                            cause=f"High concentration of off days in single pod ({off_count} of {len(emp_ids)})",
                            suggestion_hint="Consider staggering off days within pod",
                        )
                        issues.append(issue)

        return issues