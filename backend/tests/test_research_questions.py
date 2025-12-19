"""Tests for Research Question API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestResearchQuestionsAPI:
    """Test suite for /api/research-questions endpoints."""

    def test_create_research_question(self, client: TestClient):
        """Test creating a new research question."""
        response = client.post("/api/research-questions/", json={
            "title": "How did Kant influence Hegel?",
            "description": "Exploring the philosophical lineage",
            "category": "influence",
            "status": "open",
            "priority": 3
        })
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "How did Kant influence Hegel?"
        assert data["category"] == "influence"
        assert data["status"] == "open"
        assert data["priority"] == 3

    def test_create_research_question_all_categories(self, client: TestClient):
        """Test creating questions with all valid categories."""
        categories = ["influence", "periodization", "methodology", "biography", "other"]
        
        for i, category in enumerate(categories):
            response = client.post("/api/research-questions/", json={
                "title": f"Question {i} - {category}",
                "category": category,
                "status": "open",
                "priority": 2
            })
            assert response.status_code == 201, f"Failed for category: {category}"

    def test_create_research_question_all_statuses(self, client: TestClient):
        """Test creating questions with all valid statuses."""
        statuses = ["open", "in_progress", "answered", "abandoned"]
        
        for i, status in enumerate(statuses):
            response = client.post("/api/research-questions/", json={
                "title": f"Status Question {i} - {status}",
                "category": "other",
                "status": status,
                "priority": 2
            })
            assert response.status_code == 201, f"Failed for status: {status}"

    def test_create_research_question_priority_bounds(self, client: TestClient):
        """Test priority validation bounds."""
        # Valid priorities (1-5)
        for priority in [1, 2, 3, 4, 5]:
            response = client.post("/api/research-questions/", json={
                "title": f"Priority {priority}",
                "category": "other",
                "status": "open",
                "priority": priority
            })
            assert response.status_code == 201
        
        # Invalid priority (6)
        response = client.post("/api/research-questions/", json={
            "title": "Invalid Priority",
            "category": "other",
            "status": "open",
            "priority": 6
        })
        assert response.status_code == 422

    def test_get_all_research_questions(self, client: TestClient, sample_research_question: dict):
        """Test getting all research questions."""
        response = client.get("/api/research-questions/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_research_questions_by_status(self, client: TestClient, sample_research_question: dict):
        """Test getting questions filtered by status."""
        response = client.get(f"/api/research-questions/?status={sample_research_question['status']}")
        assert response.status_code == 200
        data = response.json()
        assert all(q["status"] == sample_research_question["status"] for q in data)

    def test_get_research_questions_by_category(self, client: TestClient, sample_research_question: dict):
        """Test getting questions filtered by category."""
        response = client.get(f"/api/research-questions/?category={sample_research_question['category']}")
        assert response.status_code == 200

    def test_get_research_questions_by_priority(self, client: TestClient, sample_research_question: dict):
        """Test getting questions filtered by priority."""
        response = client.get(f"/api/research-questions/?priority={sample_research_question['priority']}")
        assert response.status_code == 200

    def test_get_research_question_by_id(self, client: TestClient, sample_research_question: dict):
        """Test getting a specific research question with relations."""
        response = client.get(f"/api/research-questions/{sample_research_question['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_research_question["id"]

    def test_get_research_question_not_found(self, client: TestClient):
        """Test getting non-existent question returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/research-questions/{fake_id}")
        assert response.status_code == 404

    def test_update_research_question(self, client: TestClient, sample_research_question: dict):
        """Test updating a research question."""
        response = client.put(f"/api/research-questions/{sample_research_question['id']}", json={
            "title": "Updated Question",
            "status": "in_progress",
            "priority": 5
        })
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Question"
        assert data["status"] == "in_progress"
        assert data["priority"] == 5

    def test_update_research_question_not_found(self, client: TestClient):
        """Test updating non-existent question returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/research-questions/{fake_id}", json={
            "title": "New Title"
        })
        assert response.status_code == 404

    def test_delete_research_question(self, client: TestClient, sample_research_question: dict):
        """Test deleting a research question."""
        response = client.delete(f"/api/research-questions/{sample_research_question['id']}")
        assert response.status_code == 204
        
        # Verify it's gone
        get_response = client.get(f"/api/research-questions/{sample_research_question['id']}")
        assert get_response.status_code == 404

    def test_delete_research_question_not_found(self, client: TestClient):
        """Test deleting non-existent question returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/research-questions/{fake_id}")
        assert response.status_code == 404

    def test_get_research_question_stats(self, client: TestClient, sample_research_question: dict):
        """Test getting research question statistics."""
        response = client.get("/api/research-questions/stats/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "by_status" in data
