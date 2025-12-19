"""
Quiz Service for Intellectual Genealogy Mapper

Handles quiz question generation, answer validation, and SM-2 spaced repetition algorithm.
Integrates with DeepSeek AI for intelligent question generation.
"""

import os
import json
import random
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field

from app.utils.ai_service import is_ai_enabled, _call_deepseek_api


# ============ Data Classes ============

@dataclass
class GeneratedQuestion:
    """A generated quiz question."""
    question_text: str
    question_type: str  # multiple_choice, short_answer
    category: str
    correct_answer: str
    options: Optional[List[str]] = None
    difficulty: str = "medium"
    explanation: str = ""
    related_thinker_ids: List[str] = field(default_factory=list)


@dataclass
class AnswerResult:
    """Result of validating an answer."""
    is_correct: bool
    correct_answer: str
    explanation: str
    additional_context: Optional[str] = None


@dataclass
class SpacedRepetitionUpdate:
    """Update to spaced repetition parameters."""
    ease_factor: float
    interval_days: int
    repetitions: int
    next_review_at: datetime


# ============ SM-2 Spaced Repetition Algorithm ============

def calculate_quality_score(is_correct: bool, time_taken_seconds: Optional[int]) -> int:
    """
    Calculate SM-2 quality score (0-5) based on answer correctness and response time.

    5 = perfect response
    4 = correct after hesitation
    3 = correct with difficulty
    2 = incorrect, but remembered
    1 = incorrect, familiar
    0 = complete blackout
    """
    if not is_correct:
        return 2 if time_taken_seconds and time_taken_seconds < 30 else 0

    # Correct answer - score based on speed
    if time_taken_seconds is None:
        return 4
    elif time_taken_seconds < 10:
        return 5  # Fast - perfect
    elif time_taken_seconds < 20:
        return 4  # Normal
    else:
        return 3  # Slow - correct with difficulty


def calculate_next_review(
    ease_factor: float,
    interval_days: int,
    repetitions: int,
    quality: int,
) -> SpacedRepetitionUpdate:
    """
    SM-2 spaced repetition algorithm implementation.

    Args:
        ease_factor: Current ease factor (starts at 2.5)
        interval_days: Current interval in days
        repetitions: Number of successful reviews
        quality: Quality of response (0-5)

    Returns:
        SpacedRepetitionUpdate with new parameters
    """
    if quality < 3:
        # Failed - reset repetitions and interval
        new_repetitions = 0
        new_interval = 1
    else:
        # Passed - increase interval
        new_repetitions = repetitions + 1

        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval_days * ease_factor)

    # Update ease factor
    # EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    new_ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ease_factor = max(1.3, new_ease_factor)  # Minimum ease factor

    # Calculate next review date
    next_review_at = datetime.now() + timedelta(days=new_interval)

    return SpacedRepetitionUpdate(
        ease_factor=new_ease_factor,
        interval_days=new_interval,
        repetitions=new_repetitions,
        next_review_at=next_review_at,
    )


# ============ Difficulty Adaptation ============

def get_next_difficulty(
    recent_answers: List[bool],
    current_difficulty: str,
) -> str:
    """
    Determine next question difficulty based on recent performance.

    Rules:
    - 3+ correct in a row → increase difficulty
    - 2+ incorrect in a row → decrease difficulty
    """
    difficulties = ["easy", "medium", "hard"]
    current_idx = difficulties.index(current_difficulty) if current_difficulty in difficulties else 1

    if len(recent_answers) >= 3:
        last_three = recent_answers[-3:]
        if all(last_three):  # 3 correct in a row
            return difficulties[min(current_idx + 1, 2)]

    if len(recent_answers) >= 2:
        last_two = recent_answers[-2:]
        if not any(last_two):  # 2 incorrect in a row
            return difficulties[max(current_idx - 1, 0)]

    return current_difficulty


# ============ Question Generation ============

def select_random_category(allowed_categories: List[str]) -> str:
    """Select a random category from allowed categories."""
    return random.choice(allowed_categories) if allowed_categories else "birth_year"


