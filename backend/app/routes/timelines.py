from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import math
import random

from app.database import get_db
from app.models.timeline import Timeline
from app.models.thinker import Thinker
from app.models.connection import Connection
from app.schemas import timeline as schemas
from app.schemas import thinker as thinker_schemas
from pydantic import BaseModel


class RepopulateConfig(BaseModel):
    """Configuration for the repopulate algorithm"""
    # Force-directed layout parameters
    repulsion_strength: float = 5000.0  # How strongly nodes repel each other
    attraction_strength: float = 0.1    # How strongly connected nodes attract
    center_gravity: float = 0.01        # Pull toward center (y=0)
    field_attraction: float = 0.05      # How strongly same-field thinkers attract
    damping: float = 0.9                # Velocity damping per iteration
    max_iterations: int = 100           # Maximum simulation iterations
    convergence_threshold: float = 0.5  # Stop when max velocity below this
    min_node_distance: float = 80       # Minimum distance between nodes
    vertical_spread: float = 200        # Max Y distance from center


class RepopulateResponse(BaseModel):
    """Response from repopulate endpoint"""
    updated_count: int
    positions: List[dict]

router = APIRouter(prefix="/api/timelines", tags=["timelines"])

@router.post("/", response_model=schemas.Timeline, status_code=201)
def create_timeline(timeline: schemas.TimelineCreate, db: Session = Depends(get_db)):
    db_timeline = Timeline(**timeline.model_dump())
    db.add(db_timeline)
    db.commit()
    db.refresh(db_timeline)
    return db_timeline

@router.get("/", response_model=List[schemas.Timeline])
def get_timelines(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    timelines = db.query(Timeline).offset(skip).limit(limit).all()
    return timelines

@router.get("/{timeline_id}", response_model=schemas.Timeline)
def get_timeline(timeline_id: UUID, db: Session = Depends(get_db)):
    timeline = db.query(Timeline).filter(Timeline.id == timeline_id).first()

    if timeline is None:
        raise HTTPException(status_code=404, detail="Timeline not found")
    return timeline

@router.put("/{timeline_id}", response_model=schemas.Timeline)
def update_timeline(timeline_id: UUID, timeline_update: schemas.TimelineUpdate, db: Session = Depends(get_db)):
    db_timeline = db.query(Timeline).filter(Timeline.id == timeline_id).first()

    if db_timeline is None:
        raise HTTPException(status_code=404, detail="Timeline not found")

    update_data = timeline_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_timeline, field, value)

    db.commit()
    db.refresh(db_timeline)
    return db_timeline

@router.delete("/{timeline_id}", status_code=204)
def delete_timeline(timeline_id: UUID, db: Session = Depends(get_db)):
    db_timeline = db.query(Timeline).filter(Timeline.id == timeline_id).first()

    if db_timeline is None:
        raise HTTPException(status_code=404, detail="Timeline not found")

    db.delete(db_timeline)
    db.commit()
    return None


def calculate_anchor_year(thinker: Thinker) -> Optional[int]:
    """Calculate the x-position (year) for a thinker on the timeline"""
    if thinker.anchor_year is not None:
        return thinker.anchor_year
    if thinker.birth_year is not None and thinker.death_year is not None:
        return (thinker.birth_year + thinker.death_year) // 2
    if thinker.birth_year is not None:
        return thinker.birth_year + 40  # Assume active around age 40
    if thinker.death_year is not None:
        return thinker.death_year - 20  # Assume active 20 years before death
    return None


