from typing import Optional, List, Dict, Any
from pydantic import BaseModel, model_validator, field_validator
from decimal import Decimal
import uuid

from app.models.trip_field import TripFieldType
from app.models.trip_package import Currency


class TripPricingTierCreate(BaseModel):
    from_participant: int
    price_per_person: Decimal


class TripPricingTierRead(BaseModel):
    id: uuid.UUID
    package_id: uuid.UUID
    from_participant: int
    price_per_person: Decimal

    class Config:
        from_attributes = True


def _empty_to_none(v: Optional[str]) -> Optional[str]:
    """Coerce empty/whitespace-only strings to None for bilingual fields."""
    if v is not None and v.strip() == '':
        return None
    return v


class TripPackageBase(BaseModel):
    name_en: Optional[str] = None
    name_ar: Optional[str] = None
    description_en: Optional[str] = None
    description_ar: Optional[str] = None
    price: Decimal
    currency: Currency = Currency.SAR
    is_active: bool = True
    max_participants: Optional[int] = None
    is_refundable: Optional[bool] = None
    amenities: Optional[List[str]] = None

    @field_validator('name_en', 'name_ar', 'description_en', 'description_ar', mode='before')
    @classmethod
    def coerce_empty_to_none(cls, v: Optional[str]) -> Optional[str]:
        return _empty_to_none(v)


class TripPackageCreate(TripPackageBase):
    required_fields: Optional[List[TripFieldType]] = []
    use_flexible_pricing: bool = False
    pricing_tiers: Optional[List[TripPricingTierCreate]] = None

    @model_validator(mode='after')
    def validate_bilingual_fields(self):
        if not self.name_en and not self.name_ar:
            raise ValueError('At least one of name_en or name_ar must be provided')
        if not self.description_en and not self.description_ar:
            raise ValueError('At least one of description_en or description_ar must be provided')
        return self


class TripPackageUpdate(BaseModel):
    name_en: Optional[str] = None
    name_ar: Optional[str] = None
    description_en: Optional[str] = None
    description_ar: Optional[str] = None
    price: Optional[Decimal] = None
    currency: Optional[Currency] = None
    is_active: Optional[bool] = None
    required_fields: Optional[List[TripFieldType]] = None
    max_participants: Optional[int] = None
    is_refundable: Optional[bool] = None
    amenities: Optional[List[str]] = None
    use_flexible_pricing: Optional[bool] = None
    pricing_tiers: Optional[List[TripPricingTierCreate]] = None

    @field_validator('name_en', 'name_ar', 'description_en', 'description_ar', mode='before')
    @classmethod
    def coerce_empty_to_none(cls, v: Optional[str]) -> Optional[str]:
        return _empty_to_none(v)

    @field_validator('max_participants')
    @classmethod
    def max_participants_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError('max_participants must be at least 1')
        return v


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

class TripPackageWithRequiredFields(BaseModel):
    """Trip package response with required fields populated"""
    id: uuid.UUID
    trip_id: uuid.UUID
    name_en: Optional[str] = None
    name_ar: Optional[str] = None
    description_en: Optional[str] = None
    description_ar: Optional[str] = None
    price: Decimal
    currency: Currency = Currency.SAR
    is_active: bool = True
    max_participants: Optional[int] = None
    available_spots: Optional[int] = None
    is_refundable: Optional[bool] = None
    amenities: Optional[List[str]] = None
    required_fields: List[TripFieldType] = []
    required_fields_details: Optional[List[TripPackageRequiredFieldDetail]] = []
    use_flexible_pricing: bool = False
    pricing_tiers: List[TripPricingTierRead] = []
