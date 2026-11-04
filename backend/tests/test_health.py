from unittest.mock import MagicMock
from app.main import app
from app.db.session import get_db
from fastapi.testclient import TestClient

# ponytail: override get_db to prevent remote connection hang
mock_db = MagicMock()
app.dependency_overrides[get_db] = lambda: mock_db
client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}
