from datetime import date, timedelta

from app.engine.lib.dates import days_in_range
from app.engine.types import (
    AssignmentType,
    CoverAssignment,
    Issue,
    IssueSeverity,
    Problem,
    RosterEntry,
    RuleID,
)
from app.engine.validator import Rule, make_issue_id


class StructNoBackupRule(Rule):
    """STRUCT_NO_BACKUP: Employee has no day in a week when all their PRIMARY processes could be covered."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.STRUCT_NO_BACKUP

    @property
    def severity(self) -> IssueSeverity:
        return IssueSeverity.ERROR

    @property
    def is_structural(self) -> bool:
        return True

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

            # Get employee's primary processes
            primary_process_ids = [
                str(a.process_id) for a in problem.assignments
                if str(a.employee_id) == emp_id and a.type == AssignmentType.PRIMARY
            ]

            if not primary_process_ids:
                continue

            # Get backup employees for these processes
            backup_emps: dict[str, list[str]] = {}
            for proc_id in primary_process_ids:
                backup_emps[proc_id] = [
                    str(a.employee_id) for a in problem.assignments
                    if str(a.process_id) == proc_id and a.type == AssignmentType.BACKUP
                ]

            # Check each week in the month
            from app.engine.lib.dates import monday_of_week, sunday_of_week
            current_monday = monday_of_week(problem.month_start)
            month_end_sunday = sunday_of_week(problem.month_end)

            while current_monday <= month_end_sunday:
                week_end = sunday_of_week(current_monday)

                # Check if week has >= 4 days in month (A11)
                week_start_in_month = max(current_monday, problem.month_start)
                week_end_in_month = min(week_end, problem.month_end)
                days_in_month = (week_end_in_month - week_start_in_month).days + 1

                if days_in_month >= 4:
                    # Check if there's ANY day in this week when all primary processes could be covered
                    has_rest_day = False
                    for d in days_in_range(current_monday, week_end):
                        if not (problem.month_start <= d <= problem.month_end):
                            continue

                        # Check if all primary processes are either closed or have backup available
                        all_covered = True
                        for proc_id in primary_process_ids:
                            process = next((p for p in problem.processes if str(p.id) == proc_id), None)
                            if not process:
                                continue

                            # Check if process is closed this day
                            from app.engine.calendar import is_closed
                            if is_closed(process, d, problem.holidays, problem.coverage_overrides):
                                continue

                            # Check if backup is available (not blocked, not already covering)
                            backup_available = False
                            for backup_emp_id in backup_emps.get(proc_id, []):
                                # Check if backup is working and not at capacity
                                backup_entry = entries.get((backup_emp_id, d))
                                if backup_entry and backup_entry.status == "WORK":
                                    # Check cover count
                                    cover_count = sum(
                                        1 for c in covers.values()
                                        if str(c.employee_id) == backup_emp_id and c.date == d
                                    )
                                    backup_emp = next((e for e in problem.employees if str(e.id) == backup_emp_id), None)
                                    if backup_emp and cover_count < backup_emp.max_cover_per_day:
                                        backup_available = True
                                        break

                            if not backup_available:
                                all_covered = False
                                break

                        if all_covered:
                            has_rest_day = True
                            break

                    if not has_rest_day:
                        issue = Issue(
                            id=make_issue_id(RuleID.STRUCT_NO_BACKUP, emp_id, current_monday),
                            rule=RuleID.STRUCT_NO_BACKUP,
                            severity=IssueSeverity.ERROR,
                            structural=True,
                            brand_id=None,
                            process_id=None,
                            employee_id=employee.id,
                            pod_id=employee.pod_id,
                            date=current_monday,
                            message=f"{employee.name} has no feasible rest day in week starting {current_monday.isoformat()}",
                            cause="No backup available to cover all primary processes on any day this week",
                            suggestion_hint="Assign backup or add floater to this employee's processes",
                        )
                        issues.append(issue)

                current_monday = week_end + timedelta(days=1)

        return issues


class StructHeadcountRule(Rule):
    """STRUCT_HEADCOUNT: Process requires more people than eligible employees (primary + backup)."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.STRUCT_HEADCOUNT

    @property
    def severity(self) -> IssueSeverity:
        return IssueSeverity.ERROR

    @property
    def is_structural(self) -> bool:
        return True

    def check(
        self,
        problem: Problem,
        entries: dict[tuple[str, date], RosterEntry],
        covers: dict[tuple[str, str, date], CoverAssignment],
    ) -> list[Issue]:
        issues = []

        for process in problem.processes:
            # Get eligible employees (primary + backup)
            primary_emps = [
                str(a.employee_id) for a in problem.assignments
                if str(a.process_id) == str(process.id) and a.type == AssignmentType.PRIMARY
            ]
            backup_emps = [
                str(a.employee_id) for a in problem.assignments
                if str(a.process_id) == str(process.id) and a.type == AssignmentType.BACKUP
            ]
            all_eligible = set(primary_emps) | set(backup_emps)

            if not all_eligible:
                continue

            # Check each day in month
            from app.engine.calendar import get_min_coverage, is_closed
            for d in days_in_range(problem.month_start, problem.month_end):
                if is_closed(process, d, problem.holidays, problem.coverage_overrides):
                    continue

                required = get_min_coverage(process, d, problem.coverage_overrides)
                if required > len(all_eligible):
                    issue = Issue(
                        id=make_issue_id(RuleID.STRUCT_HEADCOUNT, str(process.id), d),
                        rule=RuleID.STRUCT_HEADCOUNT,
                        severity=IssueSeverity.ERROR,
                        structural=True,
                        brand_id=process.brand_id,
                        process_id=process.id,
                        employee_id=None,
                        pod_id=None,
                        date=d,
                        message=f"Process {process.name} needs {required} people on {d.isoformat()} but only {len(all_eligible)} eligible",
                        cause=f"Minimum coverage ({required}) exceeds total eligible employees ({len(all_eligible)})",
                        suggestion_hint="Add more primary or backup assignments",
                    )
                    issues.append(issue)

        return issues


