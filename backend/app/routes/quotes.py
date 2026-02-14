from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.quote import Quote
from app.models.thinker import Thinker
from app.schemas import quote as schemas

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


def validate_thinker_exists(db: Session, thinker_id: UUID):
    """Validate that the thinker exists in the database."""
    thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()
    if not thinker:
        raise HTTPException(status_code=404, detail=f"Thinker with id {thinker_id} not found")


@router.post("/", response_model=schemas.Quote, status_code=201)
def create_quote(quote: schemas.QuoteCreate, db: Session = Depends(get_db)):
    # Validate thinker exists
    validate_thinker_exists(db, quote.thinker_id)

    db_quote = Quote(**quote.model_dump())
    db.add(db_quote)
    db.commit()
    db.refresh(db_quote)
    return db_quote

@router.get("/", response_model=List[schemas.Quote])
def get_quotes(
    thinker_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Quote)
    if thinker_id:
        query = query.filter(Quote.thinker_id == thinker_id)
    quotes = query.order_by(Quote.created_at.desc()).offset(skip).limit(limit).all()
    return quotes

@router.get("/{quote_id}", response_model=schemas.Quote)
def get_quote(quote_id: UUID, db: Session = Depends(get_db)):
    db_quote = db.query(Quote).filter(Quote.id == quote_id).first()

    if db_quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    return db_quote

@router.put("/{quote_id}", response_model=schemas.Quote)
def update_quote(quote_id: UUID, quote_update: schemas.QuoteUpdate, db: Session = Depends(get_db)):
    db_quote = db.query(Quote).filter(Quote.id == quote_id).first()

    if db_quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    update_data = quote_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_quote, field, value)

    db.commit()
    db.refresh(db_quote)
    return db_quote

@router.delete("/{quote_id}", status_code=204)
def delete_quote(quote_id: UUID, db: Session = Depends(get_db)):
    db_quote = db.query(Quote).filter(Quote.id == quote_id).first()

    if db_quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    db.delete(db_quote)
    db.commit()
    return None
