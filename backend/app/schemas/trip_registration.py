from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime, date
import uuid

from app.models.trip_field import GenderType, DisabilityType


class TripParticipantBase(BaseModel):
    package_id: Optional[uuid.UUID] = None  # Each participant can choose their own package
    id_iqama_number: Optional[str] = None
    passport_number: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[GenderType] = None
    disability: Optional[DisabilityType] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    additional_info: Optional[Dict[str, Any]] = None


class TripParticipantCreate(TripParticipantBase):
    pass


class TripRegistrationParticipant(TripParticipantBase):
    id: uuid.UUID
    registration_id: uuid.UUID

    class Config:
        from_attributes = True


class TripRegistrationBase(BaseModel):
    total_participants: int = 1
    total_amount: Decimal
    status: str = "pending"


class TripRegistrationCreate(TripRegistrationBase):
    participants: List[TripParticipantCreate]  # Removed package_id - now each participant has their own


class TripRegistrationUpdate(BaseModel):
    status: Optional[str] = None
    total_amount: Optional[Decimal] = None


class TripRegistration(TripRegistrationBase):
    id: uuid.UUID
    trip_id: uuid.UUID
    user_id: uuid.UUID
    registration_date: datetime
    participants: List[TripRegistrationParticipant] = []  # Removed package_id - now per participant

    class Config:
        from_attributes = True