class AssignMissingRule(Rule):
    """ASSIGN_MISSING: Process with demand has no PRIMARY employee assigned."""

    @property
    def rule_id(self) -> RuleID:
        return RuleID.ASSIGN_MISSING

    @property
    def severity(self) -> IssueSeverity:
        return IssueSeverity.ERROR

    @property
    def is_structural(self) -> bool:
        return True

    def check(
        self,
        problem: Problem,
        entries: dict[tuple[str, date], RosterEntry],
        covers: dict[tuple[str, str, date], CoverAssignment],
    ) -> list[Issue]:
        issues = []

        for process in problem.processes:
            # Check if process has any demand in the month
            has_demand = False
            from app.engine.calendar import is_closed
            for d in days_in_range(problem.month_start, problem.month_end):
                if not is_closed(process, d, problem.holidays, problem.coverage_overrides):
                    has_demand = True
                    break

            if not has_demand:
                continue

            # Check for PRIMARY assignments
            primary_count = sum(
                1 for a in problem.assignments
                if str(a.process_id) == str(process.id) and a.type == AssignmentType.PRIMARY
            )

            if primary_count == 0:
                issue = Issue(
                    id=make_issue_id(RuleID.ASSIGN_MISSING, str(process.id), problem.month_start),
                    rule=RuleID.ASSIGN_MISSING,
                    severity=IssueSeverity.ERROR,
                    structural=True,
                    brand_id=process.brand_id,
                    process_id=process.id,
                    employee_id=None,
                    pod_id=None,
                    date=problem.month_start,
                    message=f"Process {process.name} has demand but no PRIMARY employee assigned",
                    cause="No primary assignment for a process with operating days",
                    suggestion_hint="Assign at least one PRIMARY employee to this process",
                )
                issues.append(issue)

        return issues