from fastapi.testclient import TestClient


def test_ingest_pdf_highlights(client: TestClient):
    response = client.post('/api/ingestion/pdf-highlights', json={
        'file_name': 'paper-highlights.txt',
        'content': 'highlight one\nhighlight two',
    })
    assert response.status_code == 200
    assert 'job_id' in response.json()
