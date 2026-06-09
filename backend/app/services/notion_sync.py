"""
Notion one-way notes mirror service.

Syncs research notes from PostgreSQL -> Notion as a secondary read-only replica.
Supports setup, full sync, incremental sync, and schema updates.

Hard constraints:
  - One-way only (Stephane-Thinkers -> Notion)
  - No read-back writes from Notion into canonical tables
  - Notion API rate limits respected (3 req/s average)
"""
import hashlib
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.models.folder import Folder
from app.models.note import Note
from app.models.notion_sync import NotionSyncMap, NotionSyncJob

logger = logging.getLogger(__name__)

# Rate limiting: max requests per second to Notion API
NOTION_RATE_LIMIT_RPS = float(os.getenv("NOTION_RATE_LIMIT_RPS", "2.5"))
_MIN_INTERVAL = 1.0 / NOTION_RATE_LIMIT_RPS if NOTION_RATE_LIMIT_RPS > 0 else 0.4

# Notion API constraints
NOTION_CHILDREN_CHUNK_SIZE = 100
NOTION_TEXT_OBJECT_MAX_CHARS = 2000
NOTION_OPTION_NAME_MAX_CHARS = 100
NOTION_MAX_BLOCKS_PER_PAGE = int(os.getenv("NOTION_MAX_BLOCKS_PER_PAGE", "100"))

NOTION_HASH_VERSION = "v2"

HEADING_PATTERN = re.compile(r"^(#{1,3})\s+(.*)$")
BULLET_PATTERN = re.compile(r"^\s*[-*]\s+(.*)$")
NUMBERED_PATTERN = re.compile(r"^\s*\d+\.\s+(.*)$")
DIVIDER_PATTERN = re.compile(r"^\s*---\s*$")
INLINE_TOKEN_PATTERN = re.compile(r"\[\[([^\]]+)\]\]|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*")

RECOMMENDED_VIEWS = [
    "All Notes (table, sorted by Updated desc)",
    "By Folder (table grouped by Folder)",
    "By Thinker (table grouped by Thinker)",
    "By Type (board grouped by Note Type)",
    "Recent (table filtered to Updated in last 7 days)",
]


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_notion_client():
    """Initialize Notion API client from environment."""
    try:
        from notion_client import Client
    except ImportError:
        raise RuntimeError("notion-client is not installed. Run: pip install notion-client")

    token = os.getenv("NOTION_INTEGRATION_TOKEN", "")
    if not token:
        raise RuntimeError("NOTION_INTEGRATION_TOKEN is not configured")

    return Client(auth=token)


def _get_database_id() -> str:
    """Get the Notion database ID for notes mirror."""
    db_id = os.getenv("NOTION_NOTES_DATABASE_ID", "")
    if not db_id:
        raise RuntimeError("NOTION_NOTES_DATABASE_ID is not configured")
    return db_id


def _truncate_option_name(value: Optional[str], default: str = "") -> str:
    normalized = str(value or default).strip() or default
    return normalized[:NOTION_OPTION_NAME_MAX_CHARS]


def _safe_iso(value: Optional[datetime]) -> str:
    return value.isoformat() if value else ""


def _sorted_unique_names(values: list[Any]) -> list[str]:
    cleaned = {str(getattr(item, "name", "") or "").strip() for item in values}
    return sorted(name for name in cleaned if name)


def _get_folder_path(
    folder: Optional[Folder],
    folder_lookup: Optional[dict[str, Folder]] = None,
    *,
    max_depth: int = 16,
) -> str:
    if folder is None:
        return "Unfiled"

    names: list[str] = []
    seen: set[str] = set()
    current: Optional[Folder] = folder
    depth = 0

    while current is not None and depth < max_depth:
        folder_id = str(getattr(current, "id", ""))
        if folder_id and folder_id in seen:
            break
        if folder_id:
            seen.add(folder_id)

        name = str(getattr(current, "name", "") or "").strip() or "Untitled Folder"
        names.append(name)

        parent_id = getattr(current, "parent_id", None)
        if folder_lookup is not None and parent_id is not None:
            current = folder_lookup.get(str(parent_id))
        else:
            current = getattr(current, "parent", None)

        depth += 1

    if not names:
        return "Unfiled"

    return " / ".join(reversed(names))


