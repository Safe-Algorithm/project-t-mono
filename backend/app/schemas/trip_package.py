from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal
import uuid

from app.models.trip_field import TripFieldType


class TripPackageBase(BaseModel):
    name: str
    description: str
    price: Decimal
    is_active: bool = True


class TripPackageCreate(TripPackageBase):
    required_fields: Optional[List[TripFieldType]] = []


class TripPackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    is_active: Optional[bool] = None
    required_fields: Optional[List[TripFieldType]] = None


class TripPackage(TripPackageBase):
    id: uuid.UUID
    trip_id: uuid.UUID

    class Config:
        from_attributes = True


class TripPackageWithRequiredFields(TripPackage):
    """Trip package response with required fields populated"""
    required_fields: List[TripFieldType] = []
