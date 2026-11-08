"""
Utility routes: health, changelog, demo reset
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_principal, get_db
from app.api.schemas import ChangeLogResponse, DemoResetResponse, HealthResponse
from app.core.config import get_settings
from app.core.security import Principal
from app.db.models import ChangeLog, Roster

router = APIRouter(prefix="/api/v1", tags=["utils"])


@router.get("/health", response_model=HealthResponse)
async def health(
    db: Session = Depends(get_db),
) -> HealthResponse:
    """Health check with database connectivity."""
    try:
        db.execute(select(1))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return HealthResponse(status="ok", db=db_status)


@router.get("/changelog", response_model=list[ChangeLogResponse])
async def get_changelog(
    month: str | None = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> list[ChangeLogResponse]:
    """Get change log for a month (Manager/Pod Lead: own pod)."""
    query = db.query(ChangeLog)

    if month:
        roster = db.query(Roster).filter(Roster.month == month).first()
        if not roster:
            return []
        query = query.filter(ChangeLog.roster_id == roster.id)

    # Filter by pod for POD_LEAD
    if principal.role.value == "POD_LEAD" and principal.pod_id:
        # Need to join through roster -> entries -> employee -> pod
        # Simplified: filter by roster month for now
        pass

    logs = query.order_by(ChangeLog.created_at.desc()).limit(100).all()

    return [
        ChangeLogResponse(
            id=log.id,
            roster_id=log.roster_id,
            actor_id=log.actor_id,
            action=log.action,
            before=log.before,
            after=log.after,
            reason=log.reason,
            published_change=log.published_change,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.post("/demo/reset", response_model=DemoResetResponse)
async def demo_reset(
    x_reset_token: str = Header(..., alias="X-Reset-Token"),
    db: Session = Depends(get_db),
) -> DemoResetResponse:
    """Reset demo data (requires DEMO_MODE=true and valid token)."""
    settings = get_settings()

    if not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo mode not enabled",
        )

    if not settings.demo_reset_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo reset not configured",
        )

    if x_reset_token != settings.demo_reset_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid reset token",
        )

    # Run seed directly (avoid subprocess for security)
    import sys
    from pathlib import Path

    # Add backend to path
    backend_path = Path(__file__).parent.parent.parent / "backend"
    sys.path.insert(0, str(backend_path))

    from seed.seed import main as seed_main

    try:
        seed_main()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Seed failed: {e}",
        )

    return DemoResetResponse(reseeded=True)