def _content_hash(note: Note, *, folder_lookup: Optional[dict[str, Folder]] = None) -> str:
    """Compute a stable hash for note content + mirror metadata."""
    folder_path = _get_folder_path(getattr(note, "folder", None), folder_lookup)
    tag_names = _sorted_unique_names(list(getattr(note, "tags", []) or []))
    mention_names = _sorted_unique_names(list(getattr(note, "mentioned_thinkers", []) or []))

    payload = {
        "version": NOTION_HASH_VERSION,
        "id": str(note.id),
        "title": note.title or "",
        "content": note.content or "",
        "updated_at": _safe_iso(note.updated_at),
        "note_type": note.note_type or "general",
        "color": note.color or "yellow",
        "folder_id": str(note.folder_id) if note.folder_id else "",
        "folder_path": folder_path,
        "thinker_id": str(note.thinker_id) if note.thinker_id else "",
        "thinker_name": getattr(getattr(note, "thinker", None), "name", "") or "",
        "tag_names": tag_names,
        "mentioned_thinker_names": mention_names,
    }
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _notion_database_properties() -> dict[str, dict[str, Any]]:
    return {
        "Title": {"title": {}},
        "Note Type": {
            "select": {
                "options": [
                    {"name": "general"},
                    {"name": "research"},
                    {"name": "biography"},
                    {"name": "connection"},
                ]
            }
        },
        "Folder": {"select": {}},
        "Folder Path": {"rich_text": {}},
        "Thinker": {"select": {}},
        "Tags": {"multi_select": {}},
        "Mentioned Thinkers": {"multi_select": {}},
        "Color": {
            "select": {
                "options": [
                    {"name": "yellow"},
                    {"name": "pink"},
                    {"name": "blue"},
                    {"name": "green"},
                ]
            }
        },
        "Created": {"date": {}},
        "Updated": {"date": {}},
        "Local ID": {"rich_text": {}},
    }


def _note_to_notion_properties(
    note: Note,
    *,
    folder_lookup: Optional[dict[str, Folder]] = None,
    title_property_name: str = "Title",
) -> dict[str, Any]:
    """Convert a Note to rich Notion page properties."""
    folder = getattr(note, "folder", None)
    thinker = getattr(note, "thinker", None)

    folder_name = "Unfiled"
    if folder is not None:
        folder_name = _truncate_option_name(getattr(folder, "name", ""), default="Unfiled")

    thinker_name = None
    if thinker is not None:
        thinker_name = _truncate_option_name(getattr(thinker, "name", ""), default="")
        if thinker_name == "":
            thinker_name = None

    folder_path = _get_folder_path(folder, folder_lookup)
    tags = _sorted_unique_names(list(getattr(note, "tags", []) or []))
    mention_names = _sorted_unique_names(list(getattr(note, "mentioned_thinkers", []) or []))

    note_type = _truncate_option_name(getattr(note, "note_type", None), default="general")
    if note_type == "":
        note_type = "general"

    color = _truncate_option_name(getattr(note, "color", None), default="yellow")
    if color == "":
        color = "yellow"

    properties: dict[str, Any] = {
        title_property_name: {"title": [{"text": {"content": note.title or "Untitled"}}]},
        "Note Type": {"select": {"name": note_type}},
        "Folder": {"select": {"name": folder_name}},
        "Folder Path": {
            "rich_text": [
                {
                    "type": "text",
                    "text": {"content": folder_path[:NOTION_TEXT_OBJECT_MAX_CHARS]},
                }
            ]
        },
        "Thinker": {"select": {"name": thinker_name}} if thinker_name else {"select": None},
        "Tags": {"multi_select": [{"name": _truncate_option_name(name)} for name in tags]},
        "Mentioned Thinkers": {
            "multi_select": [{"name": _truncate_option_name(name)} for name in mention_names]
        },
        "Color": {"select": {"name": color}},
        "Local ID": {"rich_text": [{"text": {"content": str(note.id)}}]},
        "Created": {"date": {"start": note.created_at.isoformat()}} if note.created_at else {"date": None},
        "Updated": {"date": {"start": note.updated_at.isoformat()}} if note.updated_at else {"date": None},
    }

    return properties


