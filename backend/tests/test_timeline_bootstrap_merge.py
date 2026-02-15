import pytest

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


def test_merge_coerces_lexical_confidence_labels_without_crash():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Plato",
            "confidence": "high",
            "evidence": [_ev(0, 0, 5, "Plato")],
        },
        {
            "name": "Aristotle",
            "confidence": "medium",
            "evidence": [_ev(0, 10, 19, "Aristotle")],
        },
    ]
    output["events"] = [
        {
            "name": "Academy founded",
            "year": "387",
            "event_type": "institution_founding",
            "confidence": "medium",
            "evidence": [_ev(0, 20, 45, "By 387 BCE, Plato had founded the Academy.")],
        }
    ]
    output["connections"] = [
        {
            "from_name": "Plato",
            "to_name": "Aristotle",
            "connection_type": "influenced",
            "confidence": "very high",
            "evidence": [_ev(0, 46, 85, "Aristotle studied at Plato's Academy.")],
        }
    ]
    output["publications"] = [
        {
            "thinker_name": "Plato",
            "title": "Republic",
            "year": None,
            "publication_type": "dialogue",
            "confidence": "low",
            "evidence": [_ev(0, 90, 110, "dialogues like the Republic")],
        }
    ]
    output["quotes"] = [
        {
            "thinker_name": "Plato",
            "text": "No one is more hated than he who speaks the truth.",
            "confidence": "55%",
            "evidence": [_ev(0, 120, 160, "No one is more hated...")],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")

    by_name = {row["fields"]["name"]: row for row in graph["thinkers"]}
    assert by_name["Plato"]["confidence"] == pytest.approx(0.85)
    assert by_name["Aristotle"]["confidence"] == pytest.approx(0.6)
    assert graph["events"][0]["confidence"] == pytest.approx(0.6)
    assert graph["connections"][0]["confidence"] == pytest.approx(0.92)
    assert graph["publications"][0]["confidence"] == pytest.approx(0.35)
    assert graph["quotes"][0]["confidence"] == pytest.approx(0.55)


def test_merge_dedupes_repeated_warnings():
    output = _base_output()
    output["warnings"] = ["Repeated warning", "Repeated warning"]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    assert graph["warnings"] == ["Repeated warning"]


def test_merge_compacts_repetitive_model_warning_categories():
    output = _base_output()
    output["warnings"] = [
        "Note: first extraction caveat",
        "Note: second extraction caveat",
        "Omitted 'foo' due to missing evidence",
        "Omitted 'bar' due to missing evidence",
        "Connection 'A critiqued B' included but 'B' is not a thinker",
        "Connection 'C influenced D' included but 'D' is not a thinker",
        "Connection 'Plato influenced Marxism' omitted: target endpoint 'Marxism' is a movement",
        "Connection 'Epicurus critiqued Stoicism' omitted: target endpoint 'Stoicism' is a school",
        "Year enrichment from model context is disabled while strict grounding mode is enabled.",
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    warnings = graph["warnings"]

    assert any("Model extraction notes:" in warning for warning in warnings)
    assert any("Model omission notes:" in warning for warning in warnings)
    assert any("Model non-thinker connection notes:" in warning for warning in warnings)
    assert any("Model connection omission notes:" in warning for warning in warnings)
    assert any("Year enrichment from model context is disabled" in warning for warning in warnings)


def test_merge_preserves_multiple_connection_types_per_pair_with_single_default_include():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Plato",
            "confidence": 0.9,
            "evidence": [_ev(0, 0, 5, "Plato")],
        },
        {
            "name": "Aristotle",
            "confidence": 0.9,
            "evidence": [_ev(0, 10, 19, "Aristotle")],
        },
    ]
    output["connections"] = [
        {
            "from_name": "Plato",
            "to_name": "Aristotle",
            "connection_type": "influenced",
            "confidence": 0.82,
            "evidence": [_ev(0, 20, 58, "Plato influenced Aristotle.")],
        },
        {
            "from_name": "Plato",
            "to_name": "Aristotle",
            "connection_type": "critiqued",
            "confidence": 0.73,
            "evidence": [_ev(0, 60, 100, "Plato also critiqued Aristotle in debates.")],
        },
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    connections = graph["connections"]

    assert len(connections) == 2
    by_type = {row["fields"]["connection_type"]: row for row in connections}
    assert by_type["influenced"]["include"] is True
    assert by_type["critiqued"]["include"] is False
    assert any("Multiple relation types extracted for pair" in warning for warning in graph["warnings"])


def test_merge_connection_endpoint_resolution_does_not_fall_back_to_context():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Epicurus",
            "confidence": 0.9,
            "evidence": [_ev(0, 0, 8, "Epicurus")],
        }
    ]
    output["connections"] = [
        {
            "from_name": "Epicurus",
            "to_name": "Stoic",
            "connection_type": "critiqued",
            "confidence": 0.7,
            "evidence": [_ev(0, 10, 45, "Epicurus critiqued Stoic austerity.")],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    assert graph["connections"] == []
    assert any(
        "unmatched endpoints" in warning or "non-thinker endpoint references" in warning
        for warning in graph["warnings"]
    )


def test_merge_aggregates_connection_skip_warnings():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Epicurus",
            "confidence": 0.9,
            "evidence": [_ev(0, 0, 8, "Epicurus")],
        },
        {
            "name": "Plato",
            "confidence": 0.9,
            "evidence": [_ev(0, 10, 15, "Plato")],
        },
    ]
    output["connections"] = [
        {
            "from_name": "Epicurus",
            "to_name": "Stoic",
            "connection_type": "critiqued",
            "confidence": 0.7,
            "evidence": [_ev(0, 20, 55, "Epicurus critiqued Stoic austerity.")],
        },
        {
            "from_name": "Plato",
            "to_name": "Marxism",
            "connection_type": "influenced",
            "confidence": 0.7,
            "evidence": [_ev(0, 56, 84, "Plato influenced Marxism.")],
        },
        {
            "from_name": "Aristotle",
            "to_name": "Aquinas",
            "connection_type": "influenced",
            "confidence": 0.7,
            "evidence": [_ev(0, 85, 120, "Aristotle influenced Aquinas.")],
        },
        {
            "from_name": "Aquinas",
            "to_name": "Aristotle",
            "connection_type": "built_upon",
            "confidence": 0.7,
            "evidence": [_ev(0, 121, 160, "Aquinas built upon Aristotle.")],
        },
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")

    non_person_warnings = [w for w in graph["warnings"] if "non-thinker endpoint references" in w]
    unmatched_warnings = [w for w in graph["warnings"] if "unmatched endpoints" in w]
    assert len(non_person_warnings) == 1
    assert len(unmatched_warnings) == 1
    assert "2 total" in non_person_warnings[0]
    assert "2 total" in unmatched_warnings[0]


def test_merge_resolves_quote_thinker_from_attribution_context_with_multiple_names():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Rene Descartes",
            "confidence": 0.9,
            "evidence": [_ev(0, 0, 14, "Rene Descartes")],
        },
        {
            "name": "Baruch Spinoza",
            "confidence": 0.9,
            "evidence": [_ev(0, 20, 34, "Baruch Spinoza")],
        },
    ]
    output["quotes"] = [
        {
            "thinker_name": None,
            "text": "I think, therefore I am.",
            "context_notes": (
                "In debates between Rene Descartes and Baruch Spinoza, "
                "Rene Descartes wrote I think therefore I am."
            ),
            "confidence": 0.72,
            "evidence": [_ev(0, 35, 80, "Rene Descartes wrote I think therefore I am.")],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    by_name = {row["fields"]["name"]: row["candidate_id"] for row in graph["thinkers"]}
    quote = graph["quotes"][0]

    assert quote["fields"]["thinker_candidate_id"] == by_name["Rene Descartes"]
    assert quote["include"] is True


def test_merge_resolves_publication_thinker_from_attribution_context_with_multiple_names():
    output = _base_output()
    output["thinkers"] = [
        {
            "name": "Rene Descartes",
            "confidence": 0.9,
            "evidence": [_ev(0, 0, 14, "Rene Descartes")],
        },
        {
            "name": "Baruch Spinoza",
            "confidence": 0.9,
            "evidence": [_ev(0, 20, 34, "Baruch Spinoza")],
        },
    ]
    output["publications"] = [
        {
            "thinker_name": None,
            "title": "Discourse on Method",
            "year": 1637,
            "publication_type": "book",
            "notes": (
                "Baruch Spinoza critiqued Rene Descartes, and Rene Descartes published Discourse on Method."
            ),
            "confidence": 0.78,
            "evidence": [_ev(0, 35, 110, "Rene Descartes published Discourse on Method.")],
        }
    ]

    graph = merge_extraction_outputs([output], timeline_name_hint="Test")
    by_name = {row["fields"]["name"]: row["candidate_id"] for row in graph["thinkers"]}
    publication = graph["publications"][0]

    assert publication["fields"]["thinker_candidate_id"] == by_name["Rene Descartes"]
    assert publication["include"] is True
