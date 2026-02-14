from fastapi.testclient import TestClient


def test_semantic_search(client: TestClient, sample_note: dict):
    response = client.get('/api/analysis/semantic-search?q=compare')
    assert response.status_code == 200
    assert isinstance(response.json(), list)
