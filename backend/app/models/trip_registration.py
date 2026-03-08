import uuid
from datetime import datetime, date
from typing import TYPE_CHECKING, Optional
from decimal import Decimal

from sqlmodel import JSON, Column, Field, Relationship, SQLModel


def _generate_booking_ref() -> str:
    return f"BOOK-{uuid.uuid4().hex[:8].upper()}"

from .trip_field import GenderType, DisabilityType

if TYPE_CHECKING:
    from .trip import Trip
    from .user import User
    from .trip_package import TripPackage


class TripRegistration(SQLModel, table=True):
    """Model for trip registrations - allows multiple people per user registration"""
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    user_id: uuid.UUID = Field(foreign_key="user.id")  # The user who made the registration
    # Removed package_id - now each participant has their own package
    
    # Registration metadata
    registration_date: datetime = Field(default_factory=datetime.utcnow)
    total_participants: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    total_amount: Decimal = Field(decimal_places=2, max_digits=10)
    # Status flow:
    #   pending_payment → confirmed (guided trips, after payment)
    #   pending_payment → awaiting_provider (self-arranged trips, after payment)
    #   awaiting_provider → processing (provider flags as started)
    #   processing → confirmed (provider marks done)
    #   Any non-cancelled status → cancelled (manual or 3-day auto-cancel for awaiting_provider)
    status: str = Field(default="pending_payment")
    spot_reserved_until: Optional[datetime] = Field(default=None)  # 15-min payment window
    booking_reference: str = Field(default_factory=_generate_booking_ref, max_length=20, index=True)
    processing_started_at: Optional[datetime] = Field(default=None)  # When provider flagged as processing

    # Cancellation audit fields
    cancelled_at: Optional[datetime] = Field(default=None)
    cancellation_reason: Optional[str] = Field(default=None, max_length=500)
    cancelled_by: Optional[str] = Field(default=None, max_length=50)  # 'user', 'provider', 'admin', 'system'
    
    # Relationships
    trip: "Trip" = Relationship()
    user: "User" = Relationship()
    participants: list["TripRegistrationParticipant"] = Relationship(back_populates="registration", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class TripRegistrationParticipant(SQLModel, table=True):
    """Model for individual participants in a trip registration"""
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    registration_id: uuid.UUID = Field(foreign_key="tripregistration.id")
    package_id: Optional[uuid.UUID] = Field(default=None, foreign_key="trippackage.id")  # Each participant can choose their own package
    
    # Registration tracking fields
    registration_user_id: uuid.UUID = Field(foreign_key="user.id")  # The user who registered this participant
    is_registration_user: bool = Field(default=False)  # True if this participant is the user who made the registration
    
    # Participant details based on required fields
    id_iqama_number: Optional[str] = Field(default=None, max_length=50)
    passport_number: Optional[str] = Field(default=None, max_length=50)
    name: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None)
    city: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)
    date_of_birth: Optional[date] = Field(default=None)
    gender: Optional[GenderType] = Field(default=None)
    disability: Optional[DisabilityType] = Field(default=None)
    medical_conditions: Optional[str] = Field(default=None)
    allergies: Optional[str] = Field(default=None)
    
    # Additional metadata stored as JSON
    additional_info: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Relationships
    registration: "TripRegistration" = Relationship(back_populates="participants")
    package: Optional["TripPackage"] = Relationship()
    registration_user: "User" = Relationship()  # The user who registered this participant
