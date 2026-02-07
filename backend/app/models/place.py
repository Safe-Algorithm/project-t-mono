"""
Place model for specific locations within a destination (areas, attractions, etc.).
"""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .destination import Destination


class PlaceType(str, Enum):
    AREA = "area"
    DISTRICT = "district"
    ATTRACTION = "attraction"
    RESORT = "resort"
    THEME_PARK = "theme_park"
    LANDMARK = "landmark"
    EXPERIENCE = "experience"


class Place(SQLModel, table=True):
    __tablename__ = "places"
    __table_args__ = (
        UniqueConstraint("destination_id", "slug", name="unique_destination_place_slug"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    destination_id: uuid.UUID = Field(foreign_key="destinations.id", index=True)

    type: PlaceType = Field(sa_column=Column(SQLEnum(PlaceType, name="placetype")))
    slug: str = Field(max_length=120)

    name_en: str = Field(max_length=150)
    name_ar: str = Field(max_length=150)

    latitude: Optional[Decimal] = Field(default=None, max_digits=9, decimal_places=6)
    longitude: Optional[Decimal] = Field(default=None, max_digits=9, decimal_places=6)

    google_place_id: Optional[str] = Field(default=None, max_length=120)
    is_active: bool = Field(default=True)

    display_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    destination: "Destination" = Relationship(back_populates="places")
