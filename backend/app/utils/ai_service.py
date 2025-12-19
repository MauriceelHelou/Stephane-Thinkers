"""
AI Service for Intellectual Genealogy Mapper

This module provides AI-powered features using:
- DeepSeek API for text generation (LLM)
- OpenAI API for embeddings

Configure DEEPSEEK_API_KEY and OPENAI_API_KEY environment variables to enable AI features.
"""

import os
import json
import httpx
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

# DeepSeek Configuration (for LLM/text generation)
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

# OpenAI Configuration (for embeddings)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")


@dataclass
class ConnectionSuggestion:
    """Suggested connection between two thinkers."""
    from_thinker_id: str
    from_thinker_name: str
    to_thinker_id: str
    to_thinker_name: str
    connection_type: str
    confidence: float  # 0.0 to 1.0
    reasoning: str


@dataclass
class ThinkerInsight:
    """AI-generated insight about a thinker."""
    summary: str
    key_contributions: List[str]
    intellectual_context: str
    related_concepts: List[str]


@dataclass
class ResearchSuggestion:
    """Suggested research direction or question."""
    question: str
    category: str
    rationale: str
    related_thinkers: List[str]


@dataclass
class ChatResponse:
    """AI chat response with citations."""
    answer: str
    citations: List[Dict[str, Any]]  # List of {type, id, name, relevance}
    follow_up_questions: List[str]


@dataclass
class SummaryResponse:
    """Generated summary with metadata."""
    summary: str
    key_points: List[str]
    key_figures: List[str]
    themes: List[str]
    length: str  # short, medium, detailed


@dataclass
class ParsedEntry:
    """Parsed natural language entry."""
    entity_type: str  # thinker, connection, publication, quote
    data: Dict[str, Any]
    confidence: float
    needs_clarification: List[str]


def is_ai_enabled() -> bool:
    """Check if AI features are enabled (requires DeepSeek API key for LLM)."""
    return bool(DEEPSEEK_API_KEY)


async def _call_deepseek_api(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 1000,
) -> Optional[str]:
    """Call the DeepSeek API for text generation."""
    if not is_ai_enabled():
        return None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"DeepSeek API error: {e}")
        return None


async def suggest_connections(
    thinkers: List[Dict[str, Any]],
    existing_connections: List[Dict[str, Any]],
    limit: int = 5,
) -> List[ConnectionSuggestion]:
    """
    Use AI to suggest potential intellectual connections between thinkers.

    Args:
        thinkers: List of thinker dictionaries with id, name, field, biography_notes
        existing_connections: List of existing connection dictionaries
        limit: Maximum number of suggestions to return

    Returns:
        List of ConnectionSuggestion objects
    """
    if not is_ai_enabled() or not thinkers:
        return []

    # Build context about thinkers
    thinker_info = []
    for t in thinkers[:50]:  # Limit to 50 thinkers for context
        info = f"- {t['name']}"
        if t.get('birth_year') or t.get('death_year'):
            years = f" ({t.get('birth_year', '?')}-{t.get('death_year', '?')})"
            info += years
        if t.get('field'):
            info += f", field: {t['field']}"
        if t.get('biography_notes'):
            info += f". {t['biography_notes'][:200]}"
        thinker_info.append(info)

    # Build list of existing connections to avoid duplicates
    existing_pairs = set()
    for c in existing_connections:
        existing_pairs.add((c['from_thinker_id'], c['to_thinker_id']))
        if c.get('bidirectional'):
            existing_pairs.add((c['to_thinker_id'], c['from_thinker_id']))

    prompt = f"""You are an expert in intellectual history. Analyze the following thinkers and suggest potential intellectual connections between them that may not be obvious.

Thinkers in the database:
{chr(10).join(thinker_info)}

Suggest {limit} potential connections between these thinkers. Consider:
1. Temporal overlap (could they have influenced each other?)
2. Shared fields or topics
3. Known historical connections
4. Conceptual similarities

For each suggestion, provide:
- From thinker (name)
- To thinker (name)
- Connection type: one of "influenced", "critiqued", "built_upon", "synthesized"
- Confidence (0.0-1.0)
- Brief reasoning (1-2 sentences)

Respond in JSON format:
{{
  "suggestions": [
    {{
      "from": "Name A",
      "to": "Name B",
      "type": "influenced",
      "confidence": 0.8,
      "reasoning": "Your reasoning here"
    }}
  ]
}}"""

    response = await _call_deepseek_api([
        {"role": "system", "content": "You are an expert intellectual historian. Respond only in valid JSON."},
        {"role": "user", "content": prompt}
    ])

    if not response:
        return []

    try:
        # Parse JSON response
        data = json.loads(response)
        suggestions = []

        # Create name to ID mapping
        name_to_id = {t['name'].lower(): t['id'] for t in thinkers}
        name_to_name = {t['name'].lower(): t['name'] for t in thinkers}

        for s in data.get('suggestions', [])[:limit]:
            from_name = s.get('from', '').lower()
            to_name = s.get('to', '').lower()

            from_id = name_to_id.get(from_name)
            to_id = name_to_id.get(to_name)

            if from_id and to_id and (from_id, to_id) not in existing_pairs:
                suggestions.append(ConnectionSuggestion(
                    from_thinker_id=from_id,
                    from_thinker_name=name_to_name.get(from_name, s.get('from', '')),
                    to_thinker_id=to_id,
                    to_thinker_name=name_to_name.get(to_name, s.get('to', '')),
                    connection_type=s.get('type', 'influenced'),
                    confidence=float(s.get('confidence', 0.5)),
                    reasoning=s.get('reasoning', ''),
                ))

        return suggestions
    except json.JSONDecodeError:
        return []


