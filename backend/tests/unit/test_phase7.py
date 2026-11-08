"""
Unit tests for Phase 7: Approval workflow, AI explanation fallback, and export security.
"""

from datetime import date
from unittest.mock import MagicMock
from uuid import uuid4

from app.api.routes.explain import generate_template_explanation
from app.api.routes.rosters import _sanitize_csv_cell
from app.db.models import (
    ApprovalStatus,
    DayStatus,
    Employee,
    Roster,
    RosterApproval,
    RosterEntry,
    RosterStatus,
)
from app.services.engine_service import update_entry


def test_sanitize_csv_formula_injection() -> None:
    """Formula characters must be prepended with a single quote."""
    assert _sanitize_csv_cell("=SUM(A1:A10)") == "'=SUM(A1:A10)"
    assert _sanitize_csv_cell("+cmd|'/C calc'!A0") == "'+cmd|'/C calc'!A0"
    assert _sanitize_csv_cell("-123") == "'-123"
    assert _sanitize_csv_cell("@something") == "'@something"
    assert _sanitize_csv_cell("Normal Name") == "Normal Name"
    assert _sanitize_csv_cell(None) == ""


def test_template_explanation_generation() -> None:
    """Template explanations produce informative sentences without external API."""
    mock_issue = MagicMock()
    mock_issue.message = "Process has 0 coverage"
    mock_issue.cause = "Primary employee on leave"
    mock_issue.suggestion_hint = "Assign floater backup"
    mock_issue.rule = "COV_ZERO"
    mock_issue.date = date(2026, 12, 5)

    exp = generate_template_explanation(mock_issue)
    assert "Process has 0 coverage" in exp
    assert "Cause: Primary employee on leave." in exp
    assert "Recommended action: Assign floater backup." in exp


def test_update_entry_resets_pod_approval_in_review() -> None:
    """Editing an entry when roster is IN_REVIEW resets that pod's approval to PENDING."""
    db = MagicMock()
    roster_id = uuid4()
    pod_id = uuid4()
    emp_id = uuid4()

    mock_roster = MagicMock(spec=Roster)
    mock_roster.id = roster_id
    mock_roster.month = "2026-12"
    mock_roster.status = RosterStatus.IN_REVIEW

    mock_entry = MagicMock(spec=RosterEntry)
    mock_entry.roster_id = roster_id
    mock_entry.employee_id = emp_id
    mock_entry.date = date(2026, 12, 10)
    mock_entry.status = DayStatus.WORK
    mock_entry.source = MagicMock()
    mock_entry.source.value = "GENERATED"
    mock_entry.locked = False

    mock_employee = MagicMock(spec=Employee)
    mock_employee.id = emp_id
    mock_employee.pod_id = pod_id

    mock_approval = MagicMock(spec=RosterApproval)
    mock_approval.roster_id = roster_id
    mock_approval.pod_id = pod_id
    mock_approval.status = ApprovalStatus.APPROVED
    mock_approval.comment = "Looks good"
    mock_approval.decided_by = uuid4()

    def query_mock(*models):
        model = models[0] if models else None
        m = MagicMock()
        if model is Roster:
            m.filter.return_value.first.return_value = mock_roster
        elif getattr(model, "__name__", "") == "RosterEntry":
            m.filter.return_value.first.return_value = mock_entry
            m.filter.return_value.all.return_value = [mock_entry]
        elif model is Employee:
            m.filter.return_value.first.return_value = mock_employee
        elif model is RosterApproval:
            m.filter.return_value.first.return_value = mock_approval
        else:
            m.filter.return_value.all.return_value = []
            m.filter.return_value.first.return_value = None
            m.filter.return_value.distinct.return_value.all.return_value = []
        return m

    db.query.side_effect = query_mock

    # Run update_entry
    update_entry(db, "2026-12", emp_id, date(2026, 12, 10), DayStatus.WO)

    # Verify pod approval was reset to PENDING
    assert mock_approval.status == ApprovalStatus.PENDING
    assert mock_approval.comment is None
    assert mock_approval.decided_by is None