def generate_birth_year_question(
    thinker: Dict[str, Any],
    all_thinkers: List[Dict[str, Any]],
    difficulty: str,
    question_type: str = "multiple_choice",
) -> Optional[GeneratedQuestion]:
    """Generate a birth year question."""
    if not thinker.get('birth_year'):
        return None

    correct_answer = str(thinker['birth_year'])

    if question_type == "multiple_choice":
        # Generate plausible distractors
        distractors = generate_year_distractors(
            correct_year=thinker['birth_year'],
            all_thinkers=all_thinkers,
            difficulty=difficulty,
            thinker_field=thinker.get('field'),
        )
        options = [correct_answer] + distractors[:3]
        random.shuffle(options)
    else:
        options = None

    return GeneratedQuestion(
        question_text=f"When was {thinker['name']} born?",
        question_type=question_type,
        category="birth_year",
        correct_answer=correct_answer,
        options=options,
        difficulty=difficulty,
        explanation=f"{thinker['name']} was born in {thinker['birth_year']}" +
                    (f" and died in {thinker['death_year']}" if thinker.get('death_year') else "") + ".",
        related_thinker_ids=[thinker['id']],
    )


def generate_death_year_question(
    thinker: Dict[str, Any],
    all_thinkers: List[Dict[str, Any]],
    difficulty: str,
    question_type: str = "multiple_choice",
) -> Optional[GeneratedQuestion]:
    """Generate a death year question."""
    if not thinker.get('death_year'):
        return None

    correct_answer = str(thinker['death_year'])

    if question_type == "multiple_choice":
        distractors = generate_year_distractors(
            correct_year=thinker['death_year'],
            all_thinkers=all_thinkers,
            difficulty=difficulty,
            thinker_field=thinker.get('field'),
        )
        options = [correct_answer] + distractors[:3]
        random.shuffle(options)
    else:
        options = None

    return GeneratedQuestion(
        question_text=f"When did {thinker['name']} die?",
        question_type=question_type,
        category="death_year",
        correct_answer=correct_answer,
        options=options,
        difficulty=difficulty,
        explanation=f"{thinker['name']} died in {thinker['death_year']}" +
                    (f" (born {thinker['birth_year']})" if thinker.get('birth_year') else "") + ".",
        related_thinker_ids=[thinker['id']],
    )


def generate_year_distractors(
    correct_year: int,
    all_thinkers: List[Dict[str, Any]],
    difficulty: str,
    thinker_field: Optional[str] = None,
) -> List[str]:
    """Generate plausible year distractors based on difficulty."""
    distractors = set()

    # Get years from thinkers in similar field
    similar_years = []
    for t in all_thinkers:
        if t.get('birth_year') and t['birth_year'] != correct_year:
            # Prefer thinkers in same field for harder difficulty
            if difficulty == "hard" and thinker_field and t.get('field') == thinker_field:
                similar_years.append(t['birth_year'])
            elif t.get('death_year') and t['death_year'] != correct_year:
                similar_years.append(t['death_year'])

    # Add years from similar era
    for y in similar_years[:10]:
        if abs(y - correct_year) < 100:  # Within a century
            distractors.add(str(y))

    # Generate nearby years based on difficulty
    if difficulty == "easy":
        # Large spread, obviously wrong
        offsets = [50, -50, 100, -100, 75, -75]
    elif difficulty == "medium":
        # Moderate spread
        offsets = [20, -20, 30, -30, 15, -15]
    else:
        # Hard - very close years
        offsets = [5, -5, 10, -10, 3, -3]

    for offset in offsets:
        year = correct_year + offset
        if year > 0:  # Valid year
            distractors.add(str(year))

    distractors.discard(str(correct_year))
    return list(distractors)[:3]


def generate_quote_question(
    quote: Dict[str, Any],
    thinker: Dict[str, Any],
    all_thinkers: List[Dict[str, Any]],
    difficulty: str,
) -> Optional[GeneratedQuestion]:
    """Generate a 'Who said this?' question."""
    if not quote.get('text') or len(quote['text']) < 20:
        return None

    correct_answer = thinker['name']

    # Get plausible alternative thinkers
    distractors = []
    for t in all_thinkers:
        if t['id'] != thinker['id'] and t['name'] != thinker['name']:
            # Prefer thinkers from same field/era for harder difficulty
            if difficulty == "hard":
                if t.get('field') == thinker.get('field'):
                    distractors.append(t['name'])
            else:
                distractors.append(t['name'])

    random.shuffle(distractors)
    options = [correct_answer] + distractors[:3]
    random.shuffle(options)

    # Truncate quote if too long
    quote_text = quote['text'][:200] + "..." if len(quote['text']) > 200 else quote['text']

    return GeneratedQuestion(
        question_text=f'Who said: "{quote_text}"?',
        question_type="multiple_choice",
        category="quote",
        correct_answer=correct_answer,
        options=options,
        difficulty=difficulty,
        explanation=f'This quote is attributed to {thinker["name"]}' +
                    (f' from "{quote.get("source")}"' if quote.get('source') else '') + '.',
        related_thinker_ids=[thinker['id']],
    )


def generate_publication_question(
    publication: Dict[str, Any],
    thinker: Dict[str, Any],
    all_thinkers: List[Dict[str, Any]],
    difficulty: str,
    question_variant: str = "author",  # "author" or "year"
) -> Optional[GeneratedQuestion]:
    """Generate a publication question."""
    if not publication.get('title'):
        return None

    if question_variant == "author":
        correct_answer = thinker['name']
        question_text = f'Who wrote "{publication["title"]}"?'

        distractors = []
        for t in all_thinkers:
            if t['id'] != thinker['id']:
                if difficulty == "hard" and t.get('field') == thinker.get('field'):
                    distractors.append(t['name'])
                elif difficulty != "hard":
                    distractors.append(t['name'])

        random.shuffle(distractors)
        options = [correct_answer] + distractors[:3]
        random.shuffle(options)

        explanation = f'"{publication["title"]}" was written by {thinker["name"]}'
        if publication.get('year'):
            explanation += f' in {publication["year"]}'
        explanation += '.'

    else:  # year
        if not publication.get('year'):
            return None

        correct_answer = str(publication['year'])
        question_text = f'When was "{publication["title"]}" by {thinker["name"]} published?'

        distractors = generate_year_distractors(
            correct_year=publication['year'],
            all_thinkers=all_thinkers,
            difficulty=difficulty,
            thinker_field=thinker.get('field'),
        )
        options = [correct_answer] + distractors[:3]
        random.shuffle(options)

        explanation = f'"{publication["title"]}" was published in {publication["year"]}.'

    return GeneratedQuestion(
        question_text=question_text,
        question_type="multiple_choice",
        category="publication",
        correct_answer=correct_answer,
        options=options,
        difficulty=difficulty,
        explanation=explanation,
        related_thinker_ids=[thinker['id']],
    )


def generate_connection_question(
    connection: Dict[str, Any],
    from_thinker: Dict[str, Any],
    to_thinker: Dict[str, Any],
    all_thinkers: List[Dict[str, Any]],
    difficulty: str,
    question_variant: str = "influenced_by",  # "influenced_by" or "connection_type"
) -> Optional[GeneratedQuestion]:
    """Generate a connection question."""
    conn_type = connection.get('connection_type', 'influenced')

    if question_variant == "influenced_by":
        # "Who influenced X?"
        correct_answer = from_thinker['name']
        question_text = f'Who {conn_type} {to_thinker["name"]}?'

        distractors = []
        for t in all_thinkers:
            if t['id'] not in [from_thinker['id'], to_thinker['id']]:
                # For hard difficulty, avoid anachronisms
                if difficulty == "hard":
                    # Only include thinkers who could have influenced (born before)
                    if t.get('birth_year') and to_thinker.get('birth_year'):
                        if t['birth_year'] < to_thinker['birth_year'] + 20:
                            distractors.append(t['name'])
                else:
                    distractors.append(t['name'])

        random.shuffle(distractors)
        options = [correct_answer] + distractors[:3]
        random.shuffle(options)

        explanation = f'{from_thinker["name"]} {conn_type} {to_thinker["name"]}'
        if connection.get('notes'):
            explanation += f': {connection["notes"][:100]}'
        explanation += '.'

    else:  # connection_type
        correct_answer = conn_type
        question_text = f'What type of intellectual relationship did {from_thinker["name"]} have with {to_thinker["name"]}?'

        connection_types = ["influenced", "critiqued", "built_upon", "synthesized"]
        distractors = [ct for ct in connection_types if ct != conn_type]
        options = [correct_answer] + distractors[:3]
        random.shuffle(options)

        explanation = f'{from_thinker["name"]} {conn_type} {to_thinker["name"]}.'

    return GeneratedQuestion(
        question_text=question_text,
        question_type="multiple_choice",
        category="connection",
        correct_answer=correct_answer,
        options=options,
        difficulty=difficulty,
        explanation=explanation,
        related_thinker_ids=[from_thinker['id'], to_thinker['id']],
    )


