"""
Schemas for destinations and places
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.destination import DestinationType
from app.models.place import PlaceType


# ===== Destination Schemas =====


class DestinationCreate(BaseModel):
    """Schema for creating a destination (country or city)"""
    type: DestinationType
    parent_id: Optional[uuid.UUID] = None
    country_code: str = Field(..., max_length=2)
    slug: str = Field(..., max_length=100)
    name_en: str = Field(..., max_length=120)
    name_ar: str = Field(..., max_length=120)
    timezone: Optional[str] = Field(None, max_length=50)
    currency_code: Optional[str] = Field(None, max_length=3)
    google_place_id: Optional[str] = Field(None, max_length=120)
    is_active: bool = False
    display_order: int = 0


class DestinationUpdate(BaseModel):
    """Schema for updating a destination"""
    name_en: Optional[str] = Field(None, max_length=120)
    name_ar: Optional[str] = Field(None, max_length=120)
    slug: Optional[str] = Field(None, max_length=100)
    timezone: Optional[str] = Field(None, max_length=50)
    currency_code: Optional[str] = Field(None, max_length=3)
    google_place_id: Optional[str] = Field(None, max_length=120)
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class DestinationRead(BaseModel):
    """Schema for reading a destination"""
    id: uuid.UUID
    type: DestinationType
    parent_id: Optional[uuid.UUID]
    country_code: str
    slug: str
    full_slug: str
    name_en: str
    name_ar: str
    timezone: Optional[str]
    currency_code: Optional[str]
    google_place_id: Optional[str]
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DestinationReadWithChildren(DestinationRead):
    """Schema for reading a destination with its children (hierarchy)"""
    children: List["DestinationReadWithChildren"] = []
    places: List["PlaceRead"] = []


# ===== Place Schemas =====


class PlaceCreate(BaseModel):
    """Schema for creating a place"""
    type: PlaceType
    slug: str = Field(..., max_length=120)
    name_en: str = Field(..., max_length=150)
    name_ar: str = Field(..., max_length=150)
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    google_place_id: Optional[str] = Field(None, max_length=120)
    is_active: bool = True
    display_order: int = 0


class PlaceUpdate(BaseModel):
    """Schema for updating a place"""
    type: Optional[PlaceType] = None
    slug: Optional[str] = Field(None, max_length=120)
    name_en: Optional[str] = Field(None, max_length=150)
    name_ar: Optional[str] = Field(None, max_length=150)
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    google_place_id: Optional[str] = Field(None, max_length=120)
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class PlaceRead(BaseModel):
    """Schema for reading a place"""
    id: uuid.UUID
    destination_id: uuid.UUID
    type: PlaceType
    slug: str
    name_en: str
    name_ar: str
    latitude: Optional[Decimal]
    longitude: Optional[Decimal]
    google_place_id: Optional[str]
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== Trip Destination Schemas =====


class TripDestinationCreate(BaseModel):
    """Schema for adding a destination to a trip"""
    destination_id: uuid.UUID
    place_id: Optional[uuid.UUID] = None


class TripDestinationRead(BaseModel):
    """Schema for reading a trip destination"""
    id: uuid.UUID
    trip_id: uuid.UUID
    destination_id: uuid.UUID
    place_id: Optional[uuid.UUID]
    created_at: datetime
    destination: Optional[DestinationRead] = None
    place: Optional[PlaceRead] = None

    class Config:
        from_attributes = True


# Rebuild forward refs for recursive model
DestinationReadWithChildren.model_rebuild()