def _annotation_payload(*, bold: bool = False, italic: bool = False) -> dict[str, Any]:
    return {
        "bold": bool(bold),
        "italic": bool(italic),
        "strikethrough": False,
        "underline": False,
        "code": False,
        "color": "default",
    }


def _split_text_chunks(text: str) -> list[str]:
    if not text:
        return []
    return [text[i : i + NOTION_TEXT_OBJECT_MAX_CHARS] for i in range(0, len(text), NOTION_TEXT_OBJECT_MAX_CHARS)]


def _make_rich_text_entries(text: str, *, bold: bool = False, italic: bool = False) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for chunk in _split_text_chunks(text):
        if not chunk:
            continue
        entries.append(
            {
                "type": "text",
                "text": {"content": chunk},
                "annotations": _annotation_payload(bold=bold, italic=italic),
            }
        )
    return entries


def _parse_inline_rich_text(text: str) -> list[dict[str, Any]]:
    """
    Parse a constrained markdown subset into Notion rich_text segments.

    Supported inline tokens:
      - **bold**
      - *italic*
      - [[Wiki Link]] -> bold visual emphasis
    """
    if not text:
        return []

    segments: list[dict[str, Any]] = []
    cursor = 0

    for match in INLINE_TOKEN_PATTERN.finditer(text):
        if match.start() > cursor:
            plain = text[cursor : match.start()]
            segments.extend(_make_rich_text_entries(plain))

        wiki_name = match.group(1)
        bold_text = match.group(2)
        italic_text = match.group(3)

        if wiki_name is not None:
            segments.extend(_make_rich_text_entries(wiki_name, bold=True))
        elif bold_text is not None:
            segments.extend(_make_rich_text_entries(bold_text, bold=True))
        elif italic_text is not None:
            segments.extend(_make_rich_text_entries(italic_text, italic=True))

        cursor = match.end()

    if cursor < len(text):
        segments.extend(_make_rich_text_entries(text[cursor:]))

    return [entry for entry in segments if str(entry.get("text", {}).get("content", "")) != ""]


def _make_text_block(block_type: str, text: str) -> Optional[dict[str, Any]]:
    rich_text = _parse_inline_rich_text(text.strip())
    if not rich_text:
        return None

    return {
        "object": "block",
        "type": block_type,
        block_type: {
            "rich_text": rich_text,
        },
    }


def _note_to_notion_children(note: Note) -> list[dict[str, Any]]:
    """Convert note markdown content into rich Notion blocks."""
    blocks: list[dict[str, Any]] = []
    content = note.content or ""

    for raw_line in content.splitlines():
        if len(blocks) >= NOTION_MAX_BLOCKS_PER_PAGE:
            break

        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            continue

        if DIVIDER_PATTERN.match(stripped):
            blocks.append({"object": "block", "type": "divider", "divider": {}})
            continue

        heading_match = HEADING_PATTERN.match(stripped)
        if heading_match:
            level = len(heading_match.group(1))
            heading_text = heading_match.group(2).strip()
            block_type = f"heading_{level}"
            block = _make_text_block(block_type, heading_text)
            if block:
                blocks.append(block)
            continue

        bullet_match = BULLET_PATTERN.match(line)
        if bullet_match:
            block = _make_text_block("bulleted_list_item", bullet_match.group(1))
            if block:
                blocks.append(block)
            continue

        numbered_match = NUMBERED_PATTERN.match(line)
        if numbered_match:
            block = _make_text_block("numbered_list_item", numbered_match.group(1))
            if block:
                blocks.append(block)
            continue

        block = _make_text_block("paragraph", stripped)
        if block:
            blocks.append(block)

    return blocks[:NOTION_MAX_BLOCKS_PER_PAGE]


def _rate_limit_sleep():
    """Sleep to respect Notion API rate limits."""
    time.sleep(_MIN_INTERVAL)


