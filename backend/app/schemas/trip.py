import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel
from .trip_package import TripPackageWithRequiredFields
from .trip_extra_fee import TripExtraFeeResponse
from app.models.trip_amenity import TripAmenity


class TripBase(BaseModel):
    name: str
    description: str
    start_date: datetime
    end_date: datetime
    max_participants: int
    images: Optional[List[str]] = None
    trip_metadata: Optional[dict] = None
    is_refundable: bool = True
    amenities: Optional[List[TripAmenity]] = None
    has_meeting_place: bool = False
    meeting_location: Optional[str] = None
    meeting_time: Optional[datetime] = None


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_participants: Optional[int] = None
    is_active: Optional[bool] = None
    images: Optional[List[str]] = None
    trip_metadata: Optional[dict] = None
    is_refundable: Optional[bool] = None
    amenities: Optional[List[TripAmenity]] = None
    has_meeting_place: Optional[bool] = None
    meeting_location: Optional[str] = None
    meeting_time: Optional[datetime] = None


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
    extra_fees: List[TripExtraFeeResponse] = []

    class Config:
        from_attributes = True
