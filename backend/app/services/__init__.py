"""
Services package.
"""

from __future__ import annotations

from app.services.engine_service import (
    add_cover,
    apply_suggestion,
    build_problem,
    generate_suggestions,
    get_impact_preview,
    get_roster_with_issues,
    persist_roster_result,
    remove_cover,
    solve_roster_for_month,
    update_entry,
    validate_roster_entries,
)

__all__ = [
    "build_problem",
    "solve_roster_for_month",
    "validate_roster_entries",
    "persist_roster_result",
    "get_roster_with_issues",
    "update_entry",
    "add_cover",
    "remove_cover",
    "get_impact_preview",
    "generate_suggestions",
    "apply_suggestion",
]
