from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from app.core.security import Principal, get_current_principal_dep
from app.db.models import UserRole
from app.db.session import get_db
from app.main import app
from fastapi.testclient import TestClient

# ponytail: mock db session globally for API matrix tests
mock_db = MagicMock()
app.dependency_overrides[get_db] = lambda: mock_db
client = TestClient(app)


def make_principal(role: UserRole, pod_id=None, emp_id=None) -> Principal:
    return Principal(
        user_id=uuid4(),
        email=f"{role.value.lower()}@example.com",
        role=role,
        employee_id=emp_id or uuid4(),
        pod_id=pod_id or uuid4(),
    )


class TestRoleMatrixAndAuth:
    """Tests for role matrix (Manager, Pod Lead, Employee) and validation."""

    def teardown_method(self):
        # reset auth override after each test
        app.dependency_overrides.pop(get_current_principal_dep, None)

    @pytest.mark.parametrize("role", [UserRole.POD_LEAD, UserRole.EMPLOYEE])
    def test_manager_endpoints_forbidden_for_non_managers(self, role):
        """Endpoints requiring MANAGER must return 403 for POD_LEAD and EMPLOYEE."""
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(role)

        # 1. Roster generate
        res = client.post(
            "/api/v1/rosters/2025-03/generate", json={"keep_locked": False, "time_limit_s": 5}
        )
        assert res.status_code == 403
        assert "Manager role required" in res.json()["detail"]

        # 2. Submit for review
        res = client.post("/api/v1/rosters/2025-03/submit-review")
        assert res.status_code == 403
        assert "Manager role required" in res.json()["detail"]

        # 3. Publish
        res = client.post("/api/v1/rosters/2025-03/publish")
        assert res.status_code == 403
        assert "Manager role required" in res.json()["detail"]

        # 4. Config employee creation
        res = client.post(
            "/api/v1/employees", json={"name": "New Agent", "role": "AGENT", "pod_id": str(uuid4())}
        )
        assert res.status_code == 403
        assert "Manager role required" in res.json()["detail"]

    def test_pod_lead_endpoints_forbidden_for_employee(self):
        """Endpoints requiring POD_LEAD_OR_MANAGER must return 403 for EMPLOYEE."""
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(
            UserRole.EMPLOYEE
        )

        # Fairness endpoint requires Pod Lead or Manager
        res = client.get("/api/v1/rosters/2025-03/fairness")
        assert res.status_code == 403
        assert "Pod Lead or Manager role required" in res.json()["detail"]

    def test_unauthenticated_request_fails(self):
        """Requests without principal/token must fail with 401 or 403."""
        # Ensure no principal override
        app.dependency_overrides.pop(get_current_principal_dep, None)

        res = client.post("/api/v1/rosters/2025-03/generate", json={})
        assert res.status_code in (401, 403)

    @pytest.mark.parametrize(
        "url,method,body",
        [
            ("/api/v1/rosters/2025-03/generate", "post", {"time_limit_s": "not-an-int"}),
            ("/api/v1/leaves", "post", {"start_date": "invalid-date"}),
            ("/api/v1/employees", "post", {}),  # missing required fields
        ],
    )
    def test_validation_errors(self, url, method, body):
        """Invalid schemas must return 422 Unprocessable Entity."""
        # Authenticate as Manager so auth passes and Pydantic validation executes
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(
            UserRole.MANAGER
        )

        if method == "post":
            res = client.post(url, json=body)
        else:
            res = client.get(url)

        assert res.status_code == 422

    def test_health_success(self):
        """Health check returns 200."""
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"
