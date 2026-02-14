from fastapi.testclient import TestClient


def test_thesis_candidates_endpoint(client: TestClient, sample_thinker: dict):
    note = client.post('/api/notes/', json={
        'title': 'Thesis note',
        'content': 'habit guides the structure of practical reasoning.',
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    assert note.status_code == 201

    term = client.post('/api/critical-terms/', json={'name': 'habit'})
    assert term.status_code == 201

    response = client.post(f"/api/critical-terms/{term.json()['id']}/thesis-candidates")
    assert response.status_code == 200
    payload = response.json()
    assert 'candidates' in payload
