from fastapi.testclient import TestClient


def test_viva_practice(client: TestClient, sample_note: dict):
    response = client.post('/api/analysis/viva-practice?topic=general')
    assert response.status_code == 200
    payload = response.json()
    assert 'questions' in payload
    assert isinstance(payload['questions'], list)


def test_viva_practice_uses_llm_payload(
    client: TestClient,
    sample_note: dict,
    monkeypatch,
):
    import app.services.notes_ai.planning as planning_service

    note_id = sample_note['id']
    monkeypatch.setattr(planning_service, '_llm_planning_enabled', lambda: True)
    monkeypatch.setattr(
        planning_service,
        '_run_llm_json',
        lambda **_: {
            'questions': [
                {
                    'question': 'How do you justify your methodological choice?',
                    'expected_answer_rubric': 'Compare alternatives and cite one concrete excerpt.',
                    'evidence_refs': [note_id],
                }
            ]
        },
    )

    response = client.post('/api/analysis/viva-practice?topic=methodology')
    assert response.status_code == 200
    payload = response.json()
    assert payload['topic'] == 'methodology'
    assert payload['questions'][0]['question'].startswith('How do you justify')
    assert note_id.lower() in payload['questions'][0]['evidence_refs']


def test_viva_practice_falls_back_when_llm_invalid(
    client: TestClient,
    sample_note: dict,
    monkeypatch,
):
    import app.services.notes_ai.planning as planning_service

    monkeypatch.setattr(planning_service, '_llm_planning_enabled', lambda: True)
    monkeypatch.setattr(planning_service, '_run_llm_json', lambda **_: {'questions': []})

    response = client.post('/api/analysis/viva-practice?topic=general')
    assert response.status_code == 200
    payload = response.json()
    assert payload['questions']
