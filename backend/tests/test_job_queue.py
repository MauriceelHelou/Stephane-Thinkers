from fastapi.testclient import TestClient

from app.models.notes_ai import IngestionJob
from app.utils.queue import QueueExecutionResult


def test_job_not_found(client: TestClient):
    response = client.get('/api/jobs/00000000-0000-0000-0000-000000000000')
    assert response.status_code == 404


def test_cancel_queued_job(client: TestClient, monkeypatch):
    def _fake_enqueue(*args, **kwargs):
        return QueueExecutionResult(mode='queued', job_id=kwargs.get('job_id'))

    monkeypatch.setattr('app.routes.ingestion.enqueue_or_run', _fake_enqueue)

    create = client.post('/api/ingestion/transcript', json={
        'file_name': 'seminar.txt',
        'content': 'transcribed seminar notes',
    })
    assert create.status_code == 200
    job_id = create.json()['job_id']

    cancel = client.post(f'/api/jobs/{job_id}/cancel')
    assert cancel.status_code == 200
    assert cancel.json()['status'] == 'cancelled'


def test_retry_failed_job(client: TestClient, db):
    job = IngestionJob(
        job_type='transcript',
        status='failed',
        payload_json='{"file_name": "seminar.txt", "content": "retry me"}',
        error_message='boom',
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    retry = client.post(f'/api/jobs/{job.id}/retry')
    assert retry.status_code == 200
    assert retry.json()['status'] in ['queued', 'running', 'completed']
