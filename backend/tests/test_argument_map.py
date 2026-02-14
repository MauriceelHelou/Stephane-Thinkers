from fastapi.testclient import TestClient


def test_argument_map_generation(client: TestClient, sample_note: dict):
    response = client.post('/api/analysis/argument-map', json={
        'note_ids': [sample_note['id']],
        'title': 'Test argument map',
    })
    assert response.status_code == 200
    payload = response.json()
    assert 'nodes' in payload
    assert 'edges' in payload


def test_premise_gap_check(client: TestClient, sample_note: dict):
    response = client.post('/api/analysis/premise-gap-check', json={'note_ids': [sample_note['id']]})
    assert response.status_code == 200
    assert 'gaps' in response.json()
