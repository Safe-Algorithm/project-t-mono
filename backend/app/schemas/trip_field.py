from typing import List, Optional
from pydantic import BaseModel
import uuid

from app.models.trip_field import TripFieldType, GenderType, DisabilityType


class TripRequiredFieldBase(BaseModel):
    field_type: TripFieldType
    is_required: bool = True


class TripRequiredFieldCreate(TripRequiredFieldBase):
    pass


class TripRequiredFieldUpdate(BaseModel):
    is_required: Optional[bool] = None


class TripRequiredField(TripRequiredFieldBase):
    id: uuid.UUID
    trip_id: uuid.UUID

    class Config:
        from_attributes = True


class TripRequiredFieldsResponse(BaseModel):
    """Response model for trip required fields"""
    trip_id: uuid.UUID
    required_fields: List[TripRequiredField]