def run_force_simulation(
    thinkers: List[Thinker],
    connections: List[Connection],
    config: RepopulateConfig,
    fixed_ids: set = None,
    anchor_years: dict = None
) -> dict:
    """
    Run force-directed layout simulation to calculate optimal Y positions.

    Algorithm:
    1. Initialize Y positions (spread out or use existing)
    2. For each iteration:
       - Calculate repulsion forces between all node pairs (considering X distance)
       - Calculate attraction forces between connected nodes
       - Calculate attraction forces between same-field nodes
       - Apply gravity toward center (y=0)
       - Update velocities with damping
       - Update positions (except for fixed_ids which keep their positions)
    3. Return final positions

    Args:
        fixed_ids: Set of thinker IDs that should not have their positions changed
        anchor_years: Dict mapping thinker ID to anchor year (X position) for distance calculation
    """
    if len(thinkers) == 0:
        return {}

    if fixed_ids is None:
        fixed_ids = set()

    if anchor_years is None:
        anchor_years = {}

    # Initialize positions and velocities
    positions = {}  # thinker_id -> y_position
    velocities = {}  # thinker_id -> velocity
    x_positions = {}  # thinker_id -> x_position (year) for distance calculation

    # Build lookup for thinker fields and existing positions
    thinker_map = {str(t.id): t for t in thinkers}

    # Calculate year range for normalizing X distances
    all_years = []
    for thinker in thinkers:
        tid = str(thinker.id)
        year = anchor_years.get(tid) or calculate_anchor_year(thinker)
        if year is not None:
            all_years.append(year)
            x_positions[tid] = year
        else:
            x_positions[tid] = 0  # Default if no year available

    year_span = max(all_years) - min(all_years) if len(all_years) > 1 else 100
    # Convert year span to a normalized scale (100 years = ~200 pixels of separation)
    year_to_pixels = 200.0 / max(100, year_span)

    # Initialize positions - use existing or distribute evenly
    for i, thinker in enumerate(thinkers):
        tid = str(thinker.id)
        if thinker.position_y is not None:
            positions[tid] = thinker.position_y
        else:
            # Distribute evenly in vertical space
            n = len(thinkers)
            y_range = config.vertical_spread * 2
            positions[tid] = -config.vertical_spread + (i / max(1, n - 1)) * y_range if n > 1 else 0
        velocities[tid] = 0.0

    # Build connection lookup for faster access
    connection_pairs = set()
    connection_strengths = {}
    for conn in connections:
        from_id = str(conn.from_thinker_id)
        to_id = str(conn.to_thinker_id)
        if from_id in thinker_map and to_id in thinker_map:
            pair = tuple(sorted([from_id, to_id]))
            connection_pairs.add(pair)
            # Connection strength (1-5, default 3)
            strength = conn.strength if conn.strength else 3
            connection_strengths[pair] = strength

    # Group thinkers by field for field-based attraction
    field_groups = {}
    for thinker in thinkers:
        if thinker.field:
            if thinker.field not in field_groups:
                field_groups[thinker.field] = []
            field_groups[thinker.field].append(str(thinker.id))

    thinker_ids = list(positions.keys())

    # Run simulation
    for iteration in range(config.max_iterations):
        forces = {tid: 0.0 for tid in thinker_ids}

        # 1. Repulsion force between all pairs (considering 2D distance)
        for i, id1 in enumerate(thinker_ids):
            for id2 in thinker_ids[i+1:]:
                y1, y2 = positions[id1], positions[id2]
                x1, x2 = x_positions.get(id1, 0), x_positions.get(id2, 0)

                dy = y2 - y1
                # Convert year difference to pixel-like distance for calculation
                dx = (x2 - x1) * year_to_pixels

                # Use 2D distance for repulsion - thinkers far apart in time don't need much vertical separation
                distance_2d = math.sqrt(dx * dx + dy * dy) + 0.1  # Avoid division by zero
                distance_y = abs(dy) + 0.1

                # Repulsion is based on 2D distance but only affects Y position
                # Thinkers close in time (small dx) repel more
                # Thinkers far apart in time (large dx) repel less
                if distance_2d < config.min_node_distance:
                    # Very close - strong repulsion
                    force = config.repulsion_strength / (distance_y * distance_y)
                else:
                    # Normal repulsion scaled by 2D distance
                    # The further apart in X, the less vertical repulsion needed
                    force = config.repulsion_strength / (distance_2d * distance_2d)

                if dy > 0:
                    forces[id1] -= force
                    forces[id2] += force
                else:
                    forces[id1] += force
                    forces[id2] -= force

        # 2. Attraction force between connected thinkers
        for pair in connection_pairs:
            id1, id2 = pair
            y1, y2 = positions[id1], positions[id2]
            dy = y2 - y1

            # Spring force proportional to distance, weighted by connection strength
            strength = connection_strengths.get(pair, 3)
            force = dy * config.attraction_strength * (strength / 3.0)

            forces[id1] += force
            forces[id2] -= force

        # 3. Attraction between same-field thinkers
        for field, members in field_groups.items():
            if len(members) > 1:
                # Calculate centroid
                centroid = sum(positions[m] for m in members) / len(members)
                for mid in members:
                    dy = centroid - positions[mid]
                    forces[mid] += dy * config.field_attraction

        # 4. Gravity toward center (y=0)
        for tid in thinker_ids:
            forces[tid] -= positions[tid] * config.center_gravity

        # 5. Update velocities and positions (skip fixed thinkers)
        max_velocity = 0.0
        for tid in thinker_ids:
            # Skip fixed thinkers - they keep their original positions
            if tid in fixed_ids:
                continue

            velocities[tid] = (velocities[tid] + forces[tid]) * config.damping
            positions[tid] += velocities[tid]

            # Clamp to vertical bounds
            positions[tid] = max(-config.vertical_spread, min(config.vertical_spread, positions[tid]))

            max_velocity = max(max_velocity, abs(velocities[tid]))

        # Check for convergence
        if max_velocity < config.convergence_threshold:
            break

    return positions


