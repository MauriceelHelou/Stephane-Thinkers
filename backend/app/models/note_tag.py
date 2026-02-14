"""Compatibility aliases for legacy note-tag imports.

Notes and thinkers now share the same Tag model/table.
"""

from app.models.tag import Tag as NoteTag
from app.models.tag import note_tag_assignments

__all__ = ["NoteTag", "note_tag_assignments"]