def _is_rate_limited(exc: Exception) -> bool:
    status = getattr(exc, "status", None) or getattr(exc, "status_code", None)
    if status == 429:
        return True
    code = getattr(exc, "code", None)
    if isinstance(code, str) and "rate" in code.lower():
        return True
    if "rate" in str(exc).lower():
        return True
    return False


def _call_with_retry(fn, *args, **kwargs):
    delay = 1.0
    for attempt in range(5):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            if _is_rate_limited(exc) and attempt < 4:
                time.sleep(delay)
                delay = min(delay * 2, 8.0)
                continue
            raise


def _chunk_blocks(blocks: list[dict[str, Any]], size: int = NOTION_CHILDREN_CHUNK_SIZE) -> list[list[dict[str, Any]]]:
    return [blocks[i : i + size] for i in range(0, len(blocks), size)]


def _create_page_with_children(
    notion,
    *,
    parent: dict[str, str],
    properties: dict[str, Any],
    blocks: list[dict[str, Any]],
) -> dict[str, Any]:
    chunks = _chunk_blocks(blocks, NOTION_CHILDREN_CHUNK_SIZE)
    create_kwargs: dict[str, Any] = {
        "parent": parent,
        "properties": properties,
    }
    if chunks:
        create_kwargs["children"] = chunks[0]

    page = _call_with_retry(notion.pages.create, **create_kwargs)
    page_id = page["id"]
    _rate_limit_sleep()

    for chunk in chunks[1:]:
        _call_with_retry(notion.blocks.children.append, block_id=page_id, children=chunk)
        _rate_limit_sleep()

    return page


def _replace_page_children(notion, page_id: str, blocks: list[dict[str, Any]]) -> None:
    """Replace all child blocks on a Notion page with the provided blocks."""
    cursor = None
    block_ids: list[str] = []
    while True:
        response = _call_with_retry(
            notion.blocks.children.list,
            block_id=page_id,
            start_cursor=cursor,
        )
        block_ids.extend([block["id"] for block in response.get("results", [])])
        if not response.get("has_more"):
            break
        cursor = response.get("next_cursor")
        _rate_limit_sleep()

    for block_id in block_ids:
        try:
            _call_with_retry(notion.blocks.delete, block_id=block_id)
        except Exception as exc:
            logger.warning("Failed to delete Notion block %s: %s", block_id, exc)
        _rate_limit_sleep()

    for chunk in _chunk_blocks(blocks, NOTION_CHILDREN_CHUNK_SIZE):
        if not chunk:
            continue
        _call_with_retry(notion.blocks.children.append, block_id=page_id, children=chunk)
        _rate_limit_sleep()


def _find_title_property_name(properties: dict[str, Any]) -> str:
    for name, definition in properties.items():
        if str(definition.get("type") or "") == "title":
            return name
    return "Title"


def _resolve_sync_target(notion, database_id: str) -> dict[str, Any]:
    """
    Resolve whether writes should target a legacy database or a modern data source.

    Notion now models schema on `data_source` objects under a `database`. Older
    workspaces may still expose properties directly on the database.
    """
    database_meta = _call_with_retry(notion.databases.retrieve, database_id=database_id)
    database_props = database_meta.get("properties") if isinstance(database_meta, dict) else None
    data_sources = database_meta.get("data_sources", []) if isinstance(database_meta, dict) else []

    if isinstance(database_props, dict) and database_props:
        title_property_name = _find_title_property_name(database_props)
        return {
            "target_type": "database",
            "target_id": database_id,
            "parent": {"database_id": database_id},
            "properties": database_props,
            "title_property_name": title_property_name,
            "database_url": database_meta.get("url") if isinstance(database_meta, dict) else None,
        }

    if data_sources:
        data_source_id = str(data_sources[0].get("id"))
        data_source_meta = _call_with_retry(notion.data_sources.retrieve, data_source_id=data_source_id)
        data_source_props = (
            data_source_meta.get("properties", {}) if isinstance(data_source_meta, dict) else {}
        )
        title_property_name = _find_title_property_name(data_source_props)
        return {
            "target_type": "data_source",
            "target_id": data_source_id,
            "parent": {"data_source_id": data_source_id},
            "properties": data_source_props,
            "title_property_name": title_property_name,
            "database_url": database_meta.get("url") if isinstance(database_meta, dict) else None,
        }

    return {
        "target_type": "database",
        "target_id": database_id,
        "parent": {"database_id": database_id},
        "properties": {},
        "title_property_name": "Title",
        "database_url": database_meta.get("url") if isinstance(database_meta, dict) else None,
    }


