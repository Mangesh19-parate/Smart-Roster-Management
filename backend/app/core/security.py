"""
JWT verification and Principal for Smart Roster Management.

Supports both HS256 (local dev with supabase_jwt_secret) and RS256 (production with JWKS).
"""
from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from time import time as current_time
from uuid import UUID

import httpx
from app.core.config import get_settings
from app.db.models import UserRole
from app.db.session import get_db
from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError
from pydantic import BaseModel
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Principal:
    """Authenticated user principal with role and ownership info."""
    user_id: UUID
    email: str
    role: UserRole
    employee_id: UUID | None = None
    pod_id: UUID | None = None

    def can_manage(self) -> bool:
        return self.role == UserRole.MANAGER

    def can_manage_pod(self, pod_id: UUID) -> bool:
        if self.role == UserRole.MANAGER:
            return True
        if self.role == UserRole.POD_LEAD:
            return self.pod_id == pod_id
        return False

    def can_view_employee(self, employee_id: UUID) -> bool:
        if self.role == UserRole.MANAGER:
            return True
        if self.role == UserRole.POD_LEAD:
            # Would need to check if employee is in same pod - done at query level
            return True  # Query handles this
        if self.role == UserRole.EMPLOYEE:
            return self.employee_id == employee_id
        return False

    def can_view_pod(self, pod_id: UUID) -> bool:
        if self.role == UserRole.MANAGER:
            return True
        if self.role == UserRole.POD_LEAD:
            return self.pod_id == pod_id
        if self.role == UserRole.EMPLOYEE:
            return self.pod_id == pod_id
        return False


class TokenClaims(BaseModel):
    """Expected JWT claims from Supabase."""
    sub: str  # user_id
    email: str
    role: str  # "authenticated"
    aud: str = "authenticated"
    exp: int
    iat: int
    iss: str


