"""Trip amenity enum and extra fee model."""

import uuid
from datetime import datetime
from typing import Optional
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship
from enum import Enum


class TripAmenity(str, Enum):
    """Amenities that can be included in a trip."""
    FLIGHT_TICKETS = "flight_tickets"
    BUS = "bus"
    TOUR_GUIDE = "tour_guide"
    TOURS = "tours"
    HOTEL = "hotel"
    MEALS = "meals"
    INSURANCE = "insurance"
    VISA_ASSISTANCE = "visa_assistance"
    INTERNATIONAL_DRIVERS_LICENSE = "international_drivers_license"
    OMRA_ASSISTANCE = "omra_assistance"


class TripExtraFee(SQLModel, table=True):
    """
    Additional fees that may apply to a trip.
    
    Examples: airport taxes, visa fees, optional activities, etc.
    Supports bilingual names and descriptions.
    """
    
    __tablename__ = "trip_extra_fees"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id", index=True)
    
    # Bilingual name
    name_en: Optional[str] = Field(default=None, max_length=100)
    name_ar: Optional[str] = Field(default=None, max_length=100)
    
    # Bilingual description (optional)
    description_en: Optional[str] = Field(default=None, max_length=500)
    description_ar: Optional[str] = Field(default=None, max_length=500)
    
    # Fee amount
    amount: Decimal = Field(max_digits=10, decimal_places=2)
    currency: str = Field(default="SAR", max_length=3)
    
    # Whether this fee is mandatory or optional
    is_mandatory: bool = Field(default=True)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    trip: "Trip" = Relationship(back_populates="extra_fees")
