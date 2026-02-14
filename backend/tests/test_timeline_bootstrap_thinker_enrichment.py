from app.services.notes_ai import timeline_bootstrap_thinker_enrichment as enrichment


def _graph_with_thinkers():
    return {
        "thinkers": [
            {
                "candidate_id": "thinker_descartes",
                "fields": {"name": "Rene Descartes", "birth_year": None, "death_year": None},
                "metadata_delta": {},
            },
            {
                "candidate_id": "thinker_spinoza",
                "fields": {"name": "Baruch Spinoza", "birth_year": 1632, "death_year": None},
                "metadata_delta": {},
            },
        ],
        "warnings": [],
        "summary": {},
    }


def test_enrich_thinker_years_fills_missing_fields(monkeypatch):
    graph = _graph_with_thinkers()

    monkeypatch.setattr(enrichment, "ENRICH_ENABLED", True)
    monkeypatch.setattr(enrichment, "STRICT_EVIDENCE_GATE", False)
    monkeypatch.setattr(enrichment, "ENRICH_MIN_CONFIDENCE", 0.5)
    monkeypatch.setattr(
        enrichment,
        "_run_enrichment_query",
        lambda names: {
            "rene descartes": {"birth_year": 1596, "death_year": 1650, "confidence": 0.99},
            "baruch spinoza": {"birth_year": 1630, "death_year": 1677, "confidence": 0.9},
        },
    )

    enriched = enrichment.enrich_thinker_years(graph)
    by_name = {item["fields"]["name"].lower(): item for item in enriched["thinkers"]}

    assert by_name["rene descartes"]["fields"]["birth_year"] == 1596
    assert by_name["rene descartes"]["fields"]["death_year"] == 1650
    assert by_name["baruch spinoza"]["fields"]["birth_year"] == 1632
    assert by_name["baruch spinoza"]["fields"]["death_year"] == 1677
    assert "year_enrichment" in by_name["rene descartes"]["metadata_delta"]
    assert "year_enrichment" in by_name["baruch spinoza"]["metadata_delta"]
    assert enriched["summary"]["thinker_year_enrichment"]["requested"] == 2
    assert enriched["summary"]["thinker_year_enrichment"]["applied"] == 2
    assert any("Filled missing thinker birth/death years" in warning for warning in enriched["warnings"])


def test_enrich_thinker_years_skips_low_confidence_or_invalid_pairs(monkeypatch):
    graph = _graph_with_thinkers()

    monkeypatch.setattr(enrichment, "ENRICH_ENABLED", True)
    monkeypatch.setattr(enrichment, "STRICT_EVIDENCE_GATE", False)
    monkeypatch.setattr(enrichment, "ENRICH_MIN_CONFIDENCE", 0.8)
    monkeypatch.setattr(
        enrichment,
        "_run_enrichment_query",
        lambda names: {
            "rene descartes": {"birth_year": 1660, "death_year": 1650, "confidence": 0.99},
            "baruch spinoza": {"birth_year": 1632, "death_year": 1677, "confidence": 0.3},
        },
    )

    enriched = enrichment.enrich_thinker_years(graph)
    by_name = {item["fields"]["name"].lower(): item for item in enriched["thinkers"]}

    assert by_name["rene descartes"]["fields"]["birth_year"] is None
    assert by_name["rene descartes"]["fields"]["death_year"] is None
    assert by_name["baruch spinoza"]["fields"]["birth_year"] == 1632
    assert by_name["baruch spinoza"]["fields"]["death_year"] is None
    assert enriched["summary"]["thinker_year_enrichment"]["requested"] == 2
    assert enriched["summary"]["thinker_year_enrichment"]["applied"] == 0


def test_enrich_thinker_years_disabled_in_strict_grounding_mode(monkeypatch):
    graph = _graph_with_thinkers()

    monkeypatch.setattr(enrichment, "ENRICH_ENABLED", True)
    monkeypatch.setattr(enrichment, "STRICT_EVIDENCE_GATE", True)
    monkeypatch.setattr(enrichment, "ALLOW_UNGROUNDED_YEAR_ENRICHMENT", False)

    enriched = enrichment.enrich_thinker_years(graph)
    by_name = {item["fields"]["name"].lower(): item for item in enriched["thinkers"]}

    assert by_name["rene descartes"]["fields"]["birth_year"] is None
    assert by_name["rene descartes"]["fields"]["death_year"] is None
    assert enriched["summary"]["thinker_year_enrichment"]["disabled_reason"] == "strict_grounding_mode"
    assert any("strict grounding mode" in warning.lower() for warning in enriched["warnings"])


def test_extract_enrichment_map_parses_reasoning_prefixed_json():
    raw = (
        "I will reason briefly first.\n"
        'Final JSON: {"thinkers":[{"name":"Rene Descartes","birth_year":1596,"death_year":1650,"confidence":0.94}]}\n'
    )
    parsed = enrichment._extract_enrichment_map(raw)
    assert parsed["rene descartes"]["birth_year"] == 1596
    assert parsed["rene descartes"]["death_year"] == 1650


def test_run_enrichment_query_falls_back_to_chat_model(monkeypatch):
    monkeypatch.setattr(enrichment, "ENRICH_MODEL", "deepseek-reasoner")
    monkeypatch.setattr(enrichment, "_is_dev_test_environment", lambda: False)
    monkeypatch.setattr(enrichment, "is_ai_enabled", lambda: True)

    calls = []

    async def _fake_call(messages, temperature, max_tokens, model=None):
        calls.append(model)
        if model == "deepseek-reasoner":
            return "reasoning without json"
        return '{"thinkers":[{"name":"Rene Descartes","birth_year":1596,"death_year":1650,"confidence":0.99}]}'

    monkeypatch.setattr(enrichment, "_call_deepseek_api", _fake_call)

    result = enrichment._run_enrichment_query(["Rene Descartes"])
    assert result["rene descartes"]["birth_year"] == 1596
    assert calls == ["deepseek-reasoner", "deepseek-chat"]