@router.post("/{timeline_id}/repopulate", response_model=RepopulateResponse)
def repopulate_timeline(
    timeline_id: UUID,
    config: Optional[RepopulateConfig] = None,
    db: Session = Depends(get_db)
):
    """
    Recalculate optimal positions for all thinkers on a timeline.

    Uses a force-directed layout algorithm to:
    - Spread thinkers to avoid overlapping
    - Pull connected thinkers closer together
    - Group thinkers in the same field
    - Keep thinkers near the timeline center

    X-axis position (anchor_year) is calculated based on:
    - Existing anchor_year if set
    - Midpoint of birth_year and death_year
    - Birth year + 40 if only birth known
    - Death year - 20 if only death known

    Y-axis position is optimized by the force simulation.
    """
    # Verify timeline exists
    timeline = db.query(Timeline).filter(Timeline.id == timeline_id).first()
    if not timeline:
        raise HTTPException(status_code=404, detail="Timeline not found")

    # Use default config if none provided
    if config is None:
        config = RepopulateConfig()

    # Get all thinkers on this timeline
    thinkers = db.query(Thinker).filter(Thinker.timeline_id == timeline_id).all()

    if len(thinkers) == 0:
        return RepopulateResponse(updated_count=0, positions=[])

    # Get all connections between thinkers on this timeline
    thinker_ids = [t.id for t in thinkers]
    connections = db.query(Connection).filter(
        Connection.from_thinker_id.in_(thinker_ids),
        Connection.to_thinker_id.in_(thinker_ids)
    ).all()

    # Identify manually positioned thinkers (they keep their positions)
    manually_positioned_ids = {str(t.id) for t in thinkers if t.is_manually_positioned}

    # Calculate anchor years only for non-manually positioned thinkers
    anchor_years = {}
    for thinker in thinkers:
        tid = str(thinker.id)
        if tid not in manually_positioned_ids:
            anchor_year = calculate_anchor_year(thinker)
            if anchor_year is not None:
                anchor_years[tid] = anchor_year

    # Build complete anchor_years dict including existing ones for manually positioned
    all_anchor_years = dict(anchor_years)
    for thinker in thinkers:
        tid = str(thinker.id)
        if tid not in all_anchor_years:
            year = calculate_anchor_year(thinker)
            if year is not None:
                all_anchor_years[tid] = year

    # Run force simulation to get optimal Y positions (fixed thinkers keep their positions)
    y_positions = run_force_simulation(
        thinkers, connections, config,
        fixed_ids=manually_positioned_ids,
        anchor_years=all_anchor_years
    )

    # Update thinker positions in database
    updated_positions = []
    for thinker in thinkers:
        tid = str(thinker.id)

        # Only update anchor_year for non-manually positioned thinkers
        if tid in anchor_years:
            thinker.anchor_year = anchor_years[tid]

        # Only update Y position for non-manually positioned thinkers
        if tid in y_positions and tid not in manually_positioned_ids:
            thinker.position_y = y_positions[tid]

        updated_positions.append({
            "id": tid,
            "name": thinker.name,
            "anchor_year": thinker.anchor_year,
            "position_y": thinker.position_y,
            "is_manually_positioned": thinker.is_manually_positioned
        })

    db.commit()

    return RepopulateResponse(
        updated_count=len(thinkers),
        positions=updated_positions
    )


