from app.services.notes_ai import timeline_bootstrap_validation as validation


def _thinker(candidate_id: str, name: str):
    return {
        "candidate_id": candidate_id,
        "include": True,
        "fields": {"name": name, "birth_year": None, "death_year": None},
        "match_status": "create_new",
        "matched_thinker_id": None,
    }


def _base_graph():
    return {
        "timeline_candidate": {"name": "Test Timeline", "start_year": None, "end_year": None},
        "thinkers": [
            _thinker("thinker_a", "Isaac Newton"),
            _thinker("thinker_b", "Gottfried Leibniz"),
            _thinker("thinker_c", "Albert Einstein"),
            _thinker("thinker_d", "Niels Bohr"),
        ],
        "events": [],
        "connections": [],
        "publications": [],
        "quotes": [],
        "warnings": [],
    }


def test_validate_graph_warns_on_low_relationship_signal(monkeypatch):
    graph = _base_graph()
    monkeypatch.setattr(validation, "STRICT_RELATION_GATE", False)
    monkeypatch.setattr(validation, "RELATION_GATE_MIN_THINKERS", 4)
    monkeypatch.setattr(validation, "STRICT_EVIDENCE_GATE", False)

    diagnostics = validation.validate_graph(graph)

    assert diagnostics["has_blocking"] is False
    assert any(item["code"] == "relationship_signal_low" for item in diagnostics["non_blocking"])


def test_validate_graph_blocks_on_low_relationship_signal_when_strict(monkeypatch):
    graph = _base_graph()
    monkeypatch.setattr(validation, "STRICT_RELATION_GATE", True)
    monkeypatch.setattr(validation, "RELATION_GATE_MIN_THINKERS", 4)
    monkeypatch.setattr(validation, "STRICT_EVIDENCE_GATE", False)

    diagnostics = validation.validate_graph(graph)

    assert diagnostics["has_blocking"] is True
    assert any(item["code"] == "relationship_signal_low" for item in diagnostics["blocking"])


def test_validate_graph_blocks_when_included_candidate_has_no_evidence(monkeypatch):
    graph = _base_graph()
    graph["events"] = [
        {
            "candidate_id": "event_1",
            "include": True,
            "fields": {"name": "Test Event", "year": 1950, "event_type": "publication"},
            "dependency_keys": [],
            "evidence": [],
        }
    ]
    monkeypatch.setattr(validation, "STRICT_EVIDENCE_GATE", True)

    diagnostics = validation.validate_graph(graph)

    assert diagnostics["has_blocking"] is True
    assert any(item["code"] == "candidate_evidence_missing" for item in diagnostics["blocking"])
