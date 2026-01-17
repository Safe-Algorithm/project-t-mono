import uuid
from typing import TYPE_CHECKING, List
from decimal import Decimal
from enum import Enum

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .trip import Trip
    from .trip_package_field import TripPackageRequiredField


class Currency(str, Enum):
    """Supported currencies for trip packages"""
    SAR = "SAR"  # Saudi Riyal


class TripPackage(SQLModel, table=True):
    """Model for trip packages with different pricing options"""
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    name: str = Field(max_length=255)
    description: str
    price: Decimal = Field(decimal_places=2, max_digits=10)
    currency: Currency = Field(default=Currency.SAR)
    is_active: bool = Field(default=True)
    
    trip: "Trip" = Relationship(back_populates="packages")
    required_fields: List["TripPackageRequiredField"] = Relationship(back_populates="package", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