@router.post("/repopulate-all", response_model=RepopulateResponse)
def repopulate_all_thinkers(
    config: Optional[RepopulateConfig] = None,
    db: Session = Depends(get_db)
):
    """
    Recalculate optimal positions for ALL thinkers across all timelines.

    Uses a force-directed layout algorithm to:
    - Spread thinkers to avoid overlapping
    - Pull connected thinkers closer together
    - Group thinkers in the same field
    - Keep thinkers near the timeline center (y=0)

    X-axis position (anchor_year) is calculated based on:
    - Existing anchor_year if set
    - Midpoint of birth_year and death_year
    - Birth year + 40 if only birth known
    - Death year - 20 if only death known

    Y-axis position is optimized by the force simulation.
    """
    # Use default config if none provided
    if config is None:
        config = RepopulateConfig()

    # Get ALL thinkers
    thinkers = db.query(Thinker).all()

    if len(thinkers) == 0:
        return RepopulateResponse(updated_count=0, positions=[])

    # Get ALL connections
    connections = db.query(Connection).all()

    # Identify manually positioned thinkers (they keep their positions)
    manually_positioned_ids = {str(t.id) for t in thinkers if t.is_manually_positioned}

    # Calculate anchor years only for non-manually positioned thinkers
    anchor_years = {}
    for thinker in thinkers:
        tid = str(thinker.id)
        if tid not in manually_positioned_ids:
            anchor_year = calculate_anchor_year(thinker)
            if anchor_year is not None:
                anchor_years[tid] = anchor_year

    # Build complete anchor_years dict including existing ones for manually positioned
    all_anchor_years = dict(anchor_years)
    for thinker in thinkers:
        tid = str(thinker.id)
        if tid not in all_anchor_years:
            year = calculate_anchor_year(thinker)
            if year is not None:
                all_anchor_years[tid] = year

    # Run force simulation to get optimal Y positions (fixed thinkers keep their positions)
    y_positions = run_force_simulation(
        thinkers, connections, config,
        fixed_ids=manually_positioned_ids,
        anchor_years=all_anchor_years
    )

    # Update thinker positions in database
    updated_positions = []
    for thinker in thinkers:
        tid = str(thinker.id)

        # Only update anchor_year for non-manually positioned thinkers
        if tid in anchor_years:
            thinker.anchor_year = anchor_years[tid]

        # Only update Y position for non-manually positioned thinkers
        if tid in y_positions and tid not in manually_positioned_ids:
            thinker.position_y = y_positions[tid]

        updated_positions.append({
            "id": tid,
            "name": thinker.name,
            "anchor_year": thinker.anchor_year,
            "position_y": thinker.position_y,
            "is_manually_positioned": thinker.is_manually_positioned
        })

    db.commit()

    return RepopulateResponse(
        updated_count=len(thinkers),
        positions=updated_positions
    )
