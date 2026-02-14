from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.connection import Connection
from app.models.thinker import Thinker
from app.schemas import connection as schemas

router = APIRouter(prefix="/api/connections", tags=["connections"])


def validate_thinkers_exist(db: Session, from_thinker_id: UUID, to_thinker_id: UUID):
    """Validate that both thinkers exist in the database."""
    from_thinker = db.query(Thinker).filter(Thinker.id == from_thinker_id).first()
    if not from_thinker:
        raise HTTPException(status_code=404, detail=f"Source thinker with id {from_thinker_id} not found")

    to_thinker = db.query(Thinker).filter(Thinker.id == to_thinker_id).first()
    if not to_thinker:
        raise HTTPException(status_code=404, detail=f"Target thinker with id {to_thinker_id} not found")


def validate_no_self_loop(from_thinker_id: UUID, to_thinker_id: UUID):
    """Validate that a connection doesn't point to itself."""
    if from_thinker_id == to_thinker_id:
        raise HTTPException(status_code=400, detail="Cannot create a connection from a thinker to themselves")


def validate_no_duplicate(db: Session, from_thinker_id: UUID, to_thinker_id: UUID, exclude_id: UUID = None):
    """Validate that a duplicate connection doesn't already exist."""
    query = db.query(Connection).filter(
        and_(
            Connection.from_thinker_id == from_thinker_id,
            Connection.to_thinker_id == to_thinker_id
        )
    )
    if exclude_id:
        query = query.filter(Connection.id != exclude_id)

    existing = query.first()
    if existing:
        raise HTTPException(status_code=400, detail="A connection between these thinkers already exists")


@router.post("/", response_model=schemas.Connection, status_code=201)
def create_connection(connection: schemas.ConnectionCreate, db: Session = Depends(get_db)):
    # Validate self-loop
    validate_no_self_loop(connection.from_thinker_id, connection.to_thinker_id)

    # Validate thinkers exist
    validate_thinkers_exist(db, connection.from_thinker_id, connection.to_thinker_id)

    # Validate no duplicate connection
    validate_no_duplicate(db, connection.from_thinker_id, connection.to_thinker_id)

    db_connection = Connection(**connection.model_dump())
    db.add(db_connection)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A connection between these thinkers already exists")
    db.refresh(db_connection)
    return db_connection

@router.get("/", response_model=List[schemas.Connection])
def get_connections(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    connections = db.query(Connection).order_by(Connection.created_at.desc()).offset(skip).limit(limit).all()
    return connections

@router.get("/{connection_id}", response_model=schemas.Connection)
def get_connection(connection_id: UUID, db: Session = Depends(get_db)):
    connection = db.query(Connection).filter(Connection.id == connection_id).first()

    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return connection

@router.put("/{connection_id}", response_model=schemas.Connection)
def update_connection(connection_id: UUID, connection_update: schemas.ConnectionUpdate, db: Session = Depends(get_db)):
    db_connection = db.query(Connection).filter(Connection.id == connection_id).first()

    if db_connection is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    update_data = connection_update.model_dump(exclude_unset=True)

    # Get the final from/to thinker IDs after update
    from_id = update_data.get('from_thinker_id', db_connection.from_thinker_id)
    to_id = update_data.get('to_thinker_id', db_connection.to_thinker_id)

    # Validate self-loop if thinker IDs are being changed
    if 'from_thinker_id' in update_data or 'to_thinker_id' in update_data:
        validate_no_self_loop(from_id, to_id)
        validate_thinkers_exist(db, from_id, to_id)
        validate_no_duplicate(db, from_id, to_id, exclude_id=connection_id)

    for field, value in update_data.items():
        setattr(db_connection, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A connection between these thinkers already exists")
    db.refresh(db_connection)
    return db_connection

@router.delete("/{connection_id}", status_code=204)
def delete_connection(connection_id: UUID, db: Session = Depends(get_db)):
    db_connection = db.query(Connection).filter(Connection.id == connection_id).first()

    if db_connection is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    db.delete(db_connection)
    db.commit()
    return None
