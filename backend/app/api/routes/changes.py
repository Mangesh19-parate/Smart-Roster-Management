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
    IssueResponse,
    SuggestionApplyResponse,
    SuggestionResponse,
)
from app.core.security import Principal
from app.services.engine_service import (
    apply_suggestion,
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
    """Apply a suggestion with real database mutation and before/after issue diffing."""
    data = get_roster_with_issues(db, month)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    initial_issues = data["issues"]
    issue_ids = [i.id for i in initial_issues]

    # Look up the target suggestion
    all_suggestions = generate_suggestions(db, month, issue_ids)
    matching_sugg = next((s for s in all_suggestions if s["id"] == suggestion_id), None)

    # If not found directly by exact ID, construct candidate from ID format sugg_{issue_id}_cover_{employee_id}
    if not matching_sugg and suggestion_id.startswith("sugg_") and "_cover_" in suggestion_id:
        parts = suggestion_id.split("_cover_")
        target_emp_id = parts[1] if len(parts) > 1 else None
        target_issue_id = parts[0][len("sugg_") :] if len(parts) > 0 else None
        target_issue = next((i for i in initial_issues if i.id == target_issue_id), None)
        if target_issue and target_issue.process_id and target_issue.date and target_emp_id:
            matching_sugg = {
                "id": suggestion_id,
                "kind": "ADD_COVER",
                "actions": [
                    {
                        "type": "ADD_COVER",
                        "employee_id": target_emp_id,
                        "process_id": str(target_issue.process_id),
                        "date": target_issue.date.isoformat(),
                    }
                ],
            }

    if not matching_sugg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion not found or no longer applicable",
        )

    # Perform real transactional mutation
    try:
        _, _, issues_after = apply_suggestion(db, month, matching_sugg)

        initial_ids = {i.id for i in initial_issues}
        after_ids = {i.id for i in issues_after}
        new_issues = [i for i in issues_after if i.id not in initial_ids]
        resolved_issues = [i for i in initial_issues if i.id not in after_ids]
        affected_brands = list(
            {str(i.brand_id) for i in new_issues + resolved_issues if i.brand_id}
        )

        db.commit()

        return SuggestionApplyResponse(
            applied=True,
            issues=[
                IssueResponse(
                    id=i.id,
                    rule=i.rule,
                    severity=i.severity,
                    structural=i.structural,
                    brand_id=i.brand_id,
                    process_id=i.process_id,
                    employee_id=i.employee_id,
                    pod_id=i.pod_id,
                    date=i.date,
                    message=i.message,
                    cause=i.cause,
                    suggestion_hint=i.suggestion_hint,
                )
                for i in issues_after
            ],
            impact=ImpactResponse(
                new_issues=[
                    IssueResponse(
                        id=i.id,
                        rule=i.rule,
                        severity=i.severity,
                        structural=i.structural,
                        brand_id=i.brand_id,
                        process_id=i.process_id,
                        employee_id=i.employee_id,
                        pod_id=i.pod_id,
                        date=i.date,
                        message=i.message,
                        cause=i.cause,
                        suggestion_hint=i.suggestion_hint,
                    )
                    for i in new_issues
                ],
                resolved_issues=[
                    IssueResponse(
                        id=i.id,
                        rule=i.rule,
                        severity=i.severity,
                        structural=i.structural,
                        brand_id=i.brand_id,
                        process_id=i.process_id,
                        employee_id=i.employee_id,
                        pod_id=i.pod_id,
                        date=i.date,
                        message=i.message,
                        cause=i.cause,
                        suggestion_hint=i.suggestion_hint,
                    )
                    for i in resolved_issues
                ],
                affected_brands=affected_brands,
            ),
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to apply suggestion: {e}",
        )
