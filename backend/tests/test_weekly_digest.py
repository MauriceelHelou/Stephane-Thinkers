from datetime import datetime, timedelta

from fastapi.testclient import TestClient


def test_weekly_digest_creates_and_returns_latest(client: TestClient, sample_note: dict, monkeypatch):
    import app.services.notes_ai.planning as planning_service

    monkeypatch.setattr(planning_service, '_llm_planning_enabled', lambda: False)

    today = datetime.utcnow().date()
    period_start = (today - timedelta(days=6)).isoformat()
    period_end = today.isoformat()

    response = client.post(
        f'/api/analysis/weekly-digest?period_start={period_start}&period_end={period_end}'
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['period_start'] == period_start
    assert payload['period_end'] == period_end
    assert 'Weekly Digest' in payload['digest_markdown']

    latest_response = client.get('/api/analysis/weekly-digest/latest')
    assert latest_response.status_code == 200
    latest = latest_response.json()
    assert latest['id'] == payload['id']


def test_weekly_digest_uses_llm_payload(client: TestClient, sample_note: dict, monkeypatch):
    import app.services.notes_ai.planning as planning_service

    monkeypatch.setattr(planning_service, '_llm_planning_enabled', lambda: True)
    monkeypatch.setattr(
        planning_service,
        '_run_llm_json',
        lambda **_: {
            'digest_markdown': (
                '## Weekly Digest (2026-01-01 to 2026-01-07)\n'
                '\n'
                '### Wins\n'
                '- Consolidated chapter framing.\n'
            )
        },
    )

    response = client.post('/api/analysis/weekly-digest?period_start=2026-01-01&period_end=2026-01-07')
    assert response.status_code == 200
    payload = response.json()
    assert payload['digest_markdown'].startswith('## Weekly Digest (2026-01-01 to 2026-01-07)')
