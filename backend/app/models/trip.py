import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List

from sqlmodel import JSON, Column, Field, Relationship, SQLModel

from .links import TripParticipant, TripRating

if TYPE_CHECKING:
    from .provider import Provider
    from .user import User
    from .trip_field import TripRequiredField
    from .trip_package import TripPackage




class Trip(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    description: str
    start_date: datetime
    end_date: datetime
    price: float
    max_participants: int
    is_active: bool = Field(default=True)

    # Using JSONB for flexible metadata like itinerary, inclusions, exclusions
    trip_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSON))

    provider_id: uuid.UUID = Field(foreign_key="provider.id")
    provider: "Provider" = Relationship(back_populates="trips")

    participants: List["User"] = Relationship(back_populates="trips", link_model=TripParticipant, sa_relationship_kwargs={"cascade": "all, delete"})
    ratings: List[TripRating] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    required_fields: List["TripRequiredField"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    packages: List["TripPackage"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
