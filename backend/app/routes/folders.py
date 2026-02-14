from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.folder import Folder
from app.models.note import Note
from app.schemas import folder as schemas

router = APIRouter(prefix="/api/folders", tags=["folders"])


def build_tree(folders: List[Folder], note_counts: dict[str, int]) -> List[dict]:
    folder_map: dict[str, dict] = {}
    for folder in folders:
        folder_id = str(folder.id)
        folder_map[folder_id] = {
            "id": folder.id,
            "name": folder.name,
            "parent_id": folder.parent_id,
            "sort_order": folder.sort_order or 0,
            "color": folder.color,
            "is_archived": folder.is_archived,
            "archived_at": folder.archived_at,
            "created_at": folder.created_at,
            "updated_at": folder.updated_at,
            "children": [],
            "note_count": note_counts.get(folder_id, 0),
        }

    roots: List[dict] = []
    for folder_id, node in folder_map.items():
        parent_key = str(node["parent_id"]) if node["parent_id"] else None
        if parent_key and parent_key in folder_map:
            folder_map[parent_key]["children"].append(node)
        else:
            roots.append(node)

    def sort_recursive(nodes: List[dict]):
        nodes.sort(key=lambda item: (item["sort_order"], item["name"].lower()))
        for node in nodes:
            sort_recursive(node["children"])

    sort_recursive(roots)
    return roots


def validate_no_circular_parent(db: Session, folder_id: UUID, new_parent_id: UUID) -> None:
    current_id = new_parent_id
    visited: set[UUID] = set()
    while current_id is not None:
        if current_id == folder_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot move folder into its own descendant (circular reference)",
            )
        if current_id in visited:
            break
        visited.add(current_id)

        parent = db.query(Folder).filter(Folder.id == current_id).first()
        if parent is None:
            break
        current_id = parent.parent_id


def get_all_descendant_ids(db: Session, folder_id: UUID) -> List[UUID]:
    """Recursively collect all descendant folder IDs."""
    result: List[UUID] = []
    queue = [folder_id]
    while queue:
        current = queue.pop()
        children = db.query(Folder.id).filter(Folder.parent_id == current).all()
        for (child_id,) in children:
            result.append(child_id)
            queue.append(child_id)
    return result


@router.post("/", response_model=schemas.Folder, status_code=201)
def create_folder(folder_data: schemas.FolderCreate, db: Session = Depends(get_db)):
    if folder_data.parent_id:
        parent = db.query(Folder).filter(Folder.id == folder_data.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=404,
                detail=f"Parent folder with id {folder_data.parent_id} not found",
            )
        if parent.is_archived:
            raise HTTPException(
                status_code=400,
                detail="Cannot create folder inside an archived folder",
            )

    db_folder = Folder(**folder_data.model_dump())
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder


@router.get("/", response_model=List[schemas.Folder])
def get_folders(
    parent_id: Optional[UUID] = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Folder)
    if parent_id is not None:
        query = query.filter(Folder.parent_id == parent_id)
    if not include_archived:
        query = query.filter(Folder.is_archived == False)  # noqa: E712
    return query.order_by(Folder.sort_order, Folder.name).all()


@router.get("/tree", response_model=List[schemas.FolderWithChildren])
def get_folder_tree(
    include_archived: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Folder)
    if not include_archived:
        query = query.filter(Folder.is_archived == False)  # noqa: E712
    all_folders = query.all()

    folder_ids = [f.id for f in all_folders]
    note_counts_raw = (
        db.query(Note.folder_id, func.count(Note.id))
        .filter(Note.folder_id.isnot(None))
        .filter(Note.folder_id.in_(folder_ids) if folder_ids else True)
        .group_by(Note.folder_id)
        .all()
    )
    note_counts = {str(folder_id): count for folder_id, count in note_counts_raw}

    return build_tree(all_folders, note_counts)


@router.put("/reorder", response_model=List[schemas.Folder])
def reorder_folders(reorder: schemas.ReorderRequest, db: Session = Depends(get_db)):
    updated: List[Folder] = []
    for item in reorder.items:
        db_folder = db.query(Folder).filter(Folder.id == item.id).first()
        if not db_folder:
            raise HTTPException(status_code=404, detail=f"Folder with id {item.id} not found")

        db_folder.sort_order = item.sort_order

        # `parent_id` is optional in reorder payloads; only mutate parent when explicitly provided.
        if "parent_id" in item.model_fields_set:
            if item.parent_id is not None:
                parent = db.query(Folder).filter(Folder.id == item.parent_id).first()
                if parent is None:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Parent folder with id {item.parent_id} not found",
                    )
                if parent.is_archived:
                    raise HTTPException(
                        status_code=400,
                        detail="Cannot move folder into an archived folder",
                    )
                validate_no_circular_parent(db, item.id, item.parent_id)

            # Supports explicit `null` to move folder to root.
            db_folder.parent_id = item.parent_id

        updated.append(db_folder)

    db.commit()
    for folder in updated:
        db.refresh(folder)
    return updated


