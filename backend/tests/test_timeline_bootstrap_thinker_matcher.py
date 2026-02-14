from app.services.notes_ai import timeline_bootstrap_thinker_matcher as matcher


class _FakeThinker:
    def __init__(self, thinker_id, name, birth_year=None, death_year=None, active_period=None, field=None, biography_notes=None):
        self.id = thinker_id
        self.name = name
        self.birth_year = birth_year
        self.death_year = death_year
        self.active_period = active_period
        self.field = field
        self.biography_notes = biography_notes


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeDB:
    def __init__(self, thinkers):
        self._thinkers = thinkers

    def query(self, _model):
        return _FakeQuery(self._thinkers)


def test_apply_thinker_matching_autofills_canonical_metadata(monkeypatch):
    monkeypatch.setattr(matcher, "AUTOPOPULATE_CANONICAL_FIELDS", True)
    monkeypatch.setattr(matcher, "AUTOPOPULATE_MIN_SCORE", 0.9)

    db = _FakeDB(
        [
            _FakeThinker(
                thinker_id="t-descartes",
                name="Rene Descartes",
                birth_year=1596,
                death_year=1650,
                field="philosophy",
            )
        ]
    )

    graph = {
        "thinkers": [
            {
                "candidate_id": "thinker_candidate_1",
                "fields": {"name": "Rene Descartes", "birth_year": None, "death_year": None, "field": None},
                "metadata_delta": {},
            }
        ]
    }

    hydrated = matcher.apply_thinker_matching(db, graph)
    candidate = hydrated["thinkers"][0]

    assert candidate["matched_thinker_id"] == "t-descartes"
    assert candidate["fields"]["birth_year"] == 1596
    assert candidate["fields"]["death_year"] == 1650
    assert candidate["fields"]["field"] == "philosophy"
    assert "autofilled_from_canonical" in candidate["metadata_delta"]

