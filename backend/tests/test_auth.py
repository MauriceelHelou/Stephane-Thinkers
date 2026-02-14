"""Authentication behavior tests."""
from fastapi.testclient import TestClient


class TestAuthAPI:
    def test_login_success_returns_token(self, client: TestClient, monkeypatch):
        monkeypatch.setenv("AUTH_REQUIRED", "true")
        monkeypatch.setenv("SITE_PASSWORD", "test-password")

        response = client.post("/api/auth/login", json={"password": "test-password"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["token"], str)
        assert "." in data["token"]
        assert data["token"] != "test-password"

    def test_login_rejects_bad_password(self, client: TestClient, monkeypatch):
        monkeypatch.setenv("AUTH_REQUIRED", "true")
        monkeypatch.setenv("SITE_PASSWORD", "test-password")

        response = client.post("/api/auth/login", json={"password": "wrong"})
        assert response.status_code == 401

    def test_protected_routes_require_auth_when_bypass_disabled(
        self, client: TestClient, monkeypatch
    ):
        monkeypatch.setenv("AUTH_REQUIRED", "true")
        monkeypatch.setenv("AUTH_BYPASS_FOR_TESTS", "false")
        monkeypatch.setenv("SITE_PASSWORD", "test-password")

        unauthenticated = client.get("/api/timelines/")
        assert unauthenticated.status_code == 401

        login = client.post("/api/auth/login", json={"password": "test-password"})
        assert login.status_code == 200
        token = login.json()["token"]

        authenticated = client.get(
            "/api/timelines/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert authenticated.status_code == 200

    def test_tampered_token_is_rejected(self, client: TestClient, monkeypatch):
        monkeypatch.setenv("AUTH_REQUIRED", "true")
        monkeypatch.setenv("AUTH_BYPASS_FOR_TESTS", "false")
        monkeypatch.setenv("SITE_PASSWORD", "test-password")

        login = client.post("/api/auth/login", json={"password": "test-password"})
        assert login.status_code == 200
        token = login.json()["token"]

        tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
        response = client.get(
            "/api/timelines/",
            headers={"Authorization": f"Bearer {tampered}"},
        )
        assert response.status_code == 401

    def test_bypass_not_allowed_outside_test_environment(self, client: TestClient, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("AUTH_REQUIRED", "true")
        monkeypatch.setenv("AUTH_BYPASS_FOR_TESTS", "true")
        monkeypatch.setenv("SITE_PASSWORD", "test-password")

        response = client.get("/api/timelines/")
        assert response.status_code == 401
