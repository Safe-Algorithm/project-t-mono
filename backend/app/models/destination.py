"""
Destination models for hierarchical location system (countries, cities).
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .place import Place
    from .trip_destination import TripDestination


class DestinationType(str, Enum):
    COUNTRY = "country"
    CITY = "city"


class Destination(SQLModel, table=True):
    __tablename__ = "destinations"
    __table_args__ = (
        UniqueConstraint("parent_id", "slug", name="unique_parent_slug"),
        UniqueConstraint("full_slug", name="unique_full_slug"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    type: DestinationType = Field(sa_column=Column(SQLEnum(DestinationType, name="destinationtype")))
    parent_id: Optional[uuid.UUID] = Field(default=None, foreign_key="destinations.id")

    country_code: str = Field(max_length=2, index=True)
    slug: str = Field(max_length=100)
    full_slug: str = Field(max_length=200)

    name_en: str = Field(max_length=120)
    name_ar: str = Field(max_length=120)

    timezone: Optional[str] = Field(default=None, max_length=50)
    currency_code: Optional[str] = Field(default=None, max_length=3)

    google_place_id: Optional[str] = Field(default=None, max_length=120)
    is_active: bool = Field(default=False, index=True)

    display_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Self-referential relationships
    parent: Optional["Destination"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Destination.id"},
    )
    children: List["Destination"] = Relationship(back_populates="parent")

    # Related models
    places: List["Place"] = Relationship(
        back_populates="destination",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    trip_destinations: List["TripDestination"] = Relationship(
        back_populates="destination",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
