from fastapi.testclient import TestClient


def test_quality_report_contains_contradiction_signals_field(client: TestClient, sample_thinker: dict):
    note = client.post('/api/notes/', json={
        'title': 'Contradiction note',
        'content': 'habit however changes therefore it stays stable.',
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    assert note.status_code == 201

    term = client.post('/api/critical-terms/', json={'name': 'habit'})
    assert term.status_code == 201
    term_id = term.json()['id']

    client.get(f'/api/critical-terms/{term_id}/synthesis?mode=critical')
    response = client.get(f'/api/critical-terms/{term_id}/quality-report')
    assert response.status_code == 200
    assert 'contradiction_signals' in response.json()
