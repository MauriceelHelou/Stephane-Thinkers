"""
Tests for Notion sync logic with a mocked Notion client.
"""
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from app.models.notion_sync import NotionSyncMap
from app.services import notion_sync


class _FakeBlocksChildren:
    def __init__(self, state):
        self._state = state

    def list(self, block_id: str, start_cursor=None):
        self._state["list_calls"] += 1
        return {"results": [{"id": "block-1"}], "has_more": False, "next_cursor": None}

    def append(self, block_id: str, children: list):
        self._state["append_calls"] += 1
        return {"object": "list"}


class _FakeBlocks:
    def __init__(self, state):
        self._state = state
        self.children = _FakeBlocksChildren(state)

    def delete(self, block_id: str):
        self._state["delete_calls"] += 1
        return {"object": "block", "id": block_id}


class _FakePages:
    def __init__(self, state):
        self._state = state

    def update(self, page_id: str, properties: dict):
        self._state["page_update_calls"] += 1
        return {"object": "page", "id": page_id}

    def create(self, parent: dict, properties: dict, children: list | None = None):
        self._state["page_create_calls"] += 1
        return {"object": "page", "id": "new-page-id"}


class _FakeNotion:
    def __init__(self):
        self.state = {
            "page_update_calls": 0,
            "page_create_calls": 0,
            "list_calls": 0,
            "append_calls": 0,
            "delete_calls": 0,
        }
        self.pages = _FakePages(self.state)
        self.blocks = _FakeBlocks(self.state)


class _FakeDatabases:
    def __init__(self):
        self.update_calls = 0
        self.update_payload = None

    def retrieve(self, database_id: str):
        return {
            "id": database_id,
            "url": "https://notion.so/fake-db",
            "properties": {
                "Title": {"type": "title", "title": {}},
                "Note Type": {
                    "type": "select",
                    "select": {"options": [{"name": "general"}, {"name": "research"}]},
                },
                "Color": {
                    "type": "select",
                    "select": {"options": [{"name": "yellow"}]},
                },
            },
        }

    def update(self, database_id: str, properties: dict):
        self.update_calls += 1
        self.update_payload = properties
        return self.retrieve(database_id)


class _FakeSchemaNotion:
    def __init__(self):
        self.databases = _FakeDatabases()


def test_note_to_notion_children_parses_markdown_blocks_and_inline():
    note = SimpleNamespace(
        content=(
            "# Heading One\n"
            "## Heading Two\n"
            "### Heading Three\n"
            "- Bullet with **bold** and *italic*\n"
            "1. Numbered item\n"
            "---\n"
            "Paragraph with [[Meister Eckhart]]\n"
            "*alpha* *beta*\n"
        )
    )

    blocks = notion_sync._note_to_notion_children(note)
    block_types = [block["type"] for block in blocks]

    assert block_types == [
        "heading_1",
        "heading_2",
        "heading_3",
        "bulleted_list_item",
        "numbered_list_item",
        "divider",
        "paragraph",
        "paragraph",
    ]

    paragraph_rich_text = blocks[6]["paragraph"]["rich_text"]
    wiki_segment = next(
        segment
        for segment in paragraph_rich_text
        if segment["text"]["content"] == "Meister Eckhart"
    )
    assert wiki_segment["annotations"]["bold"] is True

    italic_spacing = "".join(
        segment["text"]["content"]
        for segment in blocks[7]["paragraph"]["rich_text"]
    )
    assert italic_spacing == "alpha beta"


