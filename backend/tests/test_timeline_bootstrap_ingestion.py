import json

from app.models.connection import Connection
from app.models.notes_ai import IngestionJob


def _sample_content() -> str:
    return (
        "Hannah Arendt (1906-1975) influenced Michel Foucault (1926-1984). "
        "Hannah Arendt critiqued Michel Foucault in a later exchange. "
        "In 1951, Hannah Arendt published The Origins of Totalitarianism. "
        '"Thinking without banisters" - Hannah Arendt.'
    )


def test_preview_session_candidates_validation_commit_and_audit(client, db):
    existing = client.post(
        "/api/thinkers/",
        json={
            "name": "Hannah Arendt",
            "birth_year": 1906,
            "death_year": 1975,
            "field": "Political Philosophy",
        },
    )
    assert existing.status_code in (200, 201)
    existing_thinker_id = existing.json()["id"]

    preview = client.post(
        "/api/ingestion/text-to-timeline/preview",
        json={
            "file_name": "arendt-foucault.txt",
            "content": _sample_content(),
            "timeline_name_hint": "Arendt and Foucault",
            "start_year_hint": 1900,
            "end_year_hint": 1990,
        },
    )
    assert preview.status_code == 200, preview.text
    preview_payload = preview.json()
    session_id = preview_payload["session_id"]

    session_resp = client.get(f"/api/ingestion/text-to-timeline/sessions/{session_id}")
    assert session_resp.status_code == 200
    assert session_resp.json()["status"] in {"ready_for_review", "ready_for_review_partial", "queued", "running"}

    thinkers_resp = client.get(
        f"/api/ingestion/text-to-timeline/sessions/{session_id}/candidates",
        params={"entity_type": "thinkers", "include_evidence": True},
    )
    assert thinkers_resp.status_code == 200
    thinker_items = thinkers_resp.json()["items"]
    assert thinker_items

    arendt_candidate = next(
        item for item in thinker_items if item.get("fields", {}).get("name", "").lower() == "hannah arendt"
    )

    validation = client.put(
        f"/api/ingestion/text-to-timeline/sessions/{session_id}/validation",
        json={
            "timeline": {"name": "Arendt-Foucault Thread", "start_year": 1900, "end_year": 1990},
            "candidates": [
                {
                    "entity_type": "thinkers",
                    "candidate_id": arendt_candidate["candidate_id"],
                    "match_action": "reuse",
                    "matched_thinker_id": existing_thinker_id,
                }
            ],
        },
    )
    assert validation.status_code == 200, validation.text

    commit = client.post(
        f"/api/ingestion/text-to-timeline/sessions/{session_id}/commit",
        json={"force_skip_invalid": True},
    )
    assert commit.status_code == 200, commit.text
    commit_payload = commit.json()
    assert commit_payload["timeline_id"]
    assert commit_payload["created_counts"]["timeline"] == 1
    assert commit_payload["created_counts"]["connections"] <= 1

    second_commit = client.post(
        f"/api/ingestion/text-to-timeline/sessions/{session_id}/commit",
        json={"force_skip_invalid": True},
    )
    assert second_commit.status_code == 200
    assert second_commit.json()["timeline_id"] == commit_payload["timeline_id"]

    audit = client.get(f"/api/ingestion/text-to-timeline/sessions/{session_id}/audit")
    assert audit.status_code == 200
    assert audit.json()["id_mappings"]

    created_connection_count = db.query(Connection).count()
    assert created_connection_count == 1


def test_preview_rejects_oversized_content(client):
    too_large = "x" * (250_000 + 1)
    response = client.post(
        "/api/ingestion/text-to-timeline/preview",
        json={
            "file_name": "too-large.txt",
            "content": too_large,
        },
    )
    assert response.status_code == 422


