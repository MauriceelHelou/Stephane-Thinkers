from fastapi.testclient import TestClient


def test_connection_explanations(client: TestClient, sample_thinker: dict, sample_thinker_2: dict):
    note = client.post('/api/notes/', json={
        'title': 'CE',
        'content': f"{sample_thinker['name']} engages {sample_thinker_2['name']} in argument.",
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    assert note.status_code == 201

    detect = client.post(f"/api/notes/{note.json()['id']}/detect-thinkers")
    assert detect.status_code == 200

    response = client.get('/api/analysis/connection-explanations')
    assert response.status_code == 200
    assert isinstance(response.json(), list)
