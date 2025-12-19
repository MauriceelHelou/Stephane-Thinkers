from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.institution import Institution, ThinkerInstitution
from app.models.thinker import Thinker
from app.schemas import institution as schemas

router = APIRouter(prefix="/api/institutions", tags=["institutions"])


def validate_thinker_exists(db: Session, thinker_id: UUID):
    """Validate that the thinker exists in the database."""
    thinker = db.query(Thinker).filter(Thinker.id == thinker_id).first()
    if not thinker:
        raise HTTPException(status_code=404, detail=f"Thinker with id {thinker_id} not found")


def validate_institution_exists(db: Session, institution_id: UUID):
    """Validate that the institution exists in the database."""
    institution = db.query(Institution).filter(Institution.id == institution_id).first()
    if not institution:
        raise HTTPException(status_code=404, detail=f"Institution with id {institution_id} not found")


# ThinkerInstitution (affiliation) endpoints - MUST come before dynamic routes

@router.post("/affiliations", response_model=schemas.ThinkerInstitution, status_code=201)
def create_affiliation(
    affiliation: schemas.ThinkerInstitutionCreate,
    db: Session = Depends(get_db)
):
    # Validate thinker and institution exist
    validate_thinker_exists(db, affiliation.thinker_id)
    validate_institution_exists(db, affiliation.institution_id)

    # Validate phd_advisor if provided
    if affiliation.phd_advisor_id:
        validate_thinker_exists(db, affiliation.phd_advisor_id)

    db_affiliation = ThinkerInstitution(**affiliation.model_dump())
    db.add(db_affiliation)
    db.commit()
    db.refresh(db_affiliation)
    return db_affiliation


@router.get("/affiliations", response_model=List[schemas.ThinkerInstitutionWithRelations])
def get_affiliations(
    thinker_id: Optional[UUID] = None,
    institution_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ThinkerInstitution).options(joinedload(ThinkerInstitution.institution))

    if thinker_id:
        query = query.filter(ThinkerInstitution.thinker_id == thinker_id)
    if institution_id:
        query = query.filter(ThinkerInstitution.institution_id == institution_id)

    affiliations = query.offset(skip).limit(limit).all()
    return affiliations


@router.get("/affiliations/{affiliation_id}", response_model=schemas.ThinkerInstitutionWithRelations)
def get_affiliation(affiliation_id: UUID, db: Session = Depends(get_db)):
    db_affiliation = db.query(ThinkerInstitution).options(
        joinedload(ThinkerInstitution.institution)
    ).filter(ThinkerInstitution.id == affiliation_id).first()

    if db_affiliation is None:
        raise HTTPException(status_code=404, detail="Affiliation not found")

    return db_affiliation


@router.put("/affiliations/{affiliation_id}", response_model=schemas.ThinkerInstitution)
def update_affiliation(
    affiliation_id: UUID,
    affiliation_update: schemas.ThinkerInstitutionUpdate,
    db: Session = Depends(get_db)
):
    db_affiliation = db.query(ThinkerInstitution).filter(ThinkerInstitution.id == affiliation_id).first()

    if db_affiliation is None:
        raise HTTPException(status_code=404, detail="Affiliation not found")

    update_data = affiliation_update.model_dump(exclude_unset=True)

    # Validate phd_advisor if being updated
    if 'phd_advisor_id' in update_data and update_data['phd_advisor_id']:
        validate_thinker_exists(db, update_data['phd_advisor_id'])

    for field, value in update_data.items():
        setattr(db_affiliation, field, value)

    db.commit()
    db.refresh(db_affiliation)
    return db_affiliation


@router.delete("/affiliations/{affiliation_id}", status_code=204)
def delete_affiliation(affiliation_id: UUID, db: Session = Depends(get_db)):
    db_affiliation = db.query(ThinkerInstitution).filter(ThinkerInstitution.id == affiliation_id).first()

    if db_affiliation is None:
        raise HTTPException(status_code=404, detail="Affiliation not found")

    db.delete(db_affiliation)
    db.commit()
    return None


@router.get("/academic-lineage/{thinker_id}", response_model=List[schemas.ThinkerInstitutionWithRelations])
def get_academic_lineage(thinker_id: UUID, db: Session = Depends(get_db)):
    """Get PhD advisor chain for a thinker (academic genealogy)."""
    validate_thinker_exists(db, thinker_id)

    lineage = []
    current_thinker_id = thinker_id
    visited = set()

    while current_thinker_id and current_thinker_id not in visited:
        visited.add(current_thinker_id)

        # Find PhD affiliation for current thinker
        phd_affiliation = db.query(ThinkerInstitution).options(
            joinedload(ThinkerInstitution.institution)
        ).filter(
            ThinkerInstitution.thinker_id == current_thinker_id,
            ThinkerInstitution.is_phd_institution == 1
        ).first()

        if phd_affiliation:
            lineage.append(phd_affiliation)
            current_thinker_id = phd_affiliation.phd_advisor_id
        else:
            break

    return lineage


# Institution CRUD endpoints

@router.post("/", response_model=schemas.Institution, status_code=201)
def create_institution(institution: schemas.InstitutionCreate, db: Session = Depends(get_db)):
    # Check for duplicate name
    existing = db.query(Institution).filter(Institution.name == institution.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Institution with name '{institution.name}' already exists")

    db_institution = Institution(**institution.model_dump())
    db.add(db_institution)
    db.commit()
    db.refresh(db_institution)
    return db_institution


@router.get("/", response_model=List[schemas.Institution])
def get_institutions(
    country: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Institution)
    if country:
        query = query.filter(Institution.country == country)
    institutions = query.offset(skip).limit(limit).all()
    return institutions


@router.get("/{institution_id}", response_model=schemas.InstitutionWithAffiliations)
def get_institution(institution_id: UUID, db: Session = Depends(get_db)):
    db_institution = db.query(Institution).options(
        joinedload(Institution.thinker_affiliations)
    ).filter(Institution.id == institution_id).first()

    if db_institution is None:
        raise HTTPException(status_code=404, detail="Institution not found")

    return db_institution


@router.put("/{institution_id}", response_model=schemas.Institution)
def update_institution(
    institution_id: UUID,
    institution_update: schemas.InstitutionUpdate,
    db: Session = Depends(get_db)
):
    db_institution = db.query(Institution).filter(Institution.id == institution_id).first()

    if db_institution is None:
        raise HTTPException(status_code=404, detail="Institution not found")

    update_data = institution_update.model_dump(exclude_unset=True)

    # Check for duplicate name if name is being updated
    if 'name' in update_data and update_data['name'] != db_institution.name:
        existing = db.query(Institution).filter(Institution.name == update_data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Institution with name '{update_data['name']}' already exists")

    for field, value in update_data.items():
        setattr(db_institution, field, value)

    db.commit()
    db.refresh(db_institution)
    return db_institution


@router.delete("/{institution_id}", status_code=204)
def delete_institution(institution_id: UUID, db: Session = Depends(get_db)):
    db_institution = db.query(Institution).filter(Institution.id == institution_id).first()

    if db_institution is None:
        raise HTTPException(status_code=404, detail="Institution not found")

    db.delete(db_institution)
    db.commit()
    return None