class JWKSClient:
    """Client for fetching and caching JWKS from Supabase."""

    def __init__(self, supabase_url: str):
        self.jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        self._keys: dict[str, dict] = {}
        self._fetched_at: float = 0
        self._cache_ttl = 3600  # 1 hour

    async def get_key(self, kid: str) -> dict | None:
        """Get a JWK by key ID, fetching JWKS if needed."""
        if time.time() - self._fetched_at > self._cache_ttl or not self._keys:
            await self._fetch_jwks()
        return self._keys.get(kid)

    async def _fetch_jwks(self) -> None:
        """Fetch JWKS from Supabase."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(self.jwks_url)
            resp.raise_for_status()
            jwks = resp.json()
            self._keys = {key["kid"]: key for key in jwks.get("keys", [])}
            self._fetched_at = time.time()


_jwks_client: JWKSClient | None = None


def get_jwks_client() -> JWKSClient:
    """Get or create the JWKS client."""
    global _jwks_client
    settings = get_settings()
    if _jwks_client is None:
        _jwks_client = JWKSClient(settings.supabase_url)
    return _jwks_client


async def verify_jwt(token: str) -> TokenClaims:
    """
    Verify a Supabase JWT token.

    Supports:
    - HS256 with supabase_jwt_secret (local dev)
    - RS256 with JWKS (production)
    """
    settings = get_settings()

    # Try HS256 first (local dev)
    if settings.supabase_jwt_secret:
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_exp": True},
            )
            return TokenClaims(**payload)
        except ExpiredSignatureError:
            raise JWTError("Token expired")
        except JWTClaimsError as e:
            raise JWTError(f"Invalid claims: {e}")
        except JWTError:
            pass  # Fall through to RS256

    # RS256 with JWKS (production)
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise JWTError("Token missing kid header")

        jwks_client = get_jwks_client()
        key = await jwks_client.get_key(kid)
        if not key:
            raise JWTError(f"Key not found for kid: {kid}")

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience="authenticated",
            options={"verify_exp": True},
        )
        return TokenClaims(**payload)
    except ExpiredSignatureError:
        raise JWTError("Token expired")
    except JWTClaimsError as e:
        raise JWTError(f"Invalid claims: {e}")
    except JWTError:
        raise
    except Exception as e:
        raise JWTError(f"Token verification failed: {e}")


async def get_current_principal(
    authorization: str | None = Header(default=None),
    db_session=None,  # Will be injected by FastAPI dependency
) -> Principal:
    """
    FastAPI dependency to get the current authenticated principal.

    Raises:
        HTTPException 401: No token, invalid token, or expired token
        HTTPException 403: User not found in app_user table
    """
    from fastapi import HTTPException, status

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:]

    # ponytail: demo mode bypass for local development without live auth provider
    settings = get_settings()
    if settings.demo_mode and token.startswith("demo-token-"):
        role_map = {
            "demo-token-manager": UserRole.MANAGER,
            "demo-token-pod_lead": UserRole.POD_LEAD,
            "demo-token-employee": UserRole.EMPLOYEE,
        }
        role = role_map.get(token, UserRole.MANAGER)
        return Principal(
            user_id=UUID("11111111-1111-1111-1111-111111111111"),
            email=f"{role.value.lower()}@demo.local",
            role=role,
            employee_id=None if role == UserRole.MANAGER else UUID("22222222-2222-2222-2222-222222222222"),
            pod_id=None if role == UserRole.MANAGER else UUID("33333333-3333-3333-3333-333333333333"),
        )  # Remove "Bearer "

    try:
        claims = await verify_jwt(token)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Load app_user from database
    if db_session is None:
        # This will be overridden by FastAPI's dependency injection
        # The actual db session comes from the route's dependencies
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database session not available",
        )

    from app.db.models import AppUser
    user = db_session.query(AppUser).filter(AppUser.id == UUID(claims.sub)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not found in application",
        )

    return Principal(
        user_id=user.id,
        email=user.email,
        role=user.role,
        employee_id=user.employee_id,
        pod_id=user.employee.pod_id if user.employee else None,
    )


async def get_current_principal_dep(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Principal:
    """FastAPI dependency for getting the current principal."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:]

    # ponytail: demo mode bypass for local development without live auth provider
    settings = get_settings()
    if settings.demo_mode and token.startswith("demo-token-"):
        role_map = {
            "demo-token-manager": UserRole.MANAGER,
            "demo-token-pod_lead": UserRole.POD_LEAD,
            "demo-token-employee": UserRole.EMPLOYEE,
        }
        role = role_map.get(token, UserRole.MANAGER)
        return Principal(
            user_id=UUID("11111111-1111-1111-1111-111111111111"),
            email=f"{role.value.lower()}@demo.local",
            role=role,
            employee_id=None if role == UserRole.MANAGER else UUID("22222222-2222-2222-2222-222222222222"),
            pod_id=None if role == UserRole.MANAGER else UUID("33333333-3333-3333-3333-333333333333"),
        )

    try:
        claims = await verify_jwt(token)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from app.db.models import AppUser
    user = db.query(AppUser).filter(AppUser.id == UUID(claims.sub)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not found in application",
        )

    return Principal(
        user_id=user.id,
        email=user.email,
        role=user.role,
        employee_id=user.employee_id,
        pod_id=user.employee.pod_id if user.employee else None,
    )


def require_manager(principal: Principal = Depends(get_current_principal_dep)) -> Principal:
    """Require MANAGER role."""
    if not principal.can_manage():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager role required",
        )
    return principal


def require_pod_lead_or_manager(
    principal: Principal = Depends(get_current_principal_dep),
) -> Principal:
    """Require POD_LEAD or MANAGER role."""
    if principal.role not in (UserRole.MANAGER, UserRole.POD_LEAD):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pod Lead or Manager role required",
        )
    return principal


def require_any_role(principal: Principal = Depends(get_current_principal_dep)) -> Principal:
    """Any authenticated role (MANAGER, POD_LEAD, EMPLOYEE)."""
    return principal


_rate_limit_store: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(
    user_id: str,
    limit: int,
    window_seconds: int = 60,
) -> bool:
    """Check if user is within rate limit. Returns True if allowed."""
    now = current_time()
    # Clean old entries
    _rate_limit_store[user_id] = [
        t for t in _rate_limit_store[user_id] if now - t < window_seconds
    ]
    if len(_rate_limit_store[user_id]) >= limit:
        return False
    _rate_limit_store[user_id].append(now)
    return True


def rate_limit_dependency(limit: int, window_seconds: int = 60):
    """Create a rate limit dependency for a specific limit."""
    async def _rate_limit(principal: Principal = Depends(get_current_principal_dep)) -> Principal:
        if not check_rate_limit(str(principal.user_id), limit, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {limit} requests per {window_seconds}s",
            )
        return principal
    return _rate_limit