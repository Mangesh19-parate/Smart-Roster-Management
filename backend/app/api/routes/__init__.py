"""
API routes package.
"""
from __future__ import annotations

# Import all route modules to register them
from app.api.routes import approval, auth, changes, config, explain, leaves, rosters, utils

__all__ = ["auth", "config", "leaves", "rosters", "changes", "approval", "explain", "utils"]