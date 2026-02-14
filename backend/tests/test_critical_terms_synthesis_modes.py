from fastapi.testclient import TestClient


MODES = ['definition', 'comparative', 'critical']


def _seed_term(client: TestClient, sample_thinker: dict) -> str:
    note = client.post('/api/notes/', json={
        'title': 'Synthesis note',
        'content': 'habit is discussed with nuanced interpretation.',
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    assert note.status_code == 201
    term = client.post('/api/critical-terms/', json={'name': 'habit'})
    assert term.status_code == 201
    return term.json()['id']


def test_synthesis_modes(client: TestClient, sample_thinker: dict):
    term_id = _seed_term(client, sample_thinker)
    for mode in MODES:
        response = client.get(f'/api/critical-terms/{term_id}/synthesis?mode={mode}')
        assert response.status_code == 200
        payload = response.json()
        assert payload['run']['mode'] == mode
        assert isinstance(payload['citations'], list)


def test_synthesis_runs_history(client: TestClient, sample_thinker: dict):
    term_id = _seed_term(client, sample_thinker)
    client.get(f'/api/critical-terms/{term_id}/synthesis?mode=definition')
    response = client.get(f'/api/critical-terms/{term_id}/synthesis-runs')
    assert response.status_code == 200
    assert isinstance(response.json(), list)