async def generate_thinker_summary(
    thinker: Dict[str, Any],
    publications: List[Dict[str, Any]],
    quotes: List[Dict[str, Any]],
) -> Optional[ThinkerInsight]:
    """
    Generate an AI summary and insights about a thinker.

    Args:
        thinker: Thinker dictionary
        publications: List of thinker's publications
        quotes: List of thinker's quotes

    Returns:
        ThinkerInsight object or None
    """
    if not is_ai_enabled():
        return None

    # Build context
    pub_titles = [p['title'] for p in publications[:10]]
    quote_texts = [q['text'][:200] for q in quotes[:5]]

    prompt = f"""Generate a scholarly summary for this intellectual figure:

Name: {thinker['name']}
Years: {thinker.get('birth_year', '?')} - {thinker.get('death_year', '?')}
Field: {thinker.get('field', 'Unknown')}
Biography: {thinker.get('biography_notes', 'No biography available')[:500]}

Publications: {', '.join(pub_titles) if pub_titles else 'None listed'}
Notable quotes: {'; '.join(quote_texts) if quote_texts else 'None listed'}

Provide:
1. A concise summary (2-3 sentences)
2. 3-5 key contributions
3. Intellectual context (movements, schools, contemporary debates)
4. Related concepts/terms

Respond in JSON format:
{{
  "summary": "...",
  "key_contributions": ["...", "..."],
  "intellectual_context": "...",
  "related_concepts": ["...", "..."]
}}"""

    response = await _call_deepseek_api([
        {"role": "system", "content": "You are a scholarly assistant specializing in intellectual history. Respond only in valid JSON."},
        {"role": "user", "content": prompt}
    ])

    if not response:
        return None

    try:
        data = json.loads(response)
        return ThinkerInsight(
            summary=data.get('summary', ''),
            key_contributions=data.get('key_contributions', []),
            intellectual_context=data.get('intellectual_context', ''),
            related_concepts=data.get('related_concepts', []),
        )
    except json.JSONDecodeError:
        return None


async def suggest_research_questions(
    thinkers: List[Dict[str, Any]],
    existing_questions: List[Dict[str, Any]],
    focus_thinker_id: Optional[str] = None,
    limit: int = 3,
) -> List[ResearchSuggestion]:
    """
    Suggest research questions based on the thinkers in the database.

    Args:
        thinkers: List of thinker dictionaries
        existing_questions: List of existing research questions
        focus_thinker_id: Optional ID to focus suggestions on a specific thinker
        limit: Maximum number of suggestions

    Returns:
        List of ResearchSuggestion objects
    """
    if not is_ai_enabled() or not thinkers:
        return []

    # Build context
    thinker_names = [t['name'] for t in thinkers[:30]]
    existing_titles = [q['title'] for q in existing_questions[:10]]

    focus_thinker = None
    if focus_thinker_id:
        focus_thinker = next((t for t in thinkers if t['id'] == focus_thinker_id), None)

    prompt = f"""You are a research advisor for intellectual history.

Thinkers in the database: {', '.join(thinker_names)}
{'Focusing on: ' + focus_thinker['name'] if focus_thinker else ''}
Existing research questions: {', '.join(existing_titles) if existing_titles else 'None yet'}

Suggest {limit} original research questions that could be explored. Each should:
1. Be answerable through historical research
2. Connect multiple thinkers when possible
3. Be novel (not duplicate existing questions)

Categories: influence, periodization, methodology, biography, other

Respond in JSON format:
{{
  "questions": [
    {{
      "question": "...",
      "category": "influence",
      "rationale": "...",
      "related_thinkers": ["Name1", "Name2"]
    }}
  ]
}}"""

    response = await _call_deepseek_api([
        {"role": "system", "content": "You are a research advisor. Respond only in valid JSON."},
        {"role": "user", "content": prompt}
    ])

    if not response:
        return []

    try:
        data = json.loads(response)
        return [
            ResearchSuggestion(
                question=q.get('question', ''),
                category=q.get('category', 'other'),
                rationale=q.get('rationale', ''),
                related_thinkers=q.get('related_thinkers', []),
            )
            for q in data.get('questions', [])[:limit]
        ]
    except json.JSONDecodeError:
        return []


