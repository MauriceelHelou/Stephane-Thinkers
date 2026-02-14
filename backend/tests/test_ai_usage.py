from fastapi.testclient import TestClient


def test_ai_usage_endpoint(client: TestClient):
    response = client.get('/api/analysis/ai-usage')
    assert response.status_code == 200
    payload = response.json()
    assert "day" in payload
    assert "used_tokens" in payload
    assert "daily_quota_tokens" in payload
