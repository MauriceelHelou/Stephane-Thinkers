from fastapi.testclient import TestClient


def _seed_term_with_notes(client: TestClient, sample_thinker: dict, sample_thinker_2: dict) -> str:
    note_a = client.post(
        "/api/notes/",
        json={
            "title": "Definition context A",
            "content": (
                "habit appears as disciplined practice in communal settings; however its scope shifts "
                "across pedagogical contexts."
            ),
            "note_type": "research",
            "thinker_id": sample_thinker["id"],
        },
    )
    assert note_a.status_code == 201

    note_b = client.post(
        "/api/notes/",
        json={
            "title": "Definition context B",
            "content": (
                "habit is framed as interpretive method and therefore functions as a structuring lens "
                "for argument in later notes."
            ),
            "note_type": "research",
            "thinker_id": sample_thinker_2["id"],
        },
    )
    assert note_b.status_code == 201

    term = client.post("/api/critical-terms/", json={"name": "habit"})
    assert term.status_code == 201
    return term.json()["id"]


def test_definition_fallback_is_structured_and_cited(
    client: TestClient,
    sample_thinker: dict,
    sample_thinker_2: dict,
    monkeypatch,
):
    import app.services.notes_ai.synthesis as synthesis_service

    monkeypatch.setattr(synthesis_service, "is_ai_enabled", lambda: False)

    term_id = _seed_term_with_notes(client, sample_thinker, sample_thinker_2)
    response = client.get(f"/api/critical-terms/{term_id}/synthesis?mode=definition")
    assert response.status_code == 200
    text = response.json()["run"]["synthesis_text"]

    assert "## Definition synthesis" in text
    assert "### Working definition" in text
    assert "### Key dimensions in the evidence" in text
    assert "### Tensions and open questions" in text
    assert "[E1]" in text


def test_comparative_and_critical_fallback_keep_mode_specific_structure(
    client: TestClient,
    sample_thinker: dict,
    sample_thinker_2: dict,
    monkeypatch,
):
    import app.services.notes_ai.synthesis as synthesis_service

    monkeypatch.setattr(synthesis_service, "is_ai_enabled", lambda: False)

    term_id = _seed_term_with_notes(client, sample_thinker, sample_thinker_2)

    comparative = client.get(f"/api/critical-terms/{term_id}/synthesis?mode=comparative")
    assert comparative.status_code == 200
    comparative_text = comparative.json()["run"]["synthesis_text"]
    assert "## Comparative synthesis" in comparative_text
    assert "### Thinker-context comparison" in comparative_text
    assert "### Comparative assessment" in comparative_text
    assert "[E1]" in comparative_text

    critical = client.get(f"/api/critical-terms/{term_id}/synthesis?mode=critical")
    assert critical.status_code == 200
    critical_text = critical.json()["run"]["synthesis_text"]
    assert "## Critical synthesis" in critical_text
    assert "### Claim" in critical_text
    assert "### Objection" in critical_text
    assert "### Reply" in critical_text
    assert "[E1]" in critical_text
