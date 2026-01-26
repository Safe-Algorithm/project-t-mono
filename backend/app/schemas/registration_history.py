import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.trip_registration import TripRegistrationParticipant


class RegistrationHistoryProviderInfo(BaseModel):
    id: uuid.UUID
    company_name: str


class RegistrationHistoryTripInfo(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    start_date: datetime
    end_date: datetime
    provider_id: uuid.UUID
    provider: RegistrationHistoryProviderInfo


class RegistrationHistoryItem(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    user_id: uuid.UUID
    registration_date: datetime
    total_participants: int
    total_amount: Decimal
    status: str
    participants: List[TripRegistrationParticipant] = []
    trip: RegistrationHistoryTripInfo

    class Config:
        from_attributes = True