def generate_field_question(
    thinker: Dict[str, Any],
    all_thinkers: List[Dict[str, Any]],
    difficulty: str,
) -> Optional[GeneratedQuestion]:
    """Generate a field question."""
    if not thinker.get('field'):
        return None

    correct_answer = thinker['field']

    # Get other fields as distractors
    all_fields = list(set(t.get('field', '') for t in all_thinkers if t.get('field')))
    distractors = [f for f in all_fields if f != correct_answer]

    # Add common philosophical/academic fields if needed
    common_fields = ["Philosophy", "Mathematics", "Physics", "Literature", "History",
                     "Theology", "Politics", "Economics", "Psychology", "Sociology"]
    for f in common_fields:
        if f not in distractors and f != correct_answer:
            distractors.append(f)

    random.shuffle(distractors)
    options = [correct_answer] + distractors[:3]
    random.shuffle(options)

    return GeneratedQuestion(
        question_text=f"What field did {thinker['name']} work in?",
        question_type="multiple_choice",
        category="field",
        correct_answer=correct_answer,
        options=options,
        difficulty=difficulty,
        explanation=f"{thinker['name']} worked primarily in the field of {thinker['field']}.",
        related_thinker_ids=[thinker['id']],
    )


# ============ Main Question Generation ============

async def generate_question(
    thinkers: List[Dict[str, Any]],
    quotes: List[Dict[str, Any]],
    publications: List[Dict[str, Any]],
    connections: List[Dict[str, Any]],
    allowed_categories: List[str],
    difficulty: str = "medium",
    question_type: str = "auto",  # "auto", "multiple_choice", "short_answer"
    timeline_id: Optional[str] = None,
) -> Optional[GeneratedQuestion]:
    """
    Generate a quiz question from the available data.

    Args:
        thinkers: List of thinker dictionaries
        quotes: List of quote dictionaries
        publications: List of publication dictionaries
        connections: List of connection dictionaries
        allowed_categories: Categories to choose from
        difficulty: Question difficulty (easy, medium, hard)
        question_type: Type of question (auto selects based on category)
        timeline_id: Optional timeline filter

    Returns:
        GeneratedQuestion or None if cannot generate
    """
    if not thinkers:
        return None

    # Filter by timeline if specified
    if timeline_id:
        thinkers = [t for t in thinkers if t.get('timeline_id') == timeline_id]
        if not thinkers:
            return None

    # Create thinker lookup
    thinker_map = {t['id']: t for t in thinkers}

    # Determine question type
    if question_type == "auto":
        # 70% multiple choice, 30% short answer
        question_type = "multiple_choice" if random.random() < 0.7 else "short_answer"

    # Select category
    category = select_random_category(allowed_categories)

    # Generate question based on category
    question = None
    max_attempts = 10

    for _ in range(max_attempts):
        if category == "birth_year":
            thinker = random.choice(thinkers)
            question = generate_birth_year_question(thinker, thinkers, difficulty, question_type)

        elif category == "death_year":
            thinker = random.choice(thinkers)
            question = generate_death_year_question(thinker, thinkers, difficulty, question_type)

        elif category == "quote":
            if quotes:
                quote = random.choice(quotes)
                thinker = thinker_map.get(quote.get('thinker_id'))
                if thinker:
                    question = generate_quote_question(quote, thinker, thinkers, difficulty)

        elif category == "publication":
            if publications:
                pub = random.choice(publications)
                thinker = thinker_map.get(pub.get('thinker_id'))
                if thinker:
                    variant = random.choice(["author", "year"])
                    question = generate_publication_question(pub, thinker, thinkers, difficulty, variant)

        elif category == "connection":
            if connections:
                conn = random.choice(connections)
                from_thinker = thinker_map.get(conn.get('from_thinker_id'))
                to_thinker = thinker_map.get(conn.get('to_thinker_id'))
                if from_thinker and to_thinker:
                    variant = random.choice(["influenced_by", "connection_type"])
                    question = generate_connection_question(
                        conn, from_thinker, to_thinker, thinkers, difficulty, variant
                    )

        elif category == "field":
            thinker = random.choice(thinkers)
            question = generate_field_question(thinker, thinkers, difficulty)

        if question:
            break

        # Try another category if this one failed
        category = select_random_category(allowed_categories)

    return question


