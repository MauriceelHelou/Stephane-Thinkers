from fastapi.testclient import TestClient


def test_draft_from_excerpts(client: TestClient, sample_thinker: dict):
    note = client.post('/api/notes/', json={
        'title': 'Draft source',
        'content': 'habit appears here for drafting.',
        'note_type': 'research',
        'thinker_id': sample_thinker['id'],
    })
    assert note.status_code == 201

    term = client.post('/api/critical-terms/', json={'name': 'habit'})
    assert term.status_code == 201
    term_id = term.json()['id']

    occ = client.get(f'/api/critical-terms/{term_id}/occurrences')
    assert occ.status_code == 200
    occurrences = occ.json()
    assert occurrences

    response = client.post('/api/notes/draft-from-excerpts', json={
        'excerpt_ids': [occurrences[0]['id']],
        'tone': 'scholarly',
        'max_length': 400,
    })
    assert response.status_code == 200
    data = response.json()
    assert 'draft' in data
    assert isinstance(data['citations'], list)
