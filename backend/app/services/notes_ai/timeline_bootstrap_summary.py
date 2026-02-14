import asyncio
import os
from typing import Any, Dict, List

from app.utils.ai_service import AIServiceError, _call_deepseek_api, is_ai_enabled

TEST_ENV = os.getenv("ENVIRONMENT", "development") == "test"


def _fallback_summary(graph: Dict[str, Any], source_name: str) -> str:
    counts = graph.get("summary", {}).get("candidate_counts", {})
    thinkers = graph.get("thinkers", [])
    events = graph.get("events", [])
    connections = graph.get("connections", [])

    top_thinkers = ", ".join(
        item.get("fields", {}).get("name", "")
        for item in thinkers[:5]
        if item.get("fields", {}).get("name")
    )
    top_events = ", ".join(
        f"{item.get('fields', {}).get('name', 'Untitled event')} ({item.get('fields', {}).get('year', 'n.d.')})"
        for item in events[:5]
    )
    top_connections = ", ".join(
        f"{item.get('fields', {}).get('from_thinker_candidate_id', '?')} -> "
        f"{item.get('fields', {}).get('to_thinker_candidate_id', '?')} "
        f"({item.get('fields', {}).get('connection_type', 'influenced')})"
        for item in connections[:5]
    )

    warning_count = len(graph.get("warnings", []) or [])

    lines: List[str] = [
        f"### Source\n{source_name}",
        "",
        "### Candidate Overview",
        f"- Thinkers: {counts.get('thinkers', 0)}",
        f"- Events: {counts.get('events', 0)}",
        f"- Connections: {counts.get('connections', 0)}",
        f"- Publications: {counts.get('publications', 0)}",
        f"- Quotes: {counts.get('quotes', 0)}",
    ]
    if top_thinkers:
        lines.extend(["", "### Notable Thinkers", f"- {top_thinkers}"])
    if top_events:
        lines.extend(["", "### Key Events", f"- {top_events}"])
    if top_connections:
        lines.extend(["", "### Key Connections", f"- {top_connections}"])
    if warning_count:
        lines.extend(["", "### Extraction Warnings", f"- {warning_count} warnings were generated. Review before commit."])

    return "\n".join(lines).strip()


def build_preview_summary(graph: Dict[str, Any], source_name: str) -> str:
    if TEST_ENV or not is_ai_enabled():
        return _fallback_summary(graph, source_name)

    counts = graph.get("summary", {}).get("candidate_counts", {})
    thinker_names = [item.get("fields", {}).get("name") for item in graph.get("thinkers", [])[:10]]
    thinker_names = [name for name in thinker_names if isinstance(name, str) and name.strip()]
    event_samples = [
        f"{item.get('fields', {}).get('name', 'Untitled event')} ({item.get('fields', {}).get('year', 'n.d.')})"
        for item in graph.get("events", [])[:8]
    ]
    relation_samples = [
        f"{item.get('fields', {}).get('from_thinker_candidate_id', '?')} -> "
        f"{item.get('fields', {}).get('to_thinker_candidate_id', '?')} "
        f"[{item.get('fields', {}).get('connection_type', 'influenced')}]"
        for item in graph.get("connections", [])[:8]
    ]
    warnings = graph.get("warnings", []) or []

    messages = [
        {
            "role": "system",
            "content": (
                "You write concise scholarly markdown summaries for timeline extraction previews. "
                "Do not invent data."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Source name: {source_name}\n"
                f"Counts: thinkers={counts.get('thinkers', 0)}, events={counts.get('events', 0)}, "
                f"connections={counts.get('connections', 0)}, publications={counts.get('publications', 0)}, "
                f"quotes={counts.get('quotes', 0)}\n"
                f"Top thinkers: {', '.join(thinker_names) if thinker_names else 'none'}\n"
                f"Event samples: {', '.join(event_samples) if event_samples else 'none'}\n"
                f"Connection samples: {', '.join(relation_samples) if relation_samples else 'none'}\n"
                f"Warnings count: {len(warnings)}\n\n"
                "Return markdown with sections: Corpus Synopsis, Key Actors, Relationship Signal, Uncertainty Notes."
            ),
        },
    ]

    try:
        asyncio.get_running_loop()
        return _fallback_summary(graph, source_name)
    except RuntimeError:
        pass

    try:
        response = asyncio.run(_call_deepseek_api(messages=messages, temperature=0.2, max_tokens=700))
    except AIServiceError:
        return _fallback_summary(graph, source_name)
    except Exception:
        return _fallback_summary(graph, source_name)

    if not response:
        return _fallback_summary(graph, source_name)

    return response.strip()
