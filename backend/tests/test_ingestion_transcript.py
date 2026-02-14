from fastapi.testclient import TestClient


def test_ingest_transcript_and_job_status(client: TestClient):
    response = client.post('/api/ingestion/transcript', json={
        'file_name': 'seminar.txt',
        'content': 'transcribed seminar notes',
    })
    assert response.status_code == 200
    payload = response.json()
    assert payload['job_id']

    status = client.get(f"/api/jobs/{payload['job_id']}")
    assert status.status_code == 200
    assert status.json()['status'] in ['queued', 'running', 'completed']