def test_note_to_notion_properties_maps_folder_thinker_tags_and_mentions():
    root_folder_id = uuid.uuid4()
    child_folder_id = uuid.uuid4()

    root_folder = SimpleNamespace(
        id=root_folder_id,
        name="Philosophy",
        parent_id=None,
        parent=None,
    )
    child_folder = SimpleNamespace(
        id=child_folder_id,
        name="Kant",
        parent_id=root_folder_id,
        parent=None,
    )

    note = SimpleNamespace(
        id=uuid.uuid4(),
        title="Categorical Imperative Memo",
        content="Test",
        note_type="research",
        color="blue",
        folder=child_folder,
        thinker=SimpleNamespace(name="Immanuel Kant"),
        tags=[SimpleNamespace(name="ethics"), SimpleNamespace(name="duty")],
        mentioned_thinkers=[SimpleNamespace(name="Aristotle")],
        created_at=datetime(2026, 2, 15, tzinfo=timezone.utc),
        updated_at=datetime(2026, 2, 15, tzinfo=timezone.utc),
    )

    props = notion_sync._note_to_notion_properties(
        note,
        folder_lookup={
            str(root_folder_id): root_folder,
            str(child_folder_id): child_folder,
        },
    )

    assert props["Note Type"]["select"]["name"] == "research"
    assert props["Color"]["select"]["name"] == "blue"
    assert props["Folder"]["select"]["name"] == "Kant"
    assert props["Folder Path"]["rich_text"][0]["text"]["content"] == "Philosophy / Kant"
    assert props["Thinker"]["select"]["name"] == "Immanuel Kant"
    assert props["Tags"]["multi_select"] == [{"name": "duty"}, {"name": "ethics"}]
    assert props["Mentioned Thinkers"]["multi_select"] == [{"name": "Aristotle"}]


def test_content_hash_changes_when_metadata_changes_without_content_change():
    folder = SimpleNamespace(id=uuid.uuid4(), name="Folder", parent_id=None, parent=None)
    thinker = SimpleNamespace(name="Thinker A")

    base_note = SimpleNamespace(
        id=uuid.uuid4(),
        title="Same",
        content="Same content",
        updated_at=datetime(2026, 2, 15, tzinfo=timezone.utc),
        note_type="research",
        color="yellow",
        folder_id=folder.id,
        folder=folder,
        thinker_id=uuid.uuid4(),
        thinker=thinker,
        tags=[SimpleNamespace(name="tag-a")],
        mentioned_thinkers=[],
    )

    changed_tags_note = SimpleNamespace(
        **{
            **base_note.__dict__,
            "tags": [SimpleNamespace(name="tag-b")],
        }
    )

    hash_a = notion_sync._content_hash(base_note, folder_lookup={str(folder.id): folder})
    hash_b = notion_sync._content_hash(changed_tags_note, folder_lookup={str(folder.id): folder})
    assert hash_a != hash_b


def test_apply_database_schema_update_adds_missing_properties_and_select_options(monkeypatch):
    monkeypatch.setattr(notion_sync, "_rate_limit_sleep", lambda: None)
    fake_notion = _FakeSchemaNotion()
    result = notion_sync._apply_database_schema_update(fake_notion, "db-id")

    assert fake_notion.databases.update_calls == 1
    assert result["database_id"] == "db-id"
    assert "Folder" in result["added_properties"]
    assert result["added_select_options"]["Note Type"] == ["biography", "connection"]
    assert result["added_select_options"]["Color"] == ["pink", "blue", "green"]

    update_payload = fake_notion.databases.update_payload or {}
    assert "Folder" in update_payload
    assert update_payload["Note Type"]["select"]["options"] == [
        {"name": "biography"},
        {"name": "connection"},
    ]


def test_incremental_sync_updates_content(client, db, sample_note, monkeypatch):
    monkeypatch.setenv("NOTION_NOTES_DATABASE_ID", "db-id")
    monkeypatch.setattr(notion_sync, "_rate_limit_sleep", lambda: None)

    fake_notion = _FakeNotion()
    monkeypatch.setattr(notion_sync, "_get_notion_client", lambda: fake_notion)

    # Seed existing mapping with old hash to force update path
    sync_map = NotionSyncMap(
        local_id=sample_note["id"],
        entity_type="note",
        notion_page_id="existing-page-id",
        content_hash="old-hash",
    )
    db.add(sync_map)
    db.commit()

    result = notion_sync.incremental_sync(db=db)
    assert result["updated"] == 1
    assert fake_notion.state["page_update_calls"] == 1
    assert fake_notion.state["delete_calls"] >= 1
    assert fake_notion.state["append_calls"] >= 1
