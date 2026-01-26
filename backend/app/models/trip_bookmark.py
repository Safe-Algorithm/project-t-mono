import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .user import User
    from .trip import Trip


class TripBookmark(SQLModel, table=True):
    """Model for user's bookmarked trips - saved for later viewing"""
    __tablename__ = "trip_bookmarks"
    __table_args__ = (
        UniqueConstraint("user_id", "trip_id", name="unique_user_trip_bookmark"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: "User" = Relationship(back_populates="bookmarked_trips")
    trip: "Trip" = Relationship(back_populates="bookmarked_by")
