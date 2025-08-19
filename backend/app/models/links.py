import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .user import User
    from .trip import Trip


class TripParticipant(SQLModel, table=True):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id", primary_key=True)
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class TripRating(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    rating: int
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: "User" = Relationship(back_populates="trip_ratings")
    trip: "Trip" = Relationship(back_populates="ratings")