async def generate_question_with_ai(
    thinkers: List[Dict[str, Any]],
    quotes: List[Dict[str, Any]],
    publications: List[Dict[str, Any]],
    connections: List[Dict[str, Any]],
    category: str,
    difficulty: str = "medium",
) -> Optional[GeneratedQuestion]:
    """
    Use AI to generate a more sophisticated question.

    This is a fallback for when simple generation doesn't produce good results,
    or for more complex question types like biography matching.
    """
    if not is_ai_enabled():
        return None

    # Build context
    thinker_info = []
    for t in thinkers[:30]:
        info = f"- {t['name']} ({t.get('birth_year', '?')}-{t.get('death_year', '?')})"
        if t.get('field'):
            info += f", {t['field']}"
        if t.get('biography_notes'):
            info += f": {t['biography_notes'][:200]}"
        thinker_info.append(info)

    difficulty_guidance = {
        "easy": "Create a straightforward question with obviously wrong distractors.",
        "medium": "Create a moderately challenging question with plausible distractors.",
        "hard": "Create a challenging question with very similar distractors that require specific knowledge.",
    }

    prompt = f"""Generate a {difficulty} quiz question about intellectual history.

Category: {category}

Available thinkers:
{chr(10).join(thinker_info)}

{difficulty_guidance.get(difficulty, '')}

Requirements:
- Question must be answerable from the provided data
- Provide exactly 4 options for multiple choice
- One correct answer, three plausible but incorrect options
- Include a brief explanation of the correct answer

Respond in JSON:
{{
  "question_text": "Your question here?",
  "question_type": "multiple_choice",
  "category": "{category}",
  "correct_answer": "The correct answer",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "explanation": "Brief explanation of why this is correct",
  "related_thinker_names": ["Name1", "Name2"]
}}"""

    response = await _call_deepseek_api([
        {"role": "system", "content": "You are a scholarly quiz generator. Create historically accurate questions. Respond only in valid JSON."},
        {"role": "user", "content": prompt}
    ], temperature=0.7)

    if not response:
        return None

    try:
        data = json.loads(response)

        # Map thinker names to IDs
        name_to_id = {t['name'].lower(): t['id'] for t in thinkers}
        related_ids = []
        for name in data.get('related_thinker_names', []):
            thinker_id = name_to_id.get(name.lower())
            if thinker_id:
                related_ids.append(thinker_id)

        return GeneratedQuestion(
            question_text=data.get('question_text', ''),
            question_type=data.get('question_type', 'multiple_choice'),
            category=data.get('category', category),
            correct_answer=data.get('correct_answer', ''),
            options=data.get('options'),
            difficulty=difficulty,
            explanation=data.get('explanation', ''),
            related_thinker_ids=related_ids,
        )
    except json.JSONDecodeError:
        return None


# ============ Answer Validation ============

