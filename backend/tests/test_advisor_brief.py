from fastapi.testclient import TestClient


def test_advisor_brief(client: TestClient, sample_note: dict):
    response = client.post('/api/analysis/advisor-brief?date_window=last+7+days')
    assert response.status_code == 200
    payload = response.json()
    assert 'highlights' in payload
    assert 'decisions_needed' in payload
    assert 'open_risks' in payload


def test_advisor_brief_uses_llm_payload(
    client: TestClient,
    sample_note: dict,
    sample_research_question: dict,
    monkeypatch,
):
    import app.services.notes_ai.planning as planning_service

    note_id = sample_note['id']
    question_id = sample_research_question['id']

    monkeypatch.setattr(planning_service, '_llm_planning_enabled', lambda: True)
    monkeypatch.setattr(
        planning_service,
        '_run_llm_json',
        lambda **_: {
            'highlights': [f'Recent conceptual merge improved coherence (evidence: {note_id})'],
            'decisions_needed': [f'Confirm argument order for upcoming chapter (evidence: {question_id})'],
            'open_risks': ['Scope may drift if unresolved sub-questions multiply.'],
        },
    )

    response = client.post('/api/analysis/advisor-brief?date_window=last+7+days')
    assert response.status_code == 200
    payload = response.json()
    assert payload['highlights'][0].startswith('Recent conceptual merge')
    assert payload['decisions_needed'][0].startswith('Confirm argument order')
    assert payload['open_risks'][0].startswith('Scope may drift')


def test_advisor_brief_falls_back_when_llm_invalid(
    client: TestClient,
    sample_note: dict,
    sample_research_question: dict,
    monkeypatch,
):
    import app.services.notes_ai.planning as planning_service

    monkeypatch.setattr(planning_service, '_llm_planning_enabled', lambda: True)
    monkeypatch.setattr(planning_service, '_run_llm_json', lambda **_: {})

    response = client.post('/api/analysis/advisor-brief?date_window=last+7+days')
    assert response.status_code == 200
    payload = response.json()
    assert payload['highlights']
    assert payload['decisions_needed']
    assert payload['open_risks']
