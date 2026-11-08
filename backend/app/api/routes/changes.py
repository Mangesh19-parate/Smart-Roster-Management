"""
Changes and suggestions routes: analyze, suggestions, apply
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_pod_lead_or_manager
from app.api.schemas import (
    ChangeAnalyzeRequest,
    ChangeAnalyzeResponse,
    ImpactResponse,
    SuggestionApplyResponse,
    SuggestionResponse,
)
from app.core.security import Principal
from app.services.engine_service import (
    generate_suggestions,
    get_impact_preview,
    get_roster_with_issues,
)

router = APIRouter(prefix="/api/v1", tags=["changes"])


@router.post("/rosters/{month}/changes/analyze", response_model=ChangeAnalyzeResponse)
async def analyze_change(
    month: str,
    request: ChangeAnalyzeRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> ChangeAnalyzeResponse:
    """Analyze the impact of a change (e.g., adding a leave)."""
    # Check permissions
    if principal.role.value == "POD_LEAD":
        from app.db.models import Employee

        employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
        if not employee or employee.pod_id != principal.pod_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only analyze changes for your pod",
            )

    # Get impact preview
    impact = get_impact_preview(
        db, month, request.employee_id, request.start_date, request.end_date
    )

    # Generate suggestions for new issues
    new_issue_ids = [i.id for i in impact.new_issues]
    suggestions = generate_suggestions(db, month, new_issue_ids)

    # Convert suggestions to response format
    suggestion_responses = []
    for s in suggestions:
        suggestion_responses.append(
            SuggestionResponse(
                id=s["id"],
                kind=s["kind"],
                description=s["description"],
                fixes=[],  # Would need to convert
                may_break=[],
                entries_changed=s["entries_changed"],
                fairness_delta=s["fairness_delta"],
                actions=s["actions"],
            )
        )

    return ChangeAnalyzeResponse(
        impact=impact,
        suggestions=suggestion_responses,
    )


@router.get(
    "/rosters/{month}/issues/{issue_id}/suggestions",
    response_model=list[SuggestionResponse],
)
async def get_suggestions_for_issue(
    month: str,
    issue_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> list[SuggestionResponse]:
    """Get suggestions for a specific issue."""
    suggestions = generate_suggestions(db, month, [issue_id])

    return [
        SuggestionResponse(
            id=s["id"],
            kind=s["kind"],
            description=s["description"],
            fixes=[],
            may_break=[],
            entries_changed=s["entries_changed"],
            fairness_delta=s["fairness_delta"],
            actions=s["actions"],
        )
        for s in suggestions
    ]


@router.post(
    "/rosters/{month}/suggestions/{suggestion_id}/apply",
    response_model=SuggestionApplyResponse,
)
async def apply_suggestion_endpoint(
    month: str,
    suggestion_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_pod_lead_or_manager),
) -> SuggestionApplyResponse:
    """Apply a suggestion."""
    # Get the suggestion (in real implementation, would fetch from cache/store)
    # For now, we'll regenerate
    data = get_roster_with_issues(db, month)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    # This is simplified - in reality we'd validate the suggestion hasn't been invalidated
    # by checking a version/timestamp

    # For demo, just return success
    return SuggestionApplyResponse(
        applied=True,
        issues=[],
        impact=ImpactResponse(
            new_issues=[],
            resolved_issues=[],
            affected_brands=[],
        ),
    )
