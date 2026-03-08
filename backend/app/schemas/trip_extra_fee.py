"""Schemas for trip extra fees."""

import uuid
from typing import Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class TripExtraFeeBase(BaseModel):
    """Base schema for trip extra fee."""
    name_en: Optional[str] = Field(default=None, max_length=100)
    name_ar: Optional[str] = Field(default=None, max_length=100)
    description_en: Optional[str] = Field(default=None, max_length=500)
    description_ar: Optional[str] = Field(default=None, max_length=500)
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    currency: str = Field(default="SAR", max_length=3)
    is_mandatory: bool = Field(default=True)


class TripExtraFeeCreate(TripExtraFeeBase):
    """Schema for creating a trip extra fee."""
    pass


class TripExtraFeeUpdate(BaseModel):
    """Schema for updating a trip extra fee."""
    name_en: Optional[str] = Field(default=None, max_length=100)
    name_ar: Optional[str] = Field(default=None, max_length=100)
    description_en: Optional[str] = Field(default=None, max_length=500)
    description_ar: Optional[str] = Field(default=None, max_length=500)
    amount: Optional[Decimal] = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    currency: Optional[str] = Field(default=None, max_length=3)
    is_mandatory: Optional[bool] = None


class TripExtraFeeResponse(TripExtraFeeBase):
    """Schema for trip extra fee response."""
    id: uuid.UUID
    trip_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