def validate_answer(
    user_answer: str,
    correct_answer: str,
    question_type: str,
    tolerance: float = 0.8,
) -> bool:
    """
    Validate a user's answer against the correct answer.

    For multiple choice: exact match
    For short answer: fuzzy matching
    """
    if question_type == "multiple_choice":
        return user_answer.strip().lower() == correct_answer.strip().lower()

    # Short answer - more lenient matching
    user_clean = user_answer.strip().lower()
    correct_clean = correct_answer.strip().lower()

    # Exact match
    if user_clean == correct_clean:
        return True

    # Partial match (for names like "Kant" matching "Immanuel Kant")
    if correct_clean in user_clean or user_clean in correct_clean:
        return True

    # Number matching (for years)
    try:
        user_num = int(''.join(filter(str.isdigit, user_clean)))
        correct_num = int(''.join(filter(str.isdigit, correct_clean)))
        return user_num == correct_num
    except:
        pass

    return False


async def validate_answer_with_ai(
    user_answer: str,
    correct_answer: str,
    question_text: str,
) -> bool:
    """
    Use AI for fuzzy answer validation when simple matching fails.
    """
    if not is_ai_enabled():
        return False

    prompt = f"""Evaluate if this answer is correct:

Question: {question_text}
Expected answer: {correct_answer}
User's answer: {user_answer}

Is the user's answer essentially correct? Consider:
- Spelling variations
- Name variations (first name only, last name only, etc.)
- Reasonable approximations

Respond with only "true" or "false"."""

    response = await _call_deepseek_api([
        {"role": "system", "content": "You are an answer validator. Respond only with 'true' or 'false'."},
        {"role": "user", "content": prompt}
    ], temperature=0.0, max_tokens=10)

    return response and response.strip().lower() == "true"


def generate_explanation(
    question: Dict[str, Any],
    correct_answer: str,
    thinkers: List[Dict[str, Any]],
) -> str:
    """Generate an explanation for a question answer."""
    explanation = question.get('explanation', '')

    if not explanation:
        # Generate basic explanation
        category = question.get('category', '')
        related_ids = question.get('related_thinker_ids', [])

        related_thinkers = [t for t in thinkers if t['id'] in related_ids]
        if related_thinkers:
            thinker = related_thinkers[0]
            if category == "birth_year":
                explanation = f"{thinker['name']} was born in {correct_answer}."
            elif category == "death_year":
                explanation = f"{thinker['name']} died in {correct_answer}."
            elif category == "field":
                explanation = f"{thinker['name']} worked primarily in {correct_answer}."
            else:
                explanation = f"The correct answer is {correct_answer}."

    return explanation


# ============ Statistics Helpers ============

def calculate_session_statistics(
    answers: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Calculate comprehensive statistics for a quiz session.
    """
    total = len(answers)
    correct = sum(1 for a in answers if a.get('is_correct'))

    # Category breakdown
    category_stats = {}
    for a in answers:
        cat = a.get('category', 'unknown')
        if cat not in category_stats:
            category_stats[cat] = {'total': 0, 'correct': 0}
        category_stats[cat]['total'] += 1
        if a.get('is_correct'):
            category_stats[cat]['correct'] += 1

    category_breakdown = [
        {
            'category': cat,
            'total': stats['total'],
            'correct': stats['correct'],
            'accuracy': (stats['correct'] / stats['total'] * 100) if stats['total'] > 0 else 0,
        }
        for cat, stats in category_stats.items()
    ]

    # Time statistics
    times = [a.get('time_taken_seconds', 0) for a in answers if a.get('time_taken_seconds')]
    avg_time = sum(times) / len(times) if times else 0

    # Streak calculation
    current_streak = 0
    longest_streak = 0
    temp_streak = 0

    for a in answers:
        if a.get('is_correct'):
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
        else:
            temp_streak = 0

    # Check if last answers are correct for current streak
    for a in reversed(answers):
        if a.get('is_correct'):
            current_streak += 1
        else:
            break

    return {
        'total_questions': total,
        'correct_answers': correct,
        'accuracy_percentage': (correct / total * 100) if total > 0 else 0,
        'average_time_seconds': avg_time,
        'category_breakdown': category_breakdown,
        'streak_data': {
            'longest_streak': longest_streak,
            'current_streak': current_streak,
        },
    }