def test_retry_failed_timeline_preview_job_dispatches_correct_worker(client, db, monkeypatch):
    payload = {
        "file_name": "retry.txt",
        "content": "Short retry content",
        "timeline_name_hint": "Retry Timeline",
    }

    job = IngestionJob(
        job_type="text_to_timeline_preview",
        status="failed",
        payload_json=json.dumps(payload),
        error_message="boom",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    captured = {}

    def _fake_enqueue(func, *args, **kwargs):
        captured["func_name"] = getattr(func, "__name__", str(func))
        captured["args"] = args
        captured["kwargs"] = kwargs
        return type("R", (), {"mode": "queued", "job_id": kwargs.get("job_id")})()

    monkeypatch.setattr("app.routes.jobs.enqueue_or_run", _fake_enqueue)

    retry = client.post(f"/api/jobs/{job.id}/retry")
    assert retry.status_code == 200
    assert retry.json()["status"] == "queued"
    assert captured["func_name"] == "dispatch_ingestion_job"
    assert captured["args"][0] == "text_to_timeline_preview"


def test_preview_enriches_thinker_years_from_model_context(client, monkeypatch):
    from app.services.notes_ai import timeline_bootstrap_thinker_enrichment as enrichment

    monkeypatch.setattr(enrichment, "ENRICH_ENABLED", True)
    monkeypatch.setattr(enrichment, "STRICT_EVIDENCE_GATE", False)
    monkeypatch.setattr(enrichment, "ENRICH_MIN_CONFIDENCE", 0.5)
    monkeypatch.setattr(
        enrichment,
        "_run_enrichment_query",
        lambda names: {
            "rene descartes": {"birth_year": 1596, "death_year": 1650, "confidence": 0.99},
            "baruch spinoza": {"birth_year": 1632, "death_year": 1677, "confidence": 0.99},
        },
    )

    preview = client.post(
        "/api/ingestion/text-to-timeline/preview",
        json={
            "file_name": "cartesians.txt",
            "content": (
                "Rene Descartes influenced Baruch Spinoza through shared metaphysical questions. "
                "Baruch Spinoza critiqued Rene Descartes in later debates."
            ),
            "timeline_name_hint": "Cartesian Lineage",
        },
    )
    assert preview.status_code == 200, preview.text
    session_id = preview.json()["session_id"]

    session_resp = client.get(f"/api/ingestion/text-to-timeline/sessions/{session_id}")
    assert session_resp.status_code == 200, session_resp.text
    telemetry = session_resp.json().get("telemetry", {}) or {}
    enrichment_telemetry = telemetry.get("thinker_year_enrichment", {}) or {}
    assert enrichment_telemetry.get("applied", 0) >= 2

    thinkers_resp = client.get(
        f"/api/ingestion/text-to-timeline/sessions/{session_id}/candidates",
        params={"entity_type": "thinkers"},
    )
    assert thinkers_resp.status_code == 200, thinkers_resp.text
    thinker_items = thinkers_resp.json()["items"]
    assert thinker_items

    by_name = {item.get("fields", {}).get("name", "").strip().lower(): item for item in thinker_items}
    assert by_name["rene descartes"]["fields"]["birth_year"] == 1596
    assert by_name["rene descartes"]["fields"]["death_year"] == 1650
    assert by_name["baruch spinoza"]["fields"]["birth_year"] == 1632
    assert by_name["baruch spinoza"]["fields"]["death_year"] == 1677


def test_preview_relation_recovery_pathway_adds_connections(client, monkeypatch):
    from app.services.notes_ai import ingestion_jobs as worker

    monkeypatch.setattr(worker, "should_use_full_context", lambda _token_estimate: True)
    monkeypatch.setattr(worker, "RELATION_RECOVERY_MIN_THINKERS", 2)
    monkeypatch.setattr(
        worker,
        "extract_full_text_entities",
        lambda _content: {
            "thinkers": [
                {
                    "name": "Hannah Arendt",
                    "birth_year": 1906,
                    "death_year": 1975,
                    "field": None,
                    "active_period": None,
                    "biography_notes": None,
                    "confidence": 0.9,
                    "evidence": [{"chunk_index": 0, "char_start": 0, "char_end": 13, "excerpt": "Hannah Arendt"}],
                },
                {
                    "name": "Michel Foucault",
                    "birth_year": 1926,
                    "death_year": 1984,
                    "field": None,
                    "active_period": None,
                    "biography_notes": None,
                    "confidence": 0.9,
                    "evidence": [{"chunk_index": 0, "char_start": 30, "char_end": 45, "excerpt": "Michel Foucault"}],
                },
            ],
            "events": [],
            "connections": [],
            "publications": [],
            "quotes": [],
            "warnings": [],
        },
    )
    monkeypatch.setattr(
        worker,
        "extract_relation_salvage_entities",
        lambda _content, thinker_names: {
            "thinkers": [],
            "events": [],
            "connections": [
                {
                    "from_name": "Hannah Arendt",
                    "to_name": "Michel Foucault",
                    "connection_type": "critiqued",
                    "name": None,
                    "notes": "Recovered from relation pathway",
                    "confidence": 0.83,
                    "evidence": [
                        {
                            "chunk_index": 0,
                            "char_start": 0,
                            "char_end": 45,
                            "excerpt": "Hannah Arendt critiqued Michel Foucault.",
                        }
                    ],
                }
            ],
            "publications": [],
            "quotes": [],
            "warnings": [] if thinker_names else ["No thinkers provided"],
        },
    )

    preview = client.post(
        "/api/ingestion/text-to-timeline/preview",
        json={
            "file_name": "relation-recovery.txt",
            "content": "Hannah Arendt and Michel Foucault are discussed in relation.",
            "timeline_name_hint": "Recovery Test",
        },
    )
    assert preview.status_code == 200, preview.text
    session_id = preview.json()["session_id"]

    session_resp = client.get(f"/api/ingestion/text-to-timeline/sessions/{session_id}")
    assert session_resp.status_code == 200, session_resp.text
    telemetry = session_resp.json().get("telemetry", {}) or {}
    relation_recovery = telemetry.get("relation_recovery", {}) or {}
    assert relation_recovery.get("triggered") is True
    assert (relation_recovery.get("added_candidates") or {}).get("connections") == 1

    connections_resp = client.get(
        f"/api/ingestion/text-to-timeline/sessions/{session_id}/candidates",
        params={"entity_type": "connections"},
    )
    assert connections_resp.status_code == 200, connections_resp.text
    assert len(connections_resp.json().get("items", [])) == 1
