from fastapi.testclient import TestClient


def test_evidence_map_includes_stats(client: TestClient, sample_thinker: dict):
    client.post('/api/notes/', json={
        'title': 'Term memo',
        'content': 'habit matters in this context.',
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    term = client.post('/api/critical-terms/', json={'name': 'habit'})
    assert term.status_code == 201

    term_id = term.json()['id']
    response = client.get(f'/api/critical-terms/{term_id}/evidence-map')
    assert response.status_code == 200
    payload = response.json()
    assert payload['term']['id'] == term_id
    assert 'total_occurrences' in payload['stats']
