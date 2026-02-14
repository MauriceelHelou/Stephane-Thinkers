import pytest

from app.utils.ai_service import (
    AIServiceError,
    _cache_payload_hash,
    _enforce_cost_controls,
    _get_cached_response,
    _get_today_key,
    _increment_daily_usage_tokens,
    _reset_ai_cost_controls_state_for_tests,
    _set_cached_response,
    estimate_token_count,
    get_ai_usage_status,
)


def test_estimate_token_count():
    assert estimate_token_count('') == 0
    assert estimate_token_count('hello world') >= 1


def test_prompt_token_cap(monkeypatch):
    _reset_ai_cost_controls_state_for_tests()
    monkeypatch.setattr('app.utils.ai_service.AI_COST_CONTROLS_ENABLED', True)
    monkeypatch.setattr('app.utils.ai_service.AI_MAX_PROMPT_TOKENS', 3)

    with pytest.raises(AIServiceError):
        _enforce_cost_controls(messages=[{"role": "user", "content": "this input is too long for cap"}], requested_max_tokens=10)


def test_daily_quota_enforced(monkeypatch):
    _reset_ai_cost_controls_state_for_tests()
    monkeypatch.setattr('app.utils.ai_service.AI_COST_CONTROLS_ENABLED', True)
    monkeypatch.setattr('app.utils.ai_service.AI_MAX_PROMPT_TOKENS', 1000)
    monkeypatch.setattr('app.utils.ai_service.AI_DAILY_SOFT_QUOTA_TOKENS', 20)

    day_key = _get_today_key()
    _increment_daily_usage_tokens(day_key, 18)

    with pytest.raises(AIServiceError):
        _enforce_cost_controls(messages=[{"role": "user", "content": "hello world"}], requested_max_tokens=5)


def test_response_cache_round_trip(monkeypatch):
    _reset_ai_cost_controls_state_for_tests()
    # Tests run with cache disabled by default; enable locally for this case.
    monkeypatch.setattr('app.utils.ai_service.AI_RESPONSE_CACHE_TTL_SECONDS', 3600)
    key = _cache_payload_hash([{"role": "user", "content": "hello"}], temperature=0.7, max_tokens=12)
    assert _get_cached_response(key) is None
    _set_cached_response(key, "cached-value")
    assert _get_cached_response(key) == "cached-value"


def test_ai_usage_status_shape():
    _reset_ai_cost_controls_state_for_tests()
    usage = get_ai_usage_status()
    assert "day" in usage
    assert "used_tokens" in usage
    assert "daily_quota_tokens" in usage
