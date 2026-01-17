from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import uuid

from app.models.trip_field import TripFieldType


class TripPackageRequiredFieldBase(BaseModel):
    field_type: TripFieldType
    is_required: bool = True
    validation_config: Optional[Dict[str, Any]] = None


class TripPackageRequiredFieldCreate(TripPackageRequiredFieldBase):
    pass


class TripPackageRequiredFieldUpdate(BaseModel):
    is_required: Optional[bool] = None
    validation_config: Optional[Dict[str, Any]] = None


class TripPackageRequiredField(TripPackageRequiredFieldBase):
    id: uuid.UUID
    package_id: uuid.UUID

    class Config:
        from_attributes = True


class TripPackageRequiredFieldsResponse(BaseModel):
    """Response model for trip package required fields"""
    package_id: uuid.UUID
    required_fields: List[TripPackageRequiredField]


class PackageRequiredFieldWithValidation(BaseModel):
    """Schema for package required field with validation config"""
    field_type: TripFieldType
    validation_config: Optional[Dict[str, Any]] = None


class TripPackageRequiredFieldsSet(BaseModel):
    """Schema for setting required fields for a trip package"""
    required_fields: List[TripFieldType]


class TripPackageRequiredFieldsSetWithValidation(BaseModel):
    """Schema for setting required fields with validation configs for a trip package"""
    required_fields: List[PackageRequiredFieldWithValidation]
