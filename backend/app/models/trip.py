import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List

from sqlmodel import JSON, Column, Field, Relationship, SQLModel
from sqlalchemy.ext.mutable import MutableList


def _generate_trip_ref() -> str:
    return f"TRIP-{uuid.uuid4().hex[:8].upper()}"

from .links import TripParticipant, TripRating

if TYPE_CHECKING:
    from .provider import Provider
    from .user import User
    from .trip_package import TripPackage
    from .trip_favorite import TripFavorite
    from .trip_like import TripLike
    from .trip_bookmark import TripBookmark
    from .trip_amenity import TripExtraFee
    from .trip_destination import TripDestination
    from .destination import Destination




class Trip(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    # Bilingual fields for localization (at least one language required)
    name_en: Optional[str] = Field(default=None, max_length=200)
    name_ar: Optional[str] = Field(default=None, max_length=200)
    description_en: Optional[str] = Field(default=None)
    description_ar: Optional[str] = Field(default=None)
    
    start_date: datetime
    end_date: datetime
    max_participants: int
    is_active: bool = Field(default=True)
    trip_reference: str = Field(default_factory=_generate_trip_ref, max_length=20, index=True)
    images: Optional[List[str]] = Field(default=None, sa_column=Column(MutableList.as_mutable(JSON)))

    # Registration deadline — must be <= start_date
    registration_deadline: Optional[datetime] = Field(default=None, index=True)

    # Starting city (single Destination of type=city, required for new trips)
    starting_city_id: Optional[uuid.UUID] = Field(default=None, foreign_key="destinations.id", index=True)

    # True when from-city country != any destination country
    is_international: bool = Field(default=False, index=True)

    # False = single hidden package (price/amenities/refundability shown at trip level)
    # True  = multiple visible packages (each with own price/amenities/refundability)
    is_packaged_trip: bool = Field(default=False, index=True)

    # Using JSONB for flexible metadata like itinerary, inclusions, exclusions
    trip_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Meeting Place
    has_meeting_place: bool = Field(default=False)
    meeting_location: Optional[str] = Field(default=None, max_length=500)
    meeting_time: Optional[datetime] = Field(default=None)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    provider_id: uuid.UUID = Field(foreign_key="provider.id")
    provider: "Provider" = Relationship(back_populates="trips")
    starting_city: Optional["Destination"] = Relationship()

    participants: List["User"] = Relationship(back_populates="trips", link_model=TripParticipant, sa_relationship_kwargs={"cascade": "all, delete"})
    ratings: List[TripRating] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    packages: List["TripPackage"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    favorited_by: List["TripFavorite"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    liked_by: List["TripLike"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    bookmarked_by: List["TripBookmark"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    extra_fees: List["TripExtraFee"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    trip_destinations: List["TripDestination"] = Relationship(back_populates="trip", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