def _load_folder_lookup(db: Session) -> dict[str, Folder]:
    folders = db.query(Folder).all()
    return {str(folder.id): folder for folder in folders}


def _load_notes_for_sync(db: Session) -> list[Note]:
    return (
        db.query(Note)
        .options(
            selectinload(Note.folder),
            selectinload(Note.thinker),
            selectinload(Note.tags),
            selectinload(Note.mentioned_thinkers),
        )
        .order_by(Note.created_at.asc())
        .all()
    )


def _apply_database_schema_update(notion, database_id: str) -> dict[str, Any]:
    desired = _notion_database_properties().copy()
    target = _resolve_sync_target(notion, database_id)
    existing_properties = target.get("properties", {}) or {}
    title_property_name = str(target.get("title_property_name") or "Title")

    if title_property_name != "Title":
        desired[title_property_name] = desired.pop("Title")

    to_add: dict[str, dict[str, Any]] = {}
    to_option_update: dict[str, dict[str, Any]] = {}
    added_select_options: dict[str, list[str]] = {}
    conflicts: list[dict[str, str]] = []

    for name, definition in desired.items():
        existing = existing_properties.get(name)
        desired_type = next(iter(definition.keys()))
        if existing is None:
            to_add[name] = definition
            continue

        existing_type = str(existing.get("type") or "")
        if existing_type != desired_type:
            conflicts.append(
                {
                    "property": name,
                    "expected_type": desired_type,
                    "actual_type": existing_type,
                }
            )
            continue

        if desired_type == "select":
            desired_options = definition.get("select", {}).get("options", [])
            existing_options = {
                str(option.get("name", "")).strip()
                for option in existing.get("select", {}).get("options", [])
                if str(option.get("name", "")).strip()
            }
            missing_options = [
                option
                for option in desired_options
                if str(option.get("name", "")).strip() and str(option.get("name", "")).strip() not in existing_options
            ]
            if missing_options:
                to_option_update[name] = {"select": {"options": missing_options}}
                added_select_options[name] = [str(option.get("name")) for option in missing_options]

    update_properties = {**to_add, **to_option_update}

    if update_properties:
        if target.get("target_type") == "data_source":
            _call_with_retry(
                notion.data_sources.update,
                data_source_id=target["target_id"],
                properties=update_properties,
            )
        else:
            _call_with_retry(
                notion.databases.update,
                database_id=database_id,
                properties=update_properties,
            )
        _rate_limit_sleep()
        target = _resolve_sync_target(notion, database_id)

    refreshed_properties = target.get("properties", {}) or {}

    return {
        "database_id": database_id,
        "database_url": target.get("database_url"),
        "property_count": len(refreshed_properties),
        "added_properties": sorted(to_add.keys()),
        "added_select_options": added_select_options,
        "conflicts": conflicts,
        "title_property_name": title_property_name,
        "target_type": target.get("target_type"),
        "target_id": target.get("target_id"),
        "recommended_views": RECOMMENDED_VIEWS,
    }


