from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from decimal import Decimal
import uuid

from app.models.trip_field import TripFieldType
from app.models.trip_package import Currency


class TripPackageBase(BaseModel):
    name_en: str
    name_ar: str
    description_en: str
    description_ar: str
    price: Decimal
    currency: Currency = Currency.SAR
    is_active: bool = True


class TripPackageCreate(TripPackageBase):
    required_fields: Optional[List[TripFieldType]] = []


class TripPackageUpdate(BaseModel):
    name_en: Optional[str] = None
    name_ar: Optional[str] = None
    description_en: Optional[str] = None
    description_ar: Optional[str] = None
    price: Optional[Decimal] = None
    currency: Optional[Currency] = None
    is_active: Optional[bool] = None
    required_fields: Optional[List[TripFieldType]] = None


class TripPackage(TripPackageBase):
    id: uuid.UUID
    trip_id: uuid.UUID

    class Config:
        from_attributes = True


class TripPackageRequiredFieldDetail(BaseModel):
    """Detailed required field information with validation config"""
    id: str
    package_id: str
    field_type: str
    is_required: bool
    validation_config: Optional[Dict[str, Any]] = None

class TripPackageWithRequiredFields(TripPackage):
    """Trip package response with required fields populated"""
    required_fields: List[TripFieldType] = []
    required_fields_details: Optional[List[TripPackageRequiredFieldDetail]] = []
