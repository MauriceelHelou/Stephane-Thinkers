from app.services.notes_ai import timeline_bootstrap_extract as extract
from app.services.notes_ai.timeline_bootstrap_chunking import TextChunk


def test_heuristic_extract_captures_extended_relation_verbs():
    chunk = TextChunk(
        index=0,
        text=(
            "Albert Einstein challenged Isaac Newton in public lectures. "
            "Niels Bohr debated with Albert Einstein on interpretation."
        ),
        char_start=0,
        char_end=120,
        token_estimate=32,
        paragraphs=[],
    )

    payload = extract._heuristic_extract(chunk)
    connections = payload.get("connections", [])

    assert connections
    relation_pairs = {
        (row.get("from_name"), row.get("to_name"), row.get("connection_type"))
        for row in connections
    }
    assert ("Albert Einstein", "Isaac Newton", "critiqued") in relation_pairs
    assert ("Niels Bohr", "Albert Einstein", "critiqued") in relation_pairs


def test_extract_chunk_entities_augments_llm_payload_with_heuristics(monkeypatch):
    chunk = TextChunk(
        index=0,
        text="Hannah Arendt influenced Michel Foucault.",
        char_start=0,
        char_end=42,
        token_estimate=12,
        paragraphs=[],
    )

    def _fake_llm_extract(*args, **kwargs):
        return {
            "thinkers": [],
            "events": [],
            "connections": [],
            "publications": [],
            "quotes": [],
            "warnings": [],
        }

    monkeypatch.setattr(extract, "_llm_extract", _fake_llm_extract)

    payload = extract.extract_chunk_entities(chunk)
    connections = payload.get("connections", [])
    assert len(connections) >= 1
    assert any(
        row.get("from_name") == "Hannah Arendt"
        and row.get("to_name") == "Michel Foucault"
        for row in connections
    )


def test_extract_chunk_entities_drops_ungrounded_llm_thinker(monkeypatch):
    chunk = TextChunk(
        index=0,
        text="Hannah Arendt influenced Michel Foucault.",
        char_start=0,
        char_end=42,
        token_estimate=12,
        paragraphs=[],
    )

    def _fake_llm_extract(*args, **kwargs):
        return {
            "thinkers": [
                {
                    "name": "Completely Fabricated Figure",
                    "birth_year": 999,
                    "death_year": 1000,
                    "confidence": 0.95,
                    "evidence": [],
                }
            ],
            "events": [],
            "connections": [],
            "publications": [],
            "quotes": [],
            "warnings": [],
        }

    monkeypatch.setattr(extract, "_llm_extract", _fake_llm_extract)

    payload = extract.extract_chunk_entities(chunk)
    thinker_names = [row.get("name") for row in payload.get("thinkers", [])]
    assert "Completely Fabricated Figure" not in thinker_names
    assert any("Dropped 1 ungrounded thinkers candidate" in warning for warning in payload.get("warnings", []))


def test_extract_chunk_entities_drops_connection_without_relation_support(monkeypatch):
    chunk = TextChunk(
        index=0,
        text="Plato and Aristotle are discussed in this chapter.",
        char_start=0,
        char_end=48,
        token_estimate=14,
        paragraphs=[],
    )

    def _fake_llm_extract(*args, **kwargs):
        return {
            "thinkers": [],
            "events": [],
            "connections": [
                {
                    "from_name": "Plato",
                    "to_name": "Aristotle",
                    "connection_type": "influenced",
                    "confidence": 0.8,
                    "evidence": [],
                }
            ],
            "publications": [],
            "quotes": [],
            "warnings": [],
        }

    monkeypatch.setattr(extract, "_llm_extract", _fake_llm_extract)

    payload = extract.extract_chunk_entities(chunk)
    assert payload.get("connections") == []
    assert any("Dropped 1 ungrounded connections candidate" in warning for warning in payload.get("warnings", []))


def test_extract_chunk_entities_drops_publication_when_title_not_in_text(monkeypatch):
    chunk = TextChunk(
        index=0,
        text="In 1637, Rene Descartes published a method treatise.",
        char_start=0,
        char_end=53,
        token_estimate=15,
        paragraphs=[],
    )

    def _fake_llm_extract(*args, **kwargs):
        return {
            "thinkers": [],
            "events": [],
            "connections": [],
            "publications": [
                {
                    "thinker_name": "Rene Descartes",
                    "title": "Meditations on First Philosophy",
                    "year": 1641,
                    "publication_type": "book",
                    "confidence": 0.9,
                    "evidence": [],
                }
            ],
            "quotes": [],
            "warnings": [],
        }

    monkeypatch.setattr(extract, "_llm_extract", _fake_llm_extract)

    payload = extract.extract_chunk_entities(chunk)
    assert all(
        row.get("title") != "Meditations on First Philosophy"
        for row in payload.get("publications", [])
    )
    assert any("Dropped 1 ungrounded publications candidate" in warning for warning in payload.get("warnings", []))


def test_extract_chunk_entities_drops_event_without_name_grounding(monkeypatch):
    chunk = TextChunk(
        index=0,
        text="By 1781, the debate intensified across Europe.",
        char_start=0,
        char_end=45,
        token_estimate=13,
        paragraphs=[],
    )

    def _fake_llm_extract(*args, **kwargs):
        return {
            "thinkers": [],
            "events": [
                {
                    "name": "Kant Publishes Critique of Pure Reason",
                    "year": 1781,
                    "event_type": "publication",
                    "confidence": 0.84,
                    "evidence": [],
                }
            ],
            "connections": [],
            "publications": [],
            "quotes": [],
            "warnings": [],
        }

    monkeypatch.setattr(extract, "_llm_extract", _fake_llm_extract)

    payload = extract.extract_chunk_entities(chunk)
    assert all(
        row.get("name") != "Kant Publishes Critique of Pure Reason"
        for row in payload.get("events", [])
    )
    assert any("Dropped 1 ungrounded events candidate" in warning for warning in payload.get("warnings", []))