def setup_notion_database(db: Optional[Session] = None) -> dict:
    """Create the Notion notes mirror database if it doesn't exist."""
    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        notion = _get_notion_client()
        parent_page_id = os.getenv("NOTION_PARENT_PAGE_ID", "")
        if not parent_page_id:
            return {"status": "failed", "error": "NOTION_PARENT_PAGE_ID is not configured"}

        existing_db_id = os.getenv("NOTION_NOTES_DATABASE_ID", "")
        if existing_db_id:
            try:
                target = _resolve_sync_target(notion, existing_db_id)
                property_count = len(target.get("properties", {}) or {})
                return {
                    "status": "exists",
                    "database_id": existing_db_id,
                    "database_url": target.get("database_url"),
                    "property_count": property_count,
                    "recommended_views": RECOMMENDED_VIEWS,
                    "message": "Notion database already configured. Set NOTION_NOTES_DATABASE_ID in env.",
                }
            except Exception:
                return {
                    "status": "exists",
                    "database_id": existing_db_id,
                    "recommended_views": RECOMMENDED_VIEWS,
                    "message": "Notion database already configured. Set NOTION_NOTES_DATABASE_ID in env.",
                }

        result = _call_with_retry(
            notion.databases.create,
            parent={"type": "page_id", "page_id": parent_page_id},
            title=[{"type": "text", "text": {"content": "Research Notes Mirror"}}],
            properties=_notion_database_properties(),
        )

        database_id = result["id"]
        # Ensure all required schema fields exist after creation across both
        # legacy database and modern data-source workspaces.
        schema_result = _apply_database_schema_update(notion, database_id)
        property_count = schema_result.get("property_count")
        logger.info("Created Notion database: %s", database_id)
        return {
            "status": "created",
            "database_id": database_id,
            "database_url": schema_result.get("database_url")
            or (result.get("url") if isinstance(result, dict) else None),
            "property_count": property_count,
            "added_properties": schema_result.get("added_properties", []),
            "added_select_options": schema_result.get("added_select_options", {}),
            "recommended_views": RECOMMENDED_VIEWS,
            "message": f"Set NOTION_NOTES_DATABASE_ID={database_id} in your environment.",
        }
    finally:
        if own_session:
            db.close()


def update_notion_database_schema(db: Optional[Session] = None) -> dict:
    """Ensure the configured Notion database has the required mirror properties."""
    own_session = db is None
    if own_session:
        db = SessionLocal()

    job = NotionSyncJob(
        id=uuid.uuid4(),
        job_type="schema_update",
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()

    try:
        notion = _get_notion_client()
        database_id = _get_database_id()
        update_result = _apply_database_schema_update(notion, database_id)

        conflicts = update_result.get("conflicts", [])
        job.status = "completed_conflicts" if conflicts else "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = (
            f"Schema conflicts detected for properties: {', '.join(item['property'] for item in conflicts)}"
            if conflicts
            else None
        )
        db.commit()

        return {
            "status": job.status,
            **update_result,
            "schema_updated_at": job.completed_at.isoformat() if job.completed_at else None,
        }
    except Exception as exc:
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = str(exc)[:2000]
        db.commit()
        logger.exception("Notion schema update failed")
        return {"status": "failed", "error": str(exc)[:500]}
    finally:
        if own_session:
            db.close()


def _sync_notes(
    *,
    db: Session,
    notion,
    page_parent: dict[str, str],
    notes: list[Note],
    map_by_note_id: dict[str, NotionSyncMap],
    folder_lookup: dict[str, Folder],
    title_property_name: str,
) -> tuple[int, int, int]:
    created = 0
    updated = 0
    skipped = 0

    for note in notes:
        note_id = str(note.id)
        existing_map = map_by_note_id.get(note_id)
        content_hash = _content_hash(note, folder_lookup=folder_lookup)

        if existing_map and existing_map.content_hash == content_hash:
            skipped += 1
            continue

        properties = _note_to_notion_properties(
            note,
            folder_lookup=folder_lookup,
            title_property_name=title_property_name,
        )
        blocks = _note_to_notion_children(note)

        if existing_map:
            try:
                _call_with_retry(
                    notion.pages.update,
                    page_id=existing_map.notion_page_id,
                    properties=properties,
                )
                _rate_limit_sleep()
                _replace_page_children(notion, existing_map.notion_page_id, blocks)
                existing_map.last_synced_at = datetime.now(timezone.utc)
                existing_map.content_hash = content_hash
                updated += 1
            except Exception as exc:
                logger.warning("Failed to update Notion page %s: %s", existing_map.notion_page_id, exc)
                skipped += 1
            continue

        try:
            result = _create_page_with_children(
                notion,
                parent=page_parent,
                properties=properties,
                blocks=blocks,
            )
            sync_map = NotionSyncMap(
                id=uuid.uuid4(),
                local_id=note.id,
                entity_type="note",
                notion_page_id=result["id"],
                last_synced_at=datetime.now(timezone.utc),
                content_hash=content_hash,
            )
            db.add(sync_map)
            map_by_note_id[note_id] = sync_map
            created += 1
        except Exception as exc:
            logger.warning("Failed to create Notion page for note %s: %s", note.id, exc)
            skipped += 1

    return created, updated, skipped


