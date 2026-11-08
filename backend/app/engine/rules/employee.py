from collections import defaultdict
from datetime import date, timedelta

from app.engine.lib.dates import days_in_range, monday_of_week, sunday_of_week
from app.engine.types import (
    CoverAssignment,
    Issue,
    IssueSeverity,
    Problem,
    RosterEntry,
    RuleID,
)
from app.engine.validator import Rule, make_issue_id


class WOMissingRule(Rule):
    """WO_MISSING: Employee missing required weekly off day."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.WO_MISSING

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
        weekly_rest_days = problem.settings.get("weekly_rest_days", 1)

        for employee in problem.employees:
            if not employee.active:
                continue

            emp_id = str(employee.id)

            # Get all weeks that intersect the month
            current_monday = monday_of_week(problem.month_start)
            month_end_sunday = sunday_of_week(problem.month_end)

            while current_monday <= month_end_sunday:
                week_end = sunday_of_week(current_monday)

                # Check if this week has at least 4 days in the month (A11)
                week_start_in_month = max(current_monday, problem.month_start)
                week_end_in_month = min(week_end, problem.month_end)
                days_in_month = (week_end_in_month - week_start_in_month).days + 1

                if days_in_month >= 4:
                    # Count rest days in this week
                    rest_days = 0
                    for d in days_in_range(current_monday, week_end):
                        if problem.month_start <= d <= problem.month_end:
                            entry = entries.get((emp_id, d))
                            if entry and entry.status in ("WO", "PH", "LEAVE", "COMP_OFF"):
                                rest_days += 1

                    if rest_days < weekly_rest_days:
                        issue = Issue(
                            id=make_issue_id(RuleID.WO_MISSING, emp_id, current_monday),
                            rule=RuleID.WO_MISSING,
                            severity=IssueSeverity.ERROR,
                            structural=False,
                            brand_id=None,
                            process_id=None,
                            employee_id=employee.id,
                            pod_id=employee.pod_id,
                            date=current_monday,
                            message=f"{employee.name} has only {rest_days} rest day(s) in week starting {current_monday.isoformat()} (need {weekly_rest_days})",
                            cause=f"Insufficient rest days in Mon-Sun week ({current_monday} to {week_end})",
                            suggestion_hint="Add a weekly off or leave day in this week",
                        )
                        issues.append(issue)

                current_monday = week_end + timedelta(days=1)

        return issues


class ConsecMaxRule(Rule):
    """CONSEC_MAX: Employee exceeds maximum consecutive working days."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.CONSEC_MAX

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

        for employee in problem.employees:
            if not employee.active:
                continue

            emp_id = str(employee.id)
            max_consec = employee.max_consecutive_days

            consecutive = 0
            streak_start: date | None = None

            for d in days_in_range(problem.month_start, problem.month_end):
                entry = entries.get((emp_id, d))
                is_work = entry and entry.status == "WORK"

                if is_work:
                    if consecutive == 0:
                        streak_start = d
                    consecutive += 1
                else:
                    if consecutive > max_consec and streak_start:
                        issue = Issue(
                            id=make_issue_id(RuleID.CONSEC_MAX, emp_id, streak_start),
                            rule=RuleID.CONSEC_MAX,
                            severity=IssueSeverity.ERROR,
                            structural=False,
                            brand_id=None,
                            process_id=None,
                            employee_id=employee.id,
                            pod_id=employee.pod_id,
                            date=streak_start,
                            message=f"{employee.name} works {consecutive} consecutive days starting {streak_start.isoformat()} (max {max_consec})",
                            cause=f"Consecutive working days ({consecutive}) exceeds limit ({max_consec})",
                            suggestion_hint="Insert a rest day or leave in the streak",
                        )
                        issues.append(issue)
                    consecutive = 0
                    streak_start = None

            # Check streak at month end
            if consecutive > max_consec and streak_start:
                issue = Issue(
                    id=make_issue_id(RuleID.CONSEC_MAX, emp_id, streak_start),
                    rule=RuleID.CONSEC_MAX,
                    severity=IssueSeverity.ERROR,
                    structural=False,
                    brand_id=None,
                    process_id=None,
                    employee_id=employee.id,
                    pod_id=employee.pod_id,
                    date=streak_start,
                    message=f"{employee.name} works {consecutive} consecutive days starting {streak_start.isoformat()} (max {max_consec})",
                    cause=f"Consecutive working days ({consecutive}) exceeds limit ({max_consec})",
                    suggestion_hint="Insert a rest day or leave in the streak",
                )
                issues.append(issue)

        return issues


