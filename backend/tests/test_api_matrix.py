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
mock_db.query.return_value.all.return_value = []
mock_db.query.return_value.filter.return_value.all.return_value = []
mock_db.query.return_value.filter.return_value.first.return_value = None
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
    """Tests for role matrix (Manager, Pod Lead, Employee), validation, and success cases."""

    def teardown_method(self):
        # reset auth override after each test
        app.dependency_overrides.pop(get_current_principal_dep, None)

    @pytest.mark.parametrize("role", [UserRole.POD_LEAD, UserRole.EMPLOYEE])
    def test_manager_endpoints_forbidden_for_non_managers(self, role):
        """Endpoints requiring MANAGER must return 403 for POD_LEAD and EMPLOYEE."""
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(role)

        for endpoint, method, body in [
            ("/api/v1/rosters/2025-03/generate", "post", {"keep_locked": False, "time_limit_s": 5}),
            (
                "/api/v1/rosters/2025-03/regenerate",
                "post",
                {"mode": "MINIMAL_CHANGE", "save": False},
            ),
            ("/api/v1/rosters/2025-03/submit-review", "post", None),
            ("/api/v1/rosters/2025-03/publish", "post", None),
            (
                "/api/v1/employees",
                "post",
                {"name": "New Agent", "role": "AGENT", "pod_id": str(uuid4())},
            ),
            ("/api/v1/pods", "post", {"name": "New Pod"}),
            ("/api/v1/brands", "post", {"name": "New Brand"}),
        ]:
            res = client.post(endpoint, json=body) if method == "post" else client.get(endpoint)
            assert res.status_code == 403
            assert "Manager role required" in res.json()["detail"]

    @pytest.mark.parametrize(
        "endpoint",
        [
            "/api/v1/rosters/2025-03/fairness",
            "/api/v1/pods",
            "/api/v1/employees",
        ],
    )
    def test_pod_lead_endpoints_forbidden_for_employee(self, endpoint):
        """Endpoints requiring POD_LEAD_OR_MANAGER must return 403 for EMPLOYEE."""
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(
            UserRole.EMPLOYEE
        )

        res = client.get(endpoint)
        assert res.status_code == 403
        assert "Pod Lead or Manager role required" in res.json()["detail"]

    def test_unauthenticated_request_fails(self):
        """Requests without principal/token must fail with 401 or 403."""
        app.dependency_overrides.pop(get_current_principal_dep, None)

        res = client.post("/api/v1/rosters/2025-03/generate", json={})
        assert res.status_code in (401, 403)

    @pytest.mark.parametrize(
        "url,method,body",
        [
            ("/api/v1/rosters/2025-03/generate", "post", {"time_limit_s": "not-an-int"}),
            ("/api/v1/rosters/2025-03/regenerate", "post", {"mode": "INVALID_MODE"}),
            ("/api/v1/leaves", "post", {"start_date": "invalid-date"}),
            ("/api/v1/leaves/preview", "post", {"start_date": "invalid"}),
            ("/api/v1/employees", "post", {}),
            ("/api/v1/pods", "post", {}),
            ("/api/v1/brands", "post", {}),
        ],
    )
    def test_validation_errors(self, url, method, body):
        """Invalid schemas must return 422 Unprocessable Entity."""
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(
            UserRole.MANAGER
        )

        res = client.post(url, json=body) if method == "post" else client.get(url)
        assert res.status_code == 422

    @pytest.mark.parametrize(
        "endpoint",
        [
            "/api/v1/pods",
            "/api/v1/employees",
            "/api/v1/brands",
            "/api/v1/processes",
            "/api/v1/assignments",
            "/api/v1/holidays",
            "/api/v1/leaves",
        ],
    )
    def test_list_endpoints_success_for_manager(self, endpoint):
        """Authenticated manager can fetch config and entity lists."""
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(
            UserRole.MANAGER
        )

        res = client.get(endpoint)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_health_success(self):
        """Health check returns 200 without authentication."""
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_unknown_demo_token_rejected_with_401(self):
        """Unknown or arbitrary demo tokens must be rejected with 401."""
        app.dependency_overrides.pop(get_current_principal_dep, None)
        res = client.get(
            "/api/v1/pods", headers={"Authorization": "Bearer demo-token-random-attacker"}
        )
        assert res.status_code == 401

    def test_pod_lead_forbidden_from_other_pod_view(self):
        """Pod Lead cannot view another pod's roster via query param tampering."""
        own_pod = uuid4()
        other_pod = uuid4()
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(
            UserRole.POD_LEAD, pod_id=own_pod
        )

        res = client.get(f"/api/v1/rosters/2026-12?view=pod&id={other_pod}")
        assert res.status_code == 403

    def test_employee_forbidden_from_other_employee_view(self):
        """Employee cannot view another employee's roster via query param tampering."""
        own_emp = uuid4()
        other_emp = uuid4()
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(
            UserRole.EMPLOYEE, emp_id=own_emp
        )

        res = client.get(f"/api/v1/rosters/2026-12?view=employee&id={other_emp}")
        assert res.status_code == 403

    def test_structural_report_endpoint(self):
        """GET /structural returns structural issues list."""
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(
            UserRole.MANAGER
        )
        res = client.get("/api/v1/structural?month=2026-12")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_coverage_override_direct_create_validation(self):
        """Coverage override requires exactly one of weekday or date."""
        app.dependency_overrides[get_current_principal_dep] = lambda: make_principal(
            UserRole.MANAGER
        )
        # Missing both weekday and date -> 400
        res = client.post(
            "/api/v1/coverage-overrides",
            json={"process_id": str(uuid4()), "min_coverage": 2},
        )
        assert res.status_code in (400, 404)
