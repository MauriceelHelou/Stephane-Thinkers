from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID
import html
import re

from app.schemas.tag import Tag as TagSchema

NoteTypeStr = Literal["general", "research", "biography", "connection"]
NoteColorStr = Literal["yellow", "pink", "blue", "green"]


class NoteBase(BaseModel):
    title: Optional[str] = None
    content: str
    content_html: Optional[str] = None
    note_type: Optional[NoteTypeStr] = "general"
    # Canvas sticky note fields
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    color: Optional[NoteColorStr] = "yellow"
    is_canvas_note: Optional[bool] = False

    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        return v


class NoteCreate(NoteBase):
    thinker_id: Optional[UUID] = None
    folder_id: Optional[UUID] = None
    tag_ids: Optional[List[UUID]] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    content_html: Optional[str] = None
    note_type: Optional[NoteTypeStr] = None
    folder_id: Optional[UUID] = None
    tag_ids: Optional[List[UUID]] = None
    # Canvas sticky note fields
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    color: Optional[NoteColorStr] = None
    is_canvas_note: Optional[bool] = None

    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        if v is not None and not v.strip():
            raise ValueError('Content cannot be empty')
        return v


class MentionedThinker(BaseModel):
    """Minimal thinker info for mentions."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class Note(NoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thinker_id: Optional[UUID] = None
    folder_id: Optional[UUID] = None
    tags: List[TagSchema] = Field(default_factory=list)
    content_html: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class NoteWithMentions(Note):
    """Note with expanded mentioned thinkers."""
    model_config = ConfigDict(from_attributes=True)

    mentioned_thinkers: List[MentionedThinker] = Field(default_factory=list)


class NoteVersionBase(BaseModel):
    content: str
    version_number: int


class NoteVersion(NoteVersionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    note_id: UUID
    created_at: datetime


def parse_wiki_links(content: str) -> List[str]:
    """Extract [[Thinker Name]] style links from content."""
    pattern = r'\[\[(.*?)\]\]'
    matches = re.findall(pattern, content)
    return matches


def convert_wiki_links_to_html(content: str, thinker_map: dict) -> str:
    """
    Convert [[Thinker Name]] links to safe HTML anchor tags.

    All non-link content is HTML-escaped to prevent script injection.
    """
    pattern = re.compile(r"\[\[(.*?)\]\]")
    html_parts: List[str] = []
    cursor = 0

    for match in pattern.finditer(content):
        # Escape plain-text segment before the link token.
        html_parts.append(html.escape(content[cursor:match.start()]))

        name = match.group(1).strip()
        safe_name = html.escape(name)
        thinker = thinker_map.get(name.lower())
        if thinker:
            thinker_id = html.escape(str(thinker["id"]), quote=True)
            html_parts.append(
                f'<a href="/thinker/{thinker_id}" class="wiki-link" data-thinker-id="{thinker_id}">{safe_name}</a>'
            )
        else:
            html_parts.append(f'<span class="wiki-link-broken">{safe_name}</span>')

        cursor = match.end()

    # Escape tail segment after the final link token.
    html_parts.append(html.escape(content[cursor:]))

    return "".join(html_parts)
