import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel
from .trip_package import TripPackageWithRequiredFields


class TripBase(BaseModel):
    name: str
    description: str
    start_date: datetime
    end_date: datetime
    max_participants: int
    trip_metadata: Optional[dict] = None


class TripCreate(TripBase):
    pass


class TripUpdate(TripBase):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_participants: Optional[int] = None
    is_active: Optional[bool] = None


class TripRatingCreate(BaseModel):
    rating: int
    comment: Optional[str] = None


class ProviderInfo(BaseModel):
    id: uuid.UUID
    company_name: str

class TripRead(TripBase):
    id: uuid.UUID
    provider_id: uuid.UUID
    provider: ProviderInfo
    is_active: bool
    packages: List[TripPackageWithRequiredFields] = []

    class Config:
        from_attributes = True