class CapacityExceededRule(Rule):
    """CAPACITY_EXCEEDED: Employee assigned more covers than max_cover_per_day."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.CAPACITY_EXCEEDED

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

        # Count covers per employee per day
        cover_counts: dict[tuple[str, date], int] = defaultdict(int)
        for cover in covers.values():
            cover_counts[(str(cover.employee_id), cover.date)] += 1

        for employee in problem.employees:
            if not employee.active:
                continue

            emp_id = str(employee.id)
            max_cover = employee.max_cover_per_day

            for (eid, d), count in cover_counts.items():
                if eid == emp_id and count > max_cover:
                    issue = Issue(
                        id=make_issue_id(RuleID.CAPACITY_EXCEEDED, emp_id, d),
                        rule=RuleID.CAPACITY_EXCEEDED,
                        severity=IssueSeverity.ERROR,
                        structural=False,
                        brand_id=None,
                        process_id=None,
                        employee_id=employee.id,
                        pod_id=employee.pod_id,
                        date=d,
                        message=f"{employee.name} has {count} cover assignments on {d.isoformat()} (max {max_cover})",
                        cause=f"Cover assignments ({count}) exceeds daily limit ({max_cover})",
                        suggestion_hint="Redistribute covers to other employees",
                    )
                    issues.append(issue)

        return issues


class CompOffUnusedRule(Rule):
    """COMPOFF_UNUSED: Employee earned comp-off but didn't use it in the same month."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.COMPOFF_UNUSED

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
            if not employee.active:
                continue

            emp_id = str(employee.id)

            # Count PH work days (earned comp-off)
            ph_worked = 0
            for d in days_in_range(problem.month_start, problem.month_end):
                entry = entries.get((emp_id, d))
                if entry and entry.status == "WORK":
                    # Check if any of employee's primary processes had a PH on this day
                    primary_process_ids = {
                        str(a.process_id)
                        for a in problem.assignments
                        if str(a.employee_id) == emp_id and a.type == "PRIMARY"
                    }
                    for proc_id in primary_process_ids:
                        process = next((p for p in problem.processes if str(p.id) == proc_id), None)
                        if process:
                            from app.engine.calendar import is_closed

                            if is_closed(process, d, problem.holidays, problem.coverage_overrides):
                                ph_worked += 1
                                break

            # Count COMP_OFF used
            compoff_used = sum(
                1
                for d in days_in_range(problem.month_start, problem.month_end)
                if entries.get((emp_id, d)) and entries[(emp_id, d)].status == "COMP_OFF"
            )

            if ph_worked > 0 and compoff_used == 0:
                issue = Issue(
                    id=make_issue_id(RuleID.COMPOFF_UNUSED, emp_id, problem.month_start),
                    rule=RuleID.COMPOFF_UNUSED,
                    severity=IssueSeverity.WARNING,
                    structural=False,
                    brand_id=None,
                    process_id=None,
                    employee_id=employee.id,
                    pod_id=employee.pod_id,
                    date=problem.month_start,
                    message=f"{employee.name} worked {ph_worked} public holiday(s) but used 0 comp-off days this month",
                    cause=f"Earned {ph_worked} comp-off credit(s) but none used within the month",
                    suggestion_hint="Schedule comp-off days to use earned credits",
                )
                issues.append(issue)

        return issues
