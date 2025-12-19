from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID
import re

NoteTypeStr = Literal["general", "research", "biography", "connection"]
NoteColorStr = Literal["yellow", "pink", "blue", "green"]


class NoteBase(BaseModel):
    title: Optional[str] = None
    content: str
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


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    note_type: Optional[NoteTypeStr] = None
    # Canvas sticky note fields
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    color: Optional[NoteColorStr] = None
    is_canvas_note: Optional[bool] = None


class MentionedThinker(BaseModel):
    """Minimal thinker info for mentions."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class Note(NoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thinker_id: Optional[UUID] = None
    content_html: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class NoteWithMentions(Note):
    """Note with expanded mentioned thinkers."""
    model_config = ConfigDict(from_attributes=True)

    mentioned_thinkers: List[MentionedThinker] = []


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
    """Convert [[Thinker Name]] links to HTML anchor tags."""
    def replace_link(match):
        name = match.group(1)
        thinker = thinker_map.get(name.lower())
        if thinker:
            return f'<a href="/thinker/{thinker["id"]}" class="wiki-link" data-thinker-id="{thinker["id"]}">{name}</a>'
        return f'<span class="wiki-link-broken">{name}</span>'

    pattern = r'\[\[(.*?)\]\]'
    return re.sub(pattern, replace_link, content)
