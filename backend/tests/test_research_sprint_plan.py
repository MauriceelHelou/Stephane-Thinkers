from fastapi.testclient import TestClient


def test_research_sprint_plan(client: TestClient, sample_research_question: dict):
    response = client.post('/api/analysis/research-sprint-plan?focus=all+notes')
    assert response.status_code == 200
    payload = response.json()
    assert 'tasks' in payload
    assert isinstance(payload['tasks'], list)


def test_research_sprint_plan_uses_llm_payload(
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
            'tasks': [
                {
                    'title': 'Draft chapter framing memo',
                    'rationale': 'Consolidate current argument for advisor review.',
                    'evidence_refs': [note_id, question_id],
                }
            ]
        },
    )

    response = client.post('/api/analysis/research-sprint-plan?focus=exam+prep')
    assert response.status_code == 200
    payload = response.json()
    assert payload['focus'] == 'exam prep'
    assert payload['tasks'][0]['title'] == 'Draft chapter framing memo'
    assert note_id.lower() in payload['tasks'][0]['evidence_refs']
    assert question_id.lower() not in payload['tasks'][0]['evidence_refs']


def test_research_sprint_plan_falls_back_when_llm_invalid(
    client: TestClient,
    sample_note: dict,
    sample_research_question: dict,
    monkeypatch,
):
    import app.services.notes_ai.planning as planning_service

    monkeypatch.setattr(planning_service, '_llm_planning_enabled', lambda: True)
    monkeypatch.setattr(planning_service, '_run_llm_json', lambda **_: {'tasks': []})

    response = client.post('/api/analysis/research-sprint-plan?focus=all+notes')
    assert response.status_code == 200
    payload = response.json()
    assert payload['tasks']
    assert any(task['evidence_refs'] for task in payload['tasks'])
