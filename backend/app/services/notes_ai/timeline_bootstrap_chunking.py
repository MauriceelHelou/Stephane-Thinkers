import math
import os
import re
from dataclasses import dataclass
from typing import List, Tuple

from app.utils.ai_service import AI_MAX_PROMPT_TOKENS, estimate_token_count


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


TARGET_CHUNK_TOKENS = _env_int(
    "TIMELINE_BOOTSTRAP_TARGET_CHUNK_TOKENS",
    max(1400, min(5000, int(AI_MAX_PROMPT_TOKENS * 0.7))),
)
OVERLAP_RATIO = 0.12
MAX_CHUNKS = 120
FULL_CONTEXT_TOKEN_THRESHOLD = _env_int(
    "TIMELINE_BOOTSTRAP_FULL_CONTEXT_THRESHOLD_TOKENS",
    max(1200, min(18000, int(AI_MAX_PROMPT_TOKENS * 0.75))),
)


@dataclass
class ParagraphSlice:
    text: str
    char_start: int
    char_end: int
    token_estimate: int


@dataclass
class TextChunk:
    index: int
    text: str
    char_start: int
    char_end: int
    token_estimate: int
    paragraphs: List[ParagraphSlice]


@dataclass
class ChunkingResult:
    normalized_text: str
    chunks: List[TextChunk]
    truncated: bool
    total_token_estimate: int


def normalize_source_text(content: str) -> str:
    text = (content or "").replace("\r\n", "\n").replace("\r", "\n")
    # Keep paragraph structure while removing noisy trailing spaces.
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    # Compress excessive blank lines without changing paragraph boundaries.
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_paragraphs(normalized_text: str) -> List[ParagraphSlice]:
    paragraphs: List[ParagraphSlice] = []
    for match in re.finditer(r".+?(?:\n\n|$)", normalized_text, re.DOTALL):
        block = match.group(0)
        if not block.strip():
            continue
        left_trim = len(block) - len(block.lstrip())
        right_trim = len(block) - len(block.rstrip())
        start = match.start() + left_trim
        end = match.end() - right_trim
        paragraph_text = normalized_text[start:end]
        token_estimate = max(1, estimate_token_count(paragraph_text))
        paragraphs.append(
            ParagraphSlice(
                text=paragraph_text,
                char_start=start,
                char_end=end,
                token_estimate=token_estimate,
            )
        )

    return paragraphs


def _build_chunk(index: int, paragraphs: List[ParagraphSlice]) -> TextChunk:
    chunk_text = "\n\n".join(part.text for part in paragraphs)
    token_estimate = sum(part.token_estimate for part in paragraphs)
    return TextChunk(
        index=index,
        text=chunk_text,
        char_start=paragraphs[0].char_start,
        char_end=paragraphs[-1].char_end,
        token_estimate=token_estimate,
        paragraphs=list(paragraphs),
    )


def _overlap_start(paragraphs: List[ParagraphSlice], target_overlap_tokens: int) -> int:
    running = 0
    start_index = len(paragraphs) - 1
    for idx in range(len(paragraphs) - 1, -1, -1):
        running += paragraphs[idx].token_estimate
        start_index = idx
        if running >= target_overlap_tokens:
            break
    return max(0, start_index)


def chunk_text(
    content: str,
    *,
    target_chunk_tokens: int = TARGET_CHUNK_TOKENS,
    overlap_ratio: float = OVERLAP_RATIO,
    max_chunks: int = MAX_CHUNKS,
) -> ChunkingResult:
    normalized = normalize_source_text(content)
    paragraphs = split_paragraphs(normalized)
    if not paragraphs:
        return ChunkingResult(
            normalized_text=normalized,
            chunks=[],
            truncated=False,
            total_token_estimate=0,
        )

    total_token_estimate = sum(part.token_estimate for part in paragraphs)
    if total_token_estimate <= target_chunk_tokens:
        single_chunk = _build_chunk(0, paragraphs)
        return ChunkingResult(
            normalized_text=normalized,
            chunks=[single_chunk],
            truncated=False,
            total_token_estimate=single_chunk.token_estimate,
        )

    overlap_tokens = max(1, int(math.floor(target_chunk_tokens * overlap_ratio)))

    chunks: List[TextChunk] = []
    current: List[ParagraphSlice] = []
    current_tokens = 0
    cursor = 0
    truncated = False

    while cursor < len(paragraphs):
        paragraph = paragraphs[cursor]
        if current and current_tokens + paragraph.token_estimate > target_chunk_tokens:
            chunks.append(_build_chunk(len(chunks), current))
            if len(chunks) >= max_chunks:
                truncated = True
                break
            start = _overlap_start(current, overlap_tokens)
            current = current[start:]
            current_tokens = sum(part.token_estimate for part in current)
            continue

        current.append(paragraph)
        current_tokens += paragraph.token_estimate
        cursor += 1

    if not truncated and current:
        chunks.append(_build_chunk(len(chunks), current))
        if len(chunks) > max_chunks:
            chunks = chunks[:max_chunks]
            truncated = True

    total_tokens = sum(chunk.token_estimate for chunk in chunks)
    return ChunkingResult(
        normalized_text=normalized,
        chunks=chunks,
        truncated=truncated,
        total_token_estimate=total_tokens,
    )


def should_use_full_context(token_estimate: int, *, threshold: int = FULL_CONTEXT_TOKEN_THRESHOLD) -> bool:
    return token_estimate > 0 and token_estimate <= threshold


def absolute_span_within_chunk(
    chunk: TextChunk,
    relative_start: int,
    relative_end: int,
) -> Tuple[int, int]:
    start = max(chunk.char_start, chunk.char_start + max(0, relative_start))
    end = min(chunk.char_end, chunk.char_start + max(relative_start, relative_end))
    return (start, end)
