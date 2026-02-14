"""
Application constants and configuration values.
"""
import os

API_VERSION = "1.0.1"


def _env_bool(key: str, default: bool) -> bool:
    value = os.getenv(key)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


# Plan 9 feature flags (enabled by default for development velocity).
FEATURE_NOTES_AI_PHASE_A = _env_bool("FEATURE_NOTES_AI_PHASE_A", True)
FEATURE_NOTES_AI_PHASE_B = _env_bool("FEATURE_NOTES_AI_PHASE_B", True)
FEATURE_NOTES_AI_PHASE_C = _env_bool("FEATURE_NOTES_AI_PHASE_C", True)
FEATURE_NOTES_AI_PHASE_D = _env_bool("FEATURE_NOTES_AI_PHASE_D", True)
FEATURE_NOTES_AI_PHASE_E = _env_bool("FEATURE_NOTES_AI_PHASE_E", True)
FEATURE_NOTES_AI_PHASE_F = _env_bool("FEATURE_NOTES_AI_PHASE_F", True)
FEATURE_NOTES_AI_TIMELINE_BOOTSTRAP = _env_bool("FEATURE_NOTES_AI_TIMELINE_BOOTSTRAP", True)


def notes_ai_phase_enabled(phase: str) -> bool:
    phase_key = phase.strip().upper()
    mapping = {
        "A": FEATURE_NOTES_AI_PHASE_A,
        "B": FEATURE_NOTES_AI_PHASE_B,
        "C": FEATURE_NOTES_AI_PHASE_C,
        "D": FEATURE_NOTES_AI_PHASE_D,
        "E": FEATURE_NOTES_AI_PHASE_E,
        "F": FEATURE_NOTES_AI_PHASE_F,
    }
    return mapping.get(phase_key, False)


def notes_ai_timeline_bootstrap_enabled() -> bool:
    return FEATURE_NOTES_AI_TIMELINE_BOOTSTRAP
