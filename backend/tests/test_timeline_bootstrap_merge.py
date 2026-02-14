from app.services.notes_ai.timeline_bootstrap_merge import merge_extraction_outputs


def _ev(chunk_index: int, char_start: int, char_end: int, excerpt: str):
    return {
        "chunk_index": chunk_index,
        "char_start": char_start,
        "char_end": char_end,
        "excerpt": excerpt,
    }


def _base_output():
    return {
        "thinkers": [],
        "events": [],
        "connections": [],
        "publications": [],
        "quotes": [],
        "warnings": [],
    }


def test_merge_resolves_quote_thinker_from_surname_alias():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Rene Descartes",
            "confidence": 0.92,
            "evidence": [_ev(0, 10, 24, "Rene Descartes")],
        }
    ]
    output["quotes"] = [
        {
            "thinker_name": "Descartes",
            "text": "I think, therefore I am.",
            "confidence": 0.67,
            "evidence": [_ev(0, 120, 150, '"I think, therefore I am."')],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    thinker_id = graph["thinkers"][0]["candidate_id"]
    quote = graph["quotes"][0]

    assert quote["fields"]["thinker_candidate_id"] == thinker_id
    assert quote["include"] is True
    assert not any("missing thinker attribution" in warning for warning in graph["warnings"])


def test_merge_resolves_quote_thinker_by_evidence_proximity():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Rene Descartes",
            "confidence": 0.9,
            "evidence": [_ev(0, 80, 95, "Rene Descartes")],
        }
    ]
    output["quotes"] = [
        {
            "thinker_name": None,
            "text": "I think, therefore I am.",
            "confidence": 0.62,
            "evidence": [_ev(0, 110, 140, '"I think, therefore I am."')],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    thinker_id = graph["thinkers"][0]["candidate_id"]
    quote = graph["quotes"][0]

    assert quote["fields"]["thinker_candidate_id"] == thinker_id
    assert quote["include"] is True
    assert not any("missing thinker attribution" in warning for warning in graph["warnings"])


def test_merge_marks_unlinked_quotes_excluded_by_default():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Rene Descartes",
            "confidence": 0.9,
            "evidence": [_ev(0, 10, 24, "Rene Descartes")],
        }
    ]
    output["quotes"] = [
        {
            "thinker_name": None,
            "text": "the Academy preserved Platonic metaphysics.",
            "confidence": 0.71,
            "evidence": [_ev(0, 300, 340, '"the Academy preserved Platonic metaphysics."')],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    quote = graph["quotes"][0]

    assert quote["fields"]["thinker_candidate_id"] is None
    assert quote["include"] is False
    assert any("missing thinker attribution and was excluded by default" in warning for warning in graph["warnings"])


def test_merge_skips_connection_self_loops_after_resolution():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Albert Einstein",
            "confidence": 0.9,
            "evidence": [_ev(0, 10, 25, "Albert Einstein")],
        }
    ]
    output["connections"] = [
        {
            "from_name": "Einstein",
            "to_name": "Albert Einstein",
            "connection_type": "critiqued",
            "confidence": 0.7,
            "evidence": [_ev(0, 120, 170, "Einstein debated with Albert Einstein.")],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    assert graph["connections"] == []
    assert any("self-loop endpoint resolution" in warning for warning in graph["warnings"])


def test_merge_defaults_include_false_without_evidence():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Hannah Arendt",
            "confidence": 0.9,
            "evidence": [],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    thinker = graph["thinkers"][0]
    assert thinker["include"] is False
    assert thinker["evidence"] == []


def test_merge_coerces_string_years_without_sort_crash():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Rene Descartes",
            "confidence": 0.92,
            "evidence": [_ev(0, 10, 24, "Rene Descartes")],
        }
    ]
    output["events"] = [
        {
            "name": "Discourse on Method published",
            "year": "1637",
            "event_type": "publication",
            "description": "Descartes publishes Discourse on Method.",
            "confidence": 0.74,
            "evidence": [_ev(0, 100, 150, "In 1637, Rene Descartes published Discourse on Method.")],
        }
    ]
    output["publications"] = [
        {
            "thinker_name": "Rene Descartes",
            "title": "Discourse on Method",
            "year": "1637",
            "publication_type": "book",
            "confidence": 0.8,
            "evidence": [_ev(0, 110, 145, "Discourse on Method")],
        }
    ]
    output["quotes"] = [
        {
            "thinker_name": "Rene Descartes",
            "text": "I think, therefore I am.",
            "year": "1637",
            "confidence": 0.65,
            "evidence": [_ev(0, 160, 190, '"I think, therefore I am."')],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    assert graph["events"][0]["fields"]["year"] == 1637
    assert graph["publications"][0]["fields"]["year"] == 1637
    assert graph["quotes"][0]["fields"]["year"] == 1637
