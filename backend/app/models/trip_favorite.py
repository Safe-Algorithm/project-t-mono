import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .user import User
    from .trip import Trip


class TripFavorite(SQLModel, table=True):
    """Model for user's favorite trips"""
    __tablename__ = "trip_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "trip_id", name="unique_user_trip_favorite"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: "User" = Relationship(back_populates="favorite_trips")
    trip: "Trip" = Relationship(back_populates="favorited_by")
