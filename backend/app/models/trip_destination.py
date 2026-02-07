"""
TripDestination model for many-to-many relationship between trips and destinations.
"""

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .trip import Trip
    from .destination import Destination
    from .place import Place


class TripDestination(SQLModel, table=True):
    """Many-to-many relationship between trips and destinations"""
    __tablename__ = "trip_destinations"
    __table_args__ = (
        UniqueConstraint("trip_id", "destination_id", name="unique_trip_destination"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id", index=True)
    destination_id: uuid.UUID = Field(foreign_key="destinations.id", index=True)

    # Optional: Link to specific place within destination
    place_id: Optional[uuid.UUID] = Field(default=None, foreign_key="places.id")

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    trip: "Trip" = Relationship(back_populates="trip_destinations")
    destination: "Destination" = Relationship(back_populates="trip_destinations")
    place: Optional["Place"] = Relationship()