def full_sync(db: Optional[Session] = None) -> dict:
    """Full sync: create or update all notes in Notion."""
    own_session = db is None
    if own_session:
        db = SessionLocal()

    job = NotionSyncJob(
        id=uuid.uuid4(),
        job_type="full",
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()

    try:
        notion = _get_notion_client()
        database_id = _get_database_id()
        target = _resolve_sync_target(notion, database_id)

        notes = _load_notes_for_sync(db)
        folder_lookup = _load_folder_lookup(db)
        existing_maps = db.query(NotionSyncMap).filter(NotionSyncMap.entity_type == "note").all()
        map_by_note_id = {str(item.local_id): item for item in existing_maps}

        created, updated, skipped = _sync_notes(
            db=db,
            notion=notion,
            page_parent=target["parent"],
            notes=notes,
            map_by_note_id=map_by_note_id,
            folder_lookup=folder_lookup,
            title_property_name=str(target.get("title_property_name") or "Title"),
        )

        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.pages_created = created
        job.pages_updated = updated
        job.pages_skipped = skipped
        db.commit()

        logger.info("Full sync completed: created=%d updated=%d skipped=%d", created, updated, skipped)
        return {
            "status": "completed",
            "created": created,
            "updated": updated,
            "skipped": skipped,
        }

    except Exception as exc:
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = str(exc)[:2000]
        db.commit()
        logger.exception("Full sync failed")
        return {"status": "failed", "error": str(exc)[:500]}
    finally:
        if own_session:
            db.close()


def incremental_sync(db: Optional[Session] = None) -> dict:
    """
    Incremental sync: hash-check all notes and only push changed/new pages.

    This intentionally re-evaluates hash state for already-mapped notes so
    metadata-only changes (tags, folder moves, mention updates, etc.) are synced
    even when `notes.updated_at` is unchanged.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()

    job = NotionSyncJob(
        id=uuid.uuid4(),
        job_type="incremental",
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()

    try:
        notion = _get_notion_client()
        database_id = _get_database_id()
        target = _resolve_sync_target(notion, database_id)

        notes = _load_notes_for_sync(db)
        folder_lookup = _load_folder_lookup(db)
        existing_maps = db.query(NotionSyncMap).filter(NotionSyncMap.entity_type == "note").all()
        map_by_note_id = {str(item.local_id): item for item in existing_maps}

        created, updated, skipped = _sync_notes(
            db=db,
            notion=notion,
            page_parent=target["parent"],
            notes=notes,
            map_by_note_id=map_by_note_id,
            folder_lookup=folder_lookup,
            title_property_name=str(target.get("title_property_name") or "Title"),
        )

        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.pages_created = created
        job.pages_updated = updated
        job.pages_skipped = skipped
        db.commit()

        logger.info("Incremental sync completed: created=%d updated=%d skipped=%d", created, updated, skipped)
        return {
            "status": "completed",
            "created": created,
            "updated": updated,
            "skipped": skipped,
        }

    except Exception as exc:
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = str(exc)[:2000]
        db.commit()
        logger.exception("Incremental sync failed")
        return {"status": "failed", "error": str(exc)[:500]}
    finally:
        if own_session:
            db.close()


def run_scheduled_notion_cycle(db: Optional[Session] = None) -> dict:
    """
    Run one scheduled incremental sync cycle.

    This is intended to be triggered externally (e.g., platform cron every 5 minutes).
    It avoids overlapping runs and only syncs notes with changed hash metadata/content.
    """
    if not _env_bool("NOTION_AUTO_SYNC_ENABLED", False):
        return {
            "status": "disabled",
            "reason": "notion_auto_sync_disabled",
            "message": "Set NOTION_AUTO_SYNC_ENABLED=true to enable scheduled Notion sync.",
        }

    if not os.getenv("NOTION_INTEGRATION_TOKEN", "").strip() or not os.getenv("NOTION_NOTES_DATABASE_ID", "").strip():
        return {
            "status": "skipped",
            "reason": "not_configured",
            "message": "NOTION_INTEGRATION_TOKEN and NOTION_NOTES_DATABASE_ID must be configured.",
        }

    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        stale_minutes = max(int(os.getenv("NOTION_AUTO_SYNC_STALE_JOB_MINUTES", "30")), 1)
        now = datetime.now(timezone.utc)

        running_job = (
            db.query(NotionSyncJob)
            .filter(
                NotionSyncJob.status == "running",
                NotionSyncJob.job_type.in_(["incremental", "full"]),
            )
            .order_by(NotionSyncJob.started_at.desc())
            .first()
        )

        if running_job and running_job.started_at:
            started_at = running_job.started_at
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)

            age_minutes = (now - started_at).total_seconds() / 60.0
            if age_minutes < stale_minutes:
                return {
                    "status": "skipped",
                    "reason": "job_already_running",
                    "running_job_id": str(running_job.id),
                    "running_job_type": running_job.job_type,
                    "running_job_started_at": started_at.isoformat(),
                    "running_job_age_minutes": round(age_minutes, 2),
                }

            running_job.status = "failed"
            running_job.completed_at = now
            running_job.error_message = (
                f"Marked stale by scheduled Notion sync after {round(age_minutes, 2)} minutes."
            )
            db.commit()
            logger.warning("Marked stale running Notion job as failed: %s", running_job.id)

        sync_result = incremental_sync(db=db)
        return {
            "status": "completed" if sync_result.get("status") == "completed" else "failed",
            "sync": sync_result,
        }
    finally:
        if own_session:
            db.close()


def get_sync_status(db: Optional[Session] = None) -> dict:
    """Return current sync status including latest job and schema metadata."""
    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        total_notes = db.query(Note).count()
        synced_notes = db.query(NotionSyncMap).filter(NotionSyncMap.entity_type == "note").count()

        latest_job = db.query(NotionSyncJob).order_by(NotionSyncJob.started_at.desc()).first()
        latest_schema_job = (
            db.query(NotionSyncJob)
            .filter(NotionSyncJob.job_type == "schema_update")
            .order_by(NotionSyncJob.started_at.desc())
            .first()
        )

        latest = None
        if latest_job:
            latest = {
                "job_id": str(latest_job.id),
                "job_type": latest_job.job_type,
                "status": latest_job.status,
                "started_at": latest_job.started_at.isoformat() if latest_job.started_at else None,
                "completed_at": latest_job.completed_at.isoformat() if latest_job.completed_at else None,
                "pages_created": latest_job.pages_created,
                "pages_updated": latest_job.pages_updated,
                "pages_skipped": latest_job.pages_skipped,
                "error_message": latest_job.error_message,
            }

        database_id = os.getenv("NOTION_NOTES_DATABASE_ID", "").strip() or None
        database_url = None
        property_count = None
        database_error = None

        if database_id:
            try:
                notion = _get_notion_client()
                target = _resolve_sync_target(notion, database_id)
                database_url = target.get("database_url")
                property_count = len(target.get("properties", {}) or {})
            except Exception as exc:
                database_error = str(exc)[:500]

        return {
            "total_notes": total_notes,
            "synced_notes": synced_notes,
            "unsynced_notes": max(total_notes - synced_notes, 0),
            "latest_job": latest,
            "database_id": database_id,
            "database_url": database_url,
            "property_count": property_count,
            "schema_updated_at": latest_schema_job.completed_at.isoformat()
            if latest_schema_job and latest_schema_job.completed_at
            else None,
            "database_error": database_error,
        }
    finally:
        if own_session:
            db.close()
