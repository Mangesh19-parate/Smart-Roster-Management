"""
API dependencies for Smart Roster Management.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import Query

from app.core.config import get_settings
from app.core.security import (
    get_current_principal_dep,
    rate_limit_dependency,
    require_any_role,
    require_manager,
    require_pod_lead_or_manager,
)
from app.db.session import get_db

# Re-export security dependencies
__all__ = [
    "get_db",
    "get_settings",
    "get_current_principal",
    "require_manager",
    "require_pod_lead_or_manager",
    "require_any_role",
    "rate_limit_generate",
    "rate_limit_explain",
    "rate_limit_default",
    "PaginationParams",
    "MonthParam",
    "ViewParam",
    "ViewIdParam",
]

# Rate limit dependencies
rate_limit_generate = rate_limit_dependency(6, 60)  # 6/min
rate_limit_explain = rate_limit_dependency(20, 60)  # 20/min
rate_limit_default = rate_limit_dependency(120, 60)  # 120/min


class PaginationParams:
    """Pagination parameters for list endpoints."""

    def __init__(
        self,
        limit: int = Query(default=100, ge=1, le=500),
        offset: int = Query(default=0, ge=0),
    ):
        self.limit = limit
        self.offset = offset


class MonthParam:
    """Month parameter in YYYY-MM format."""

    def __init__(
        self,
        month: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    ):
        self.month = month


class ViewParam:
    """View parameter for roster fetch."""

    def __init__(
        self,
        view: str | None = Query(default=None, pattern=r"^(company|pod|brand|process|employee)$"),
    ):
        self.view = view


class ViewIdParam:
    """View ID parameter for roster fetch (pod_id, brand_id, process_id, employee_id)."""

    def __init__(
        self,
        id: UUID | None = Query(default=None, alias="id"),
    ):
        self.id = id


# Auth dependencies - shortcuts
get_current_principal = get_current_principal_dep
