from fastapi.testclient import TestClient


def test_propose_and_approve_alias(client: TestClient):
    term = client.post('/api/critical-terms/', json={'name': 'habit'})
    assert term.status_code == 201
    term_id = term.json()['id']

    proposed = client.post(f'/api/critical-terms/{term_id}/aliases/propose', json={'alias_name': 'habitus'})
    assert proposed.status_code in [200, 201]
    alias_id = proposed.json()['id']

    approved = client.post(f'/api/critical-terms/{term_id}/aliases/{alias_id}/approve')
    assert approved.status_code == 200
    assert approved.json()['status'] == 'approved'
