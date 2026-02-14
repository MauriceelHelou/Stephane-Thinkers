"""
Utilities for inserting [birth_year-death_year] annotations after thinker names
in note content (both plain text and HTML).
"""

import re
from html.parser import HTMLParser
from io import StringIO
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from app.utils.thinker_detection import DetectedMatch

# Matches existing year tags like [1844-1900], [b. 1844], [d. 1900]
EXISTING_YEAR_TAG = re.compile(
    r"^\s*\[(?:b\.\s*)?\d{1,4}(?:\s*-\s*\d{1,4})?\]"
    r"|^\s*\[d\.\s*\d{1,4}\]"
)


def format_year_tag(birth_year: Optional[int], death_year: Optional[int]) -> str:
    """Build the [birth-death] annotation string."""
    if birth_year and death_year:
        return f" [{birth_year}-{death_year}]"
    elif birth_year:
        return f" [b. {birth_year}]"
    elif death_year:
        return f" [d. {death_year}]"
    return ""


def insert_years_plain_text(
    content: str,
    matches: List[DetectedMatch],
    thinker_years: Dict[UUID, Tuple[Optional[int], Optional[int]]],
) -> str:
    """Insert [birth-death] annotations into plain text content.

    Uses per-paragraph char_offset from DetectedMatch, processing matches
    in reverse order within each paragraph to preserve earlier offsets.
    """
    if not matches or not content:
        return content

    paragraphs = content.split("\n")

    # Group matches by paragraph
    by_paragraph: Dict[int, List[DetectedMatch]] = {}
    for match in matches:
        by_paragraph.setdefault(match.paragraph_index, []).append(match)

    for para_idx, para_matches in by_paragraph.items():
        if para_idx >= len(paragraphs):
            continue

        paragraph = paragraphs[para_idx]

        # Sort by char_offset descending to process right-to-left
        para_matches.sort(key=lambda m: m.char_offset, reverse=True)

        for match in para_matches:
            years = thinker_years.get(match.thinker_id)
            if not years:
                continue

            birth_year, death_year = years
            year_tag = format_year_tag(birth_year, death_year)
            if not year_tag:
                continue

            insert_pos = match.char_offset + match.match_length

            # Skip if already annotated
            text_after = paragraph[insert_pos:]
            if EXISTING_YEAR_TAG.match(text_after):
                continue

            paragraph = paragraph[:insert_pos] + year_tag + paragraph[insert_pos:]

        paragraphs[para_idx] = paragraph

    return "\n".join(paragraphs)


class _YearAnnotator(HTMLParser):
    """Walks HTML text nodes and inserts year annotations after thinker names."""

    def __init__(self, thinker_patterns: List[Tuple[re.Pattern, str]]):
        super().__init__(convert_charrefs=False)
        self.thinker_patterns = thinker_patterns
        self.output = StringIO()
        self._inside_mention = False
        self._mention_depth = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        attr_dict = dict(attrs)
        if tag == "span" and attr_dict.get("data-type") == "thinker-mention":
            self._inside_mention = True
            self._mention_depth = 1
        elif self._inside_mention and tag == "span":
            self._mention_depth += 1

        self.output.write(self._build_tag(tag, attrs))

    def handle_startendtag(self, tag: str, attrs: list) -> None:
        self.output.write(self._build_tag(tag, attrs, self_closing=True))

    @staticmethod
    def _build_tag(tag: str, attrs: list, self_closing: bool = False) -> str:
        attrs_str = ""
        for k, v in attrs:
            if v is None:
                attrs_str += f" {k}"
            else:
                attrs_str += f' {k}="{v}"'
        return f"<{tag}{attrs_str}/>" if self_closing else f"<{tag}{attrs_str}>"

    def handle_endtag(self, tag: str) -> None:
        if self._inside_mention and tag == "span":
            self._mention_depth -= 1
            if self._mention_depth == 0:
                self._inside_mention = False
        self.output.write(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self._inside_mention:
            self.output.write(data)
            return

        result = data
        for pattern, year_tag in self.thinker_patterns:
            result = self._insert_in_text(result, pattern, year_tag)
        self.output.write(result)

    def handle_entityref(self, name: str) -> None:
        self.output.write(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.output.write(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        self.output.write(f"<!--{data}-->")

    def _insert_in_text(self, text: str, pattern: re.Pattern, year_tag: str) -> str:
        parts: list[str] = []
        last_end = 0

        for m in pattern.finditer(text):
            parts.append(text[last_end:m.end()])
            text_after = text[m.end():]
            if not EXISTING_YEAR_TAG.match(text_after):
                parts.append(year_tag)
            last_end = m.end()

        parts.append(text[last_end:])
        return "".join(parts)

    def get_result(self) -> str:
        return self.output.getvalue()


def insert_years_html(
    content_html: str,
    matches: List[DetectedMatch],
    thinker_years: Dict[UUID, Tuple[Optional[int], Optional[int]]],
) -> str:
    """Insert year annotations into HTML content, modifying only text nodes."""
    if not matches or not content_html:
        return content_html

    # Build unique patterns from matched texts, sorted longest-first so
    # "John Stuart Mill" is processed before "Mill" (avoids wrong year insertion).
    seen_texts: set[str] = set()
    entries: List[Tuple[str, re.Pattern, str]] = []  # (matched_text, regex, year_tag)

    for match in matches:
        years = thinker_years.get(match.thinker_id)
        if not years:
            continue
        birth_year, death_year = years
        year_tag = format_year_tag(birth_year, death_year)
        if not year_tag:
            continue

        text_key = match.matched_text.lower()
        if text_key in seen_texts:
            continue
        seen_texts.add(text_key)

        pattern = re.compile(r"\b" + re.escape(match.matched_text) + r"\b", re.IGNORECASE)
        entries.append((match.matched_text, pattern, year_tag))

    entries.sort(key=lambda x: len(x[0]), reverse=True)
    thinker_patterns = [(pat, tag) for _, pat, tag in entries]

    annotator = _YearAnnotator(thinker_patterns)
    annotator.feed(content_html)
    return annotator.get_result()
