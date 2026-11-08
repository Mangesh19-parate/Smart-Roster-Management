"""
AI and template issue explanations (Tier B).
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_principal, get_db
from app.api.schemas import ExplainRequest, ExplainResponse, ExplainSource
from app.core.config import get_settings
from app.core.security import Principal
from app.services.engine_service import get_roster_with_issues

router = APIRouter(prefix="/api/v1", tags=["explain"])

_explanation_cache: dict[tuple[str, str], ExplainResponse] = {}


def generate_template_explanation(issue: Any) -> str:
    parts = []
    if getattr(issue, "message", None):
        parts.append(str(issue.message))
    if getattr(issue, "cause", None):
        parts.append(f"Cause: {issue.cause}.")
    if getattr(issue, "suggestion_hint", None):
        parts.append(f"Recommended action: {issue.suggestion_hint}.")
    elif getattr(issue, "rule", None) == "STRUCT_NO_BACKUP":
        parts.append("Assign a backup floater to cover rest days.")
    elif getattr(issue, "rule", None) == "STRUCT_HEADCOUNT":
        parts.append("Increase process headcount or reduce minimum coverage.")
    return " ".join(parts) if parts else f"Issue {getattr(issue, 'rule', 'UNKNOWN')} detected."


@router.post("/issues/explain", response_model=ExplainResponse)
async def explain_issue(
    request: ExplainRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> ExplainResponse:
    """Explain a roster issue using Anthropic Claude or deterministic template."""
    cache_key = (request.month, request.issue_id)
    if cache_key in _explanation_cache:
        return _explanation_cache[cache_key]

    data = get_roster_with_issues(db, request.month)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    target_issue = None
    for issue in data.get("issues", []):
        if str(issue.id) == request.issue_id:
            target_issue = issue
            break

    if not target_issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found",
        )

    settings = get_settings()

    # Attempt AI if enabled and API key is present
    if settings.ai_explanations_enabled and settings.anthropic_api_key:
        try:
            from anthropic import Anthropic

            client = Anthropic(api_key=settings.anthropic_api_key, timeout=8.0)
            model_name = settings.anthropic_model or "claude-3-5-sonnet-20241022"

            prompt_data = {
                "rule": target_issue.rule,
                "severity": str(target_issue.severity),
                "date": str(target_issue.date) if getattr(target_issue, "date", None) else None,
                "message": target_issue.message,
                "cause": target_issue.cause,
                "suggestion_hint": getattr(target_issue, "suggestion_hint", None),
            }

            response = client.messages.create(
                model=model_name,
                max_tokens=300,
                system=(
                    "You explain staffing conflicts to an operations manager. "
                    "Use only the facts provided. Do not invent employees, dates, brands or rules. "
                    "Only mention actions that appear in the provided suggestions. Maximum 3 sentences."
                ),
                messages=[{"role": "user", "content": json.dumps(prompt_data)}],
            )
            if response and response.content and len(response.content) > 0:
                explanation_text = response.content[0].text.strip()
                if explanation_text:
                    res = ExplainResponse(
                        explanation=explanation_text,
                        source=ExplainSource.AI,
                    )
                    _explanation_cache[cache_key] = res
                    return res
        except Exception:
            # Fall back to template on any error or timeout
            pass

    # Deterministic fallback template
    template_text = generate_template_explanation(target_issue)
    res = ExplainResponse(
        explanation=template_text,
        source=ExplainSource.TEMPLATE,
    )
    _explanation_cache[cache_key] = res
    return res
