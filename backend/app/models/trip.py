import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List

from sqlmodel import JSON, Column, Field, Relationship, SQLModel
from sqlalchemy.ext.mutable import MutableList

from .links import TripParticipant, TripRating
from .trip_amenity import TripAmenity

if TYPE_CHECKING:
    from .provider import Provider
    from .user import User
    from .trip_package import TripPackage
    from .trip_favorite import TripFavorite
    from .trip_like import TripLike
    from .trip_bookmark import TripBookmark
    from .trip_amenity import TripExtraFee




class Trip(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    description: str
    start_date: datetime
    end_date: datetime
    max_participants: int
    is_active: bool = Field(default=True)
    images: Optional[List[str]] = Field(default=None, sa_column=Column(MutableList.as_mutable(JSON)))

    # Using JSONB for flexible metadata like itinerary, inclusions, exclusions
    trip_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Refundability
    is_refundable: bool = Field(default=True)
    
    # Amenities (stored as JSON array of enum values)
    amenities: Optional[List[TripAmenity]] = Field(default=None, sa_column=Column(JSON))
    
    # Meeting Place
    has_meeting_place: bool = Field(default=False)
    meeting_location: Optional[str] = Field(default=None, max_length=500)
    meeting_time: Optional[datetime] = Field(default=None)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    provider_id: uuid.UUID = Field(foreign_key="provider.id")
    provider: "Provider" = Relationship(back_populates="trips")

    participants: List["User"] = Relationship(back_populates="trips", link_model=TripParticipant, sa_relationship_kwargs={"cascade": "all, delete"})
    ratings: List[TripRating] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    packages: List["TripPackage"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    favorited_by: List["TripFavorite"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    liked_by: List["TripLike"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    bookmarked_by: List["TripBookmark"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    extra_fees: List["TripExtraFee"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
