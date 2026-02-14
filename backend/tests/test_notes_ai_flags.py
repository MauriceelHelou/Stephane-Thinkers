from fastapi.testclient import TestClient


def _create_term(client: TestClient, name: str = 'habit') -> str:
    response = client.post('/api/critical-terms/', json={'name': name})
    assert response.status_code == 201
    return response.json()['id']


def test_phase_a_disabled_blocks_evidence_map(client: TestClient, monkeypatch):
    import app.routes.critical_terms as critical_terms_route
    monkeypatch.setattr(critical_terms_route, 'notes_ai_phase_enabled', lambda phase: False)

    term_id = _create_term(client, 'phasea-disabled')
    response = client.get(f'/api/critical-terms/{term_id}/evidence-map')
    assert response.status_code == 503


def test_phase_a_enabled_allows_evidence_map(client: TestClient, monkeypatch, sample_thinker: dict):
    import app.routes.critical_terms as critical_terms_route
    monkeypatch.setattr(critical_terms_route, 'notes_ai_phase_enabled', lambda phase: True)

    client.post('/api/notes/', json={
        'title': 'Habit memo',
        'content': 'habit appears in this excerpt with [[Meister Eckhart]].',
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    term_id = _create_term(client, 'habit')

    response = client.get(f'/api/critical-terms/{term_id}/evidence-map')
    assert response.status_code == 200
    data = response.json()
    assert 'stats' in data
    assert 'excerpts' in data
