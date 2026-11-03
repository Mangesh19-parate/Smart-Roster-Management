from abc import ABC, abstractmethod
from datetime import date

from app.engine.types import (
    CoverAssignment,
    Issue,
    IssueSeverity,
    Problem,
    RosterEntry,
    RuleID,
)


class Rule(ABC):
    """Base protocol for validator rules."""

    @property
    @abstractmethod
    def rule_id(self) -> RuleID:
        """Unique rule identifier."""
        pass

    @property
    @abstractmethod
    def severity(self) -> IssueSeverity:
        """Severity of the issue."""
        pass

    @property
    @abstractmethod
    def is_structural(self) -> bool:
        """Whether this is a structural feasibility issue."""
        pass

    @abstractmethod
    def check(
        self,
        problem: Problem,
        entries: dict[tuple[str, date], RosterEntry],
        covers: dict[tuple[str, str, date], CoverAssignment],
    ) -> list[Issue]:
        """Check the rule and return any issues found."""
        pass


def make_issue_id(rule: RuleID, subject: str, date: date | None = None) -> str:
    """Create a stable issue ID from rule, subject, and optional date."""
    parts = [rule.value, subject]
    if date:
        parts.append(date.isoformat())
    return "|".join(parts)


class Validator:
    """Runs all validator rules against a roster."""

    def __init__(self, rules: list[Rule]):
        self.rules = rules

    def validate(
        self,
        problem: Problem,
        entries: list[RosterEntry],
        covers: list[CoverAssignment],
    ) -> list[Issue]:
        """Run all rules and return combined issues."""
        entries_dict = {(str(e.employee_id), e.date): e for e in entries}
        covers_dict = {(str(c.employee_id), str(c.process_id), c.date): c for c in covers}

        all_issues = []
        for rule in self.rules:
            issues = rule.check(problem, entries_dict, covers_dict)
            all_issues.extend(issues)

        # Sort by severity (ERROR first), then by rule ID, then by date
        severity_order = {IssueSeverity.ERROR: 0, IssueSeverity.WARNING: 1, IssueSeverity.INFO: 2}
        all_issues.sort(key=lambda i: (
            severity_order[i.severity],
            i.rule.value,
            i.date.isoformat() if i.date else "",
        ))

        return all_issues

    def get_errors(self, issues: list[Issue]) -> list[Issue]:
        """Filter issues to only ERROR severity."""
        return [i for i in issues if i.severity == IssueSeverity.ERROR]

    def get_warnings(self, issues: list[Issue]) -> list[Issue]:
        """Filter issues to only WARNING severity."""
        return [i for i in issues if i.severity == IssueSeverity.WARNING]

    def get_structural(self, issues: list[Issue]) -> list[Issue]:
        """Filter issues to only structural issues."""
        return [i for i in issues if i.structural]