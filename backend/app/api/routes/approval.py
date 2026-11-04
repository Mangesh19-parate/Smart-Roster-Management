"""
Approval and publishing routes (Tier B - optional)
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_principal, get_db, require_manager
from app.api.schemas import (
    ApprovalDecisionRequest,
    ApprovalDecisionResponse,
    ApprovalResponse,
    EntryEditResponse,
    IssueResponse,
    RosterAmendRequest,
    RosterAmendResponse,
    RosterPublishResponse,
    RosterResponse,
)
from app.core.security import Principal
from app.db.models import (
    ApprovalStatus,
    ChangeLog,
    Roster,
    RosterApproval,
    RosterEntry,
    RosterStatus,
)

router = APIRouter(prefix="/api/v1", tags=["approval"])


@router.post("/rosters/{month}/submit-review", response_model=dict)
async def submit_review(
    month: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_manager),
) -> dict:
    """Submit roster for review (Manager only)."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    if roster.status != RosterStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Roster is not in DRAFT status",
        )

    # Check for ERROR issues
    from app.services.engine_service import get_roster_with_issues
    data = get_roster_with_issues(db, month)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    issues = data["issues"]
    error_issues = [i for i in issues if i.severity.value == "ERROR"]
    if error_issues:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot submit: {len(error_issues)} ERROR issues remain",
        )

    # Create or reset approval records for each pod
    from app.db.models import Pod
    pods = db.query(Pod).all()
    for pod in pods:
        existing = db.query(RosterApproval).filter(
            RosterApproval.roster_id == roster.id,
            RosterApproval.pod_id == pod.id,
        ).first()
        if existing:
            existing.status = ApprovalStatus.PENDING
            existing.comment = None
            existing.decided_by = None
            existing.decided_at = None
        else:
            approval = RosterApproval(
                roster_id=roster.id,
                pod_id=pod.id,
                status=ApprovalStatus.PENDING,
            )
            db.add(approval)

    roster.status = RosterStatus.IN_REVIEW
    db.flush()

    return {"roster": {"id": str(roster.id), "status": roster.status.value}, "approvals": len(pods)}


@router.post("/rosters/{month}/approvals/{pod_id}", response_model=ApprovalDecisionResponse)
async def decide_approval(
    month: str,
    pod_id: UUID,
    request: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> ApprovalDecisionResponse:
    """Decide on a pod's approval (Pod Lead for own pod, Manager for any)."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    if roster.status != RosterStatus.IN_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Roster is not in review",
        )

    # Permission check
    if principal.role.value == "POD_LEAD" and principal.pod_id != pod_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only approve for your own pod",
        )

    approval = db.query(RosterApproval).filter(
        RosterApproval.roster_id == roster.id,
        RosterApproval.pod_id == pod_id,
    ).first()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval record not found",
        )

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approval already decided",
        )

    if request.decision == ApprovalStatus.CHANGES_REQUESTED and not request.comment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment required for CHANGES_REQUESTED",
        )

    approval.status = request.decision
    approval.comment = request.comment
    approval.decided_by = principal.user_id
    approval.decided_at = datetime.utcnow()

    # If CHANGES_REQUESTED, reset roster to DRAFT
    if request.decision == ApprovalStatus.CHANGES_REQUESTED:
        roster.status = RosterStatus.DRAFT
        # Reset all approvals to PENDING
        db.query(RosterApproval).filter(RosterApproval.roster_id == roster.id).update({
            RosterApproval.status: ApprovalStatus.PENDING,
            RosterApproval.comment: None,
            RosterApproval.decided_by: None,
            RosterApproval.decided_at: None,
        })

    db.flush()

    return ApprovalDecisionResponse(
        approval=ApprovalResponse(
            id=approval.id,
            roster_id=approval.roster_id,
            pod_id=approval.pod_id,
            status=approval.status,
            comment=approval.comment,
            decided_by=approval.decided_by,
            decided_at=approval.decided_at,
            created_at=approval.created_at,
            updated_at=approval.updated_at,
        ),
    )


@router.post("/rosters/{month}/publish", response_model=RosterPublishResponse)
async def publish_roster(
    month: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_manager),
) -> RosterPublishResponse:
    """Publish roster (Manager only)."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    if roster.status != RosterStatus.IN_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Roster is not in review",
        )

    # Check all approvals are APPROVED
    approvals = db.query(RosterApproval).filter(RosterApproval.roster_id == roster.id).all()
    pending = [a for a in approvals if a.status == ApprovalStatus.PENDING]
    if pending:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{len(pending)} pods still pending approval",
        )

    changes_requested = [a for a in approvals if a.status == ApprovalStatus.CHANGES_REQUESTED]
    if changes_requested:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Some pods requested changes",
        )

    # Check for ERROR issues
    from app.services.engine_service import get_roster_with_issues
    data = get_roster_with_issues(db, month)
    issues = data["issues"]
    error_issues = [i for i in issues if i.severity.value == "ERROR"]
    if error_issues:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot publish: {len(error_issues)} ERROR issues remain",
        )

    roster.status = RosterStatus.PUBLISHED
    db.flush()

    return RosterPublishResponse(
        roster=RosterResponse(
            id=roster.id,
            month=roster.month,
            status=roster.status,
            generated_at=roster.generated_at,
            created_by=roster.created_by,
            created_at=roster.created_at,
            updated_at=roster.updated_at,
            entries=[],
            covers=[],
            demand=[],
            coverage=[],
            approvals=[],
        ),
    )


@router.post("/rosters/{month}/amend", response_model=RosterAmendResponse)
async def amend_roster(
    month: str,
    request: RosterAmendRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_manager),
) -> RosterAmendResponse:
    """Amend a published roster (Manager only)."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    if roster.status != RosterStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Roster is not published",
        )

    if not request.reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reason required for amendment",
        )

    # Apply changes
    applied = []
    for change in request.changes:
        entry = db.query(RosterEntry).filter(
            RosterEntry.roster_id == roster.id,
            RosterEntry.employee_id == change.employee_id,
            RosterEntry.date == change.date,
        ).first()

        if not entry:
            continue

        old_status = entry.status
        entry.status = change.status
        if change.locked is not None:
            entry.locked = change.locked
        entry.updated_at = datetime.utcnow()

        applied.append(EntryEditResponse(
            entry=entry,  # Simplified
            issues=[],
            impact=None,
        ))

        # Log change
        change_log = ChangeLog(
            roster_id=roster.id,
            actor_id=principal.user_id,
            action="AMEND_ENTRY",
            before={"status": old_status.value},
            after={"status": change.status.value},
            reason=request.reason,
            published_change=True,
        )
        db.add(change_log)

    db.flush()

    # Re-validate
    from app.services.engine_service import get_roster_with_issues
    data = get_roster_with_issues(db, month)
    issues = data["issues"]

    return RosterAmendResponse(
        applied=applied,
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
            for i in issues
        ],
    )


@router.get("/rosters/{month}/approvals", response_model=list[ApprovalResponse])
async def list_approvals(
    month: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> list[ApprovalResponse]:
    """List approvals for a roster."""
    roster = db.query(Roster).filter(Roster.month == month).first()
    if not roster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roster not found",
        )

    approvals = db.query(RosterApproval).filter(RosterApproval.roster_id == roster.id).all()
    return [
        ApprovalResponse(
            id=a.id,
            roster_id=a.roster_id,
            pod_id=a.pod_id,
            status=a.status,
            comment=a.comment,
            decided_by=a.decided_by,
            decided_at=a.decided_at,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in approvals
    ]
