from fastapi.testclient import TestClient


def test_related_excerpts(client: TestClient, sample_thinker: dict):
    note_1 = client.post('/api/notes/', json={
        'title': 'R1',
        'content': 'habit and praxis in one line',
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    note_2 = client.post('/api/notes/', json={
        'title': 'R2',
        'content': 'habit and praxis in another line',
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    assert note_1.status_code == 201
    assert note_2.status_code == 201

    term = client.post('/api/critical-terms/', json={'name': 'habit'})
    assert term.status_code == 201
    term_id = term.json()['id']

    occ = client.get(f'/api/critical-terms/{term_id}/occurrences')
    assert occ.status_code == 200
    occurrence_id = occ.json()[0]['id']

    response = client.get(f'/api/analysis/related-excerpts?occurrence_id={occurrence_id}')
    assert response.status_code == 200
    assert isinstance(response.json(), list)
