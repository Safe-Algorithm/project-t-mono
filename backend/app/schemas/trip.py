import uuid
from datetime import datetime, timezone
from typing import Optional, List

from pydantic import BaseModel, field_validator, model_validator
from .trip_package import TripPackageWithRequiredFields
from .trip_extra_fee import TripExtraFeeResponse
from app.models.trip_amenity import TripAmenity


def _to_utc(dt: datetime) -> datetime:
    """Normalise a datetime to naive UTC for storage in TIMESTAMP WITHOUT TIME ZONE columns.
    Offset-aware datetimes are converted to UTC then stripped.
    Naive datetimes are assumed to already be UTC and returned as-is."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


class TripBase(BaseModel):
    name_en: Optional[str] = None
    name_ar: Optional[str] = None
    description_en: Optional[str] = None
    description_ar: Optional[str] = None
    start_date: datetime
    end_date: datetime
    max_participants: int
    images: Optional[List[str]] = None
    trip_metadata: Optional[dict] = None
    has_meeting_place: bool = False
    meeting_location: Optional[str] = None
    meeting_time: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    starting_city_id: Optional[uuid.UUID] = None
    is_international: bool = False
    is_packaged_trip: bool = False
    # IANA timezone string — defaults to Saudi Arabia since that is the primary market.
    # Clients must display all trip datetimes in this timezone.
    timezone: str = "Asia/Riyadh"

    @field_validator("start_date", "end_date", "meeting_time", "registration_deadline", mode="before")
    @classmethod
    def normalise_to_utc(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            from datetime import datetime as _dt
            # Parse ISO string; fromisoformat handles offset suffixes in Python 3.11+
            # For older Python use dateutil or manual parsing
            try:
                v = _dt.fromisoformat(v.replace("Z", "+00:00"))
            except ValueError:
                return v
        if isinstance(v, datetime):
            return _to_utc(v)
        return v


class TripCreate(TripBase):
    # For non-packaged trips: these go into the hidden package
    price: Optional[float] = None
    is_refundable: Optional[bool] = None
    amenities: Optional[List[TripAmenity]] = None

    @model_validator(mode='after')
    def validate_trip_fields(self):
        if not self.name_en and not self.name_ar:
            raise ValueError('At least one of name_en or name_ar must be provided')
        if not self.description_en and not self.description_ar:
            raise ValueError('At least one of description_en or description_ar must be provided')
        if self.registration_deadline and self.registration_deadline > self.start_date:
            raise ValueError('registration_deadline must be on or before start_date')
        return self


class TripUpdate(BaseModel):
    name_en: Optional[str] = None
    name_ar: Optional[str] = None
    description_en: Optional[str] = None
    description_ar: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_participants: Optional[int] = None
    is_active: Optional[bool] = None
    images: Optional[List[str]] = None
    trip_metadata: Optional[dict] = None
    has_meeting_place: Optional[bool] = None
    meeting_location: Optional[str] = None
    meeting_time: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    starting_city_id: Optional[uuid.UUID] = None
    is_international: Optional[bool] = None
    is_packaged_trip: Optional[bool] = None
    timezone: Optional[str] = None
    # For non-packaged trips: these update the hidden package
    price: Optional[float] = None
    is_refundable: Optional[bool] = None
    amenities: Optional[List[TripAmenity]] = None

    @field_validator("start_date", "end_date", "meeting_time", "registration_deadline", mode="before")
    @classmethod
    def normalise_to_utc(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            from datetime import datetime as _dt
            try:
                v = _dt.fromisoformat(v.replace("Z", "+00:00"))
            except ValueError:
                return v
        if isinstance(v, datetime):
            return _to_utc(v)
        return v

    @model_validator(mode='after')
    def validate_deadline(self):
        if self.registration_deadline and self.start_date and self.registration_deadline > self.start_date:
            raise ValueError('registration_deadline must be on or before start_date')
        return self


class TripRatingCreate(BaseModel):
    rating: int
    comment: Optional[str] = None


class StartingCityInfo(BaseModel):
    id: uuid.UUID
    name_en: str
    name_ar: str
    country_code: str

    class Config:
        from_attributes = True


class DestinationInfo(BaseModel):
    id: uuid.UUID
    name_en: str
    name_ar: str
    country_code: str
    type: str

    class Config:
        from_attributes = True


class ProviderInfo(BaseModel):
    id: uuid.UUID
    company_name: str


class TripRead(TripBase):
    id: uuid.UUID
    provider_id: uuid.UUID
    provider: ProviderInfo
    is_active: bool
    trip_reference: str
    available_spots: int = 0
    starting_city: Optional[StartingCityInfo] = None
    destinations: List[DestinationInfo] = []
    packages: List[TripPackageWithRequiredFields] = []
    extra_fees: List[TripExtraFeeResponse] = []
    is_packaged_trip: bool = False
    # Computed from hidden package for non-packaged trips; None for packaged trips
    price: Optional[float] = None
    is_refundable: Optional[bool] = None
    amenities: Optional[List[TripAmenity]] = None
    # Required fields for non-packaged trips (from hidden package), empty for packaged trips
    simple_trip_required_fields: List[str] = []
    simple_trip_required_fields_details: List = []

    class Config:
        from_attributes = True
