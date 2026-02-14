"""Compatibility aliases for legacy note-tag schemas.

Notes and thinkers now share the same Tag schema contract.
"""

from app.schemas.tag import TagBase as NoteTagBase
from app.schemas.tag import TagCreate as NoteTagCreate
from app.schemas.tag import TagUpdate as NoteTagUpdate
from app.schemas.tag import Tag as NoteTag

__all__ = [
    "NoteTagBase",
    "NoteTagCreate",
    "NoteTagUpdate",
    "NoteTag",
]
