from fastapi.testclient import TestClient


def test_quality_report_returns_metrics(client: TestClient, sample_thinker: dict):
    note = client.post('/api/notes/', json={
        'title': 'Quality note',
        'content': 'habit appears here however it may vary therefore context matters.',
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    assert note.status_code == 201
    term = client.post('/api/critical-terms/', json={'name': 'habit'})
    assert term.status_code == 201
    term_id = term.json()['id']

    synth = client.get(f'/api/critical-terms/{term_id}/synthesis?mode=critical')
    assert synth.status_code == 200

    response = client.get(f'/api/critical-terms/{term_id}/quality-report')
    assert response.status_code == 200
    payload = response.json()
    assert 'coverage_rate' in payload
    assert 'uncertainty_label' in payload