@router.get("/{folder_id}", response_model=schemas.FolderWithChildren)
def get_folder(folder_id: UUID, db: Session = Depends(get_db)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    children = (
        db.query(Folder)
        .filter(Folder.parent_id == folder_id)
        .order_by(Folder.sort_order, Folder.name)
        .all()
    )

    folder_ids = [folder_id] + [child.id for child in children]
    note_counts_raw = (
        db.query(Note.folder_id, func.count(Note.id))
        .filter(Note.folder_id.in_(folder_ids))
        .group_by(Note.folder_id)
        .all()
    )
    note_counts = {str(fid): count for fid, count in note_counts_raw}

    return {
        "id": db_folder.id,
        "name": db_folder.name,
        "parent_id": db_folder.parent_id,
        "sort_order": db_folder.sort_order,
        "color": db_folder.color,
        "is_archived": db_folder.is_archived,
        "archived_at": db_folder.archived_at,
        "created_at": db_folder.created_at,
        "updated_at": db_folder.updated_at,
        "note_count": note_counts.get(str(folder_id), 0),
        "children": [
            {
                "id": child.id,
                "name": child.name,
                "parent_id": child.parent_id,
                "sort_order": child.sort_order,
                "color": child.color,
                "is_archived": child.is_archived,
                "archived_at": child.archived_at,
                "created_at": child.created_at,
                "updated_at": child.updated_at,
                "children": [],
                "note_count": note_counts.get(str(child.id), 0),
            }
            for child in children
        ],
    }


@router.put("/{folder_id}", response_model=schemas.Folder)
def update_folder(folder_id: UUID, folder_update: schemas.FolderUpdate, db: Session = Depends(get_db)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    update_data = folder_update.model_dump(exclude_unset=True)

    # Defense-in-depth: strip archive fields even though schema doesn't include them
    update_data.pop("is_archived", None)
    update_data.pop("archived_at", None)

    if "parent_id" in update_data and update_data["parent_id"] is not None:
        new_parent_id = update_data["parent_id"]
        parent = db.query(Folder).filter(Folder.id == new_parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=404,
                detail=f"Parent folder with id {new_parent_id} not found",
            )
        if parent.is_archived:
            raise HTTPException(
                status_code=400,
                detail="Cannot move folder into an archived folder",
            )
        validate_no_circular_parent(db, folder_id, new_parent_id)

    for field, value in update_data.items():
        setattr(db_folder, field, value)

    db.commit()
    db.refresh(db_folder)
    return db_folder


@router.post("/{folder_id}/archive", response_model=schemas.Folder)
def archive_folder(folder_id: UUID, db: Session = Depends(get_db)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    now = datetime.now(timezone.utc)

    # Archive the folder itself
    db_folder.is_archived = True
    db_folder.archived_at = now

    # Cascade: archive all descendants
    descendant_ids = get_all_descendant_ids(db, folder_id)
    if descendant_ids:
        db.query(Folder).filter(Folder.id.in_(descendant_ids)).update(
            {"is_archived": True, "archived_at": now},
            synchronize_session="fetch",
        )

    db.commit()
    db.refresh(db_folder)
    return db_folder


@router.post("/{folder_id}/unarchive", response_model=schemas.Folder)
def unarchive_folder(folder_id: UUID, db: Session = Depends(get_db)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Unarchive the folder itself
    db_folder.is_archived = False
    db_folder.archived_at = None

    # Auto-unarchive all ancestors so folder is visible in tree
    ancestor_ids: List[UUID] = []
    current_parent_id = db_folder.parent_id
    visited_ancestors: set[UUID] = set()
    while current_parent_id is not None:
        if current_parent_id in visited_ancestors:
            break
        visited_ancestors.add(current_parent_id)
        ancestor_ids.append(current_parent_id)
        ancestor = db.query(Folder).filter(Folder.id == current_parent_id).first()
        if not ancestor:
            break
        current_parent_id = ancestor.parent_id

    if ancestor_ids:
        db.query(Folder).filter(
            Folder.id.in_(ancestor_ids),
            Folder.is_archived == True,  # noqa: E712
        ).update(
            {"is_archived": False, "archived_at": None},
            synchronize_session="fetch",
        )

    db.commit()
    db.refresh(db_folder)
    return db_folder


@router.delete("/{folder_id}", status_code=204)
def delete_folder(
    folder_id: UUID,
    move_notes_to: Optional[UUID] = Query(
        None,
        description=(
            "Folder ID to reassign notes to before deletion. "
            "If omitted, notes become unfiled (folder_id=NULL)."
        ),
    ),
    db: Session = Depends(get_db),
):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    if move_notes_to is not None:
        destination = db.query(Folder).filter(Folder.id == move_notes_to).first()
        if not destination:
            raise HTTPException(
                status_code=404,
                detail=f"Destination folder with id {move_notes_to} not found",
            )

    db.query(Note).filter(Note.folder_id == folder_id).update(
        {"folder_id": move_notes_to}, synchronize_session="fetch"
    )

    db.query(Folder).filter(Folder.parent_id == folder_id).update(
        {"parent_id": db_folder.parent_id}, synchronize_session="fetch"
    )

    db.delete(db_folder)
    db.commit()
    return None
