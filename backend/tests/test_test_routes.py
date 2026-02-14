"""Tests for test-only utility routes."""
from fastapi.testclient import TestClient


class TestTestRoutes:
    def test_reset_forbidden_outside_test_env(self, client: TestClient, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "development")
        response = client.post("/api/test/reset")
        assert response.status_code == 403

    def test_reset_clears_quiz_data(self, client: TestClient, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "test")

        timeline = client.post("/api/timelines/", json={"name": "Reset Timeline"}).json()
        thinker = client.post(
            "/api/thinkers/",
            json={
                "name": "Reset Thinker",
                "birth_year": 1900,
                "timeline_id": timeline["id"],
            },
        ).json()
        assert thinker["name"] == "Reset Thinker"

        generated = client.post(
            "/api/quiz/generate-quiz",
            json={
                "question_categories": ["birth_year"],
                "difficulty": "easy",
                "question_count": 1,
                "multiple_choice_ratio": 1.0,
            },
        )
        assert generated.status_code == 200

        before = client.get("/api/quiz/history")
        assert before.status_code == 200
        assert len(before.json()) == 1

        reset = client.post("/api/test/reset")
        assert reset.status_code == 200

        after = client.get("/api/quiz/history")
        assert after.status_code == 200
        assert after.json() == []