async def validate_connection(
    from_thinker: Dict[str, Any],
    to_thinker: Dict[str, Any],
    connection_type: str,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validate a proposed connection using AI.

    Returns a dict with:
    - is_plausible: bool
    - confidence: float (0-1)
    - feedback: str
    - suggested_type: Optional alternative connection type
    """
    if not is_ai_enabled():
        return {
            "is_plausible": True,
            "confidence": 0.5,
            "feedback": "AI validation not available",
            "suggested_type": None,
        }

    prompt = f"""Evaluate this proposed intellectual connection:

From: {from_thinker['name']} ({from_thinker.get('birth_year', '?')}-{from_thinker.get('death_year', '?')})
  Field: {from_thinker.get('field', 'Unknown')}

To: {to_thinker['name']} ({to_thinker.get('birth_year', '?')}-{to_thinker.get('death_year', '?')})
  Field: {to_thinker.get('field', 'Unknown')}

Proposed connection type: {connection_type}
User notes: {notes or 'None provided'}

Evaluate:
1. Is this connection historically plausible?
2. Is the connection type accurate?
3. Are there any issues (timeline, geography, field mismatch)?

Respond in JSON:
{{
  "is_plausible": true/false,
  "confidence": 0.0-1.0,
  "feedback": "Your analysis...",
  "suggested_type": null or "alternative_type"
}}"""

    response = await _call_deepseek_api([
        {"role": "system", "content": "You are a historical accuracy validator. Respond only in valid JSON."},
        {"role": "user", "content": prompt}
    ])

    if not response:
        return {
            "is_plausible": True,
            "confidence": 0.5,
            "feedback": "Could not validate",
            "suggested_type": None,
        }

    try:
        return json.loads(response)
    except json.JSONDecodeError:
        return {
            "is_plausible": True,
            "confidence": 0.5,
            "feedback": "Could not parse validation",
            "suggested_type": None,
        }


async def chat_with_context(
    question: str,
    thinkers: List[Dict[str, Any]],
    connections: List[Dict[str, Any]],
    publications: List[Dict[str, Any]],
    quotes: List[Dict[str, Any]],
    conversation_history: List[Dict[str, str]] = None,
) -> Optional[ChatResponse]:
    """
    Answer questions about the research database using RAG.

    Args:
        question: User's question
        thinkers: All thinkers in database
        connections: All connections
        publications: All publications
        quotes: All quotes
        conversation_history: Previous messages in conversation

    Returns:
        ChatResponse with answer, citations, and follow-up questions
    """
    if not is_ai_enabled():
        return None

    # Build context from database
    thinker_context = []
    for t in thinkers[:100]:
        info = f"- {t['name']}"
        if t.get('birth_year') or t.get('death_year'):
            info += f" ({t.get('birth_year', '?')}-{t.get('death_year', '?')})"
        if t.get('field'):
            info += f", {t['field']}"
        if t.get('biography_notes'):
            info += f": {t['biography_notes'][:300]}"
        thinker_context.append(info)

    # Build connection context
    thinker_map = {t['id']: t['name'] for t in thinkers}
    connection_context = []
    for c in connections[:100]:
        from_name = thinker_map.get(c['from_thinker_id'], 'Unknown')
        to_name = thinker_map.get(c['to_thinker_id'], 'Unknown')
        conn_type = c.get('connection_type', 'connected to')
        connection_context.append(f"- {from_name} {conn_type} {to_name}")
        if c.get('notes'):
            connection_context[-1] += f": {c['notes'][:100]}"

    # Build publication context
    pub_context = []
    for p in publications[:50]:
        thinker_name = thinker_map.get(p.get('thinker_id'), 'Unknown')
        pub_context.append(f"- \"{p['title']}\" by {thinker_name} ({p.get('year', 'n.d.')})")

    # Build quote context
    quote_context = []
    for q in quotes[:30]:
        thinker_name = thinker_map.get(q.get('thinker_id'), 'Unknown')
        quote_context.append(f"- \"{q['text'][:150]}...\" - {thinker_name}")

    context = f"""DATABASE CONTEXT:

THINKERS ({len(thinkers)} total):
{chr(10).join(thinker_context[:50])}

INTELLECTUAL CONNECTIONS ({len(connections)} total):
{chr(10).join(connection_context[:30])}

PUBLICATIONS ({len(publications)} total):
{chr(10).join(pub_context[:20])}

QUOTES ({len(quotes)} total):
{chr(10).join(quote_context[:15])}"""

    # Build conversation history
    messages = [
        {"role": "system", "content": f"""You are a research assistant for an intellectual history database.
Answer questions using ONLY the provided database context. Be scholarly and precise.
When citing information, mention the thinker's name.
If you cannot answer from the context, say so.

{context}"""}
    ]

    if conversation_history:
        for msg in conversation_history[-10:]:  # Last 10 messages
            messages.append(msg)

    messages.append({"role": "user", "content": f"""{question}

After your answer, provide:
1. A list of thinkers/sources you cited (JSON array of names)
2. 2-3 follow-up questions the user might ask

Format your response as:
[Your detailed answer here]

CITATIONS: ["Name1", "Name2", ...]
FOLLOW_UP: ["Question 1?", "Question 2?", "Question 3?"]"""})

    response = await _call_deepseek_api(messages, temperature=0.5, max_tokens=1500)

    if not response:
        return None

    # Parse response
    answer = response
    citations = []
    follow_ups = []

    # Extract citations
    if "CITATIONS:" in response:
        parts = response.split("CITATIONS:")
        answer = parts[0].strip()
        try:
            citation_part = parts[1].split("FOLLOW_UP:")[0].strip()
            cited_names = json.loads(citation_part)
            for name in cited_names:
                thinker = next((t for t in thinkers if t['name'].lower() == name.lower()), None)
                if thinker:
                    citations.append({
                        "type": "thinker",
                        "id": thinker['id'],
                        "name": thinker['name'],
                    })
        except:
            pass

    # Extract follow-up questions
    if "FOLLOW_UP:" in response:
        try:
            follow_part = response.split("FOLLOW_UP:")[1].strip()
            follow_ups = json.loads(follow_part)
        except:
            pass

    return ChatResponse(
        answer=answer,
        citations=citations,
        follow_up_questions=follow_ups[:3],
    )


async def generate_summary(
    summary_type: str,  # "timeline", "thinker", "field", "period"
    target_id: Optional[str],
    target_name: Optional[str],
    thinkers: List[Dict[str, Any]],
    connections: List[Dict[str, Any]],
    publications: List[Dict[str, Any]],
    length: str = "medium",  # short, medium, detailed
) -> Optional[SummaryResponse]:
    """
    Generate summaries of various aspects of the database.
    """
    if not is_ai_enabled():
        return None

    # Filter relevant data based on summary type
    if summary_type == "thinker" and target_id:
        relevant_thinkers = [t for t in thinkers if t['id'] == target_id]
        thinker_map = {t['id']: t['name'] for t in thinkers}
        relevant_connections = [c for c in connections
                                if c['from_thinker_id'] == target_id or c['to_thinker_id'] == target_id]
        relevant_pubs = [p for p in publications if p.get('thinker_id') == target_id]
        context_desc = f"the contributions of {target_name}"
    elif summary_type == "field" and target_name:
        relevant_thinkers = [t for t in thinkers if t.get('field', '').lower() == target_name.lower()]
        thinker_ids = {t['id'] for t in relevant_thinkers}
        thinker_map = {t['id']: t['name'] for t in thinkers}
        relevant_connections = [c for c in connections
                                if c['from_thinker_id'] in thinker_ids or c['to_thinker_id'] in thinker_ids]
        relevant_pubs = [p for p in publications if p.get('thinker_id') in thinker_ids]
        context_desc = f"the field of {target_name}"
    elif summary_type == "period" and target_name:
        # Parse period like "1700-1800" or "20th century"
        relevant_thinkers = thinkers  # Filter by year range if needed
        thinker_map = {t['id']: t['name'] for t in thinkers}
        relevant_connections = connections
        relevant_pubs = publications
        context_desc = f"the period {target_name}"
    else:
        relevant_thinkers = thinkers[:50]
        thinker_map = {t['id']: t['name'] for t in thinkers}
        relevant_connections = connections[:50]
        relevant_pubs = publications[:30]
        context_desc = "this intellectual history database"

    length_instructions = {
        "short": "2-3 sentences",
        "medium": "1-2 paragraphs",
        "detailed": "3-4 paragraphs with specific examples",
    }

    # Build context
    thinker_info = [f"- {t['name']} ({t.get('birth_year', '?')}-{t.get('death_year', '?')}): {t.get('field', 'Unknown')}"
                    for t in relevant_thinkers[:30]]
    conn_info = [f"- {thinker_map.get(c['from_thinker_id'], '?')} {c.get('connection_type', '->')} {thinker_map.get(c['to_thinker_id'], '?')}"
                 for c in relevant_connections[:20]]

    prompt = f"""Generate a scholarly summary of {context_desc}.

DATA:
Thinkers:
{chr(10).join(thinker_info)}

Connections:
{chr(10).join(conn_info)}

Generate a {length_instructions.get(length, 'medium')} summary.

Respond in JSON:
{{
  "summary": "Your summary text...",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "key_figures": ["Name1", "Name2"],
  "themes": ["Theme1", "Theme2"]
}}"""

    response = await _call_deepseek_api([
        {"role": "system", "content": "You are a scholarly assistant. Respond only in valid JSON."},
        {"role": "user", "content": prompt}
    ], max_tokens=1500)

    if not response:
        return None

    try:
        data = json.loads(response)
        return SummaryResponse(
            summary=data.get('summary', ''),
            key_points=data.get('key_points', []),
            key_figures=data.get('key_figures', []),
            themes=data.get('themes', []),
            length=length,
        )
    except json.JSONDecodeError:
        return None


async def parse_natural_language_entry(
    text: str,
    existing_thinkers: List[Dict[str, Any]],
) -> Optional[ParsedEntry]:
    """
    Parse natural language input to create structured database entries.

    Examples:
    - "Add Immanuel Kant, born 1724, wrote Critique of Pure Reason in 1781"
    - "Kant influenced Hegel's dialectical method"
    - "Quote from Spinoza: 'All things excellent are as difficult as they are rare'"
    """
    if not is_ai_enabled():
        return None

    # Build context of existing thinkers for name matching
    thinker_names = [t['name'] for t in existing_thinkers]

    prompt = f"""Parse this natural language input into a structured database entry:

"{text}"

Existing thinkers in database: {', '.join(thinker_names[:50])}

Determine what type of entry this is and extract the relevant data.

Entity types:
- thinker: A new intellectual figure
- connection: A relationship between thinkers
- publication: A work/book by a thinker
- quote: A quotation from a thinker

Respond in JSON:
{{
  "entity_type": "thinker|connection|publication|quote",
  "confidence": 0.0-1.0,
  "data": {{
    // For thinker:
    "name": "...",
    "birth_year": null or number,
    "death_year": null or number,
    "field": "...",
    "biography_notes": "..."

    // For connection:
    "from_thinker": "name",
    "to_thinker": "name",
    "connection_type": "influenced|critiqued|built_upon|synthesized",
    "notes": "..."

    // For publication:
    "thinker": "name",
    "title": "...",
    "year": number,
    "publication_type": "book|article|essay|other"

    // For quote:
    "thinker": "name",
    "text": "...",
    "source": "..."
  }},
  "needs_clarification": ["What needs to be clarified?"]
}}"""

    response = await _call_deepseek_api([
        {"role": "system", "content": "You are a data entry assistant. Parse natural language into structured data. Respond only in valid JSON."},
        {"role": "user", "content": prompt}
    ], temperature=0.3)

    if not response:
        return None

    try:
        data = json.loads(response)

        # Match thinker names to IDs
        parsed_data = data.get('data', {})
        for key in ['thinker', 'from_thinker', 'to_thinker']:
            if key in parsed_data:
                name = parsed_data[key]
                match = next((t for t in existing_thinkers
                             if t['name'].lower() == name.lower()), None)
                if match:
                    parsed_data[f'{key}_id'] = match['id']
                    parsed_data[f'{key}_name'] = match['name']

        return ParsedEntry(
            entity_type=data.get('entity_type', 'unknown'),
            data=parsed_data,
            confidence=float(data.get('confidence', 0.5)),
            needs_clarification=data.get('needs_clarification', []),
        )
    except json.JSONDecodeError:
        return None
