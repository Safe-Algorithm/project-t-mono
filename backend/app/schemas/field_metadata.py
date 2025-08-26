from typing import List, Optional, Any, Dict
from pydantic import BaseModel

from app.models.trip_field import TripFieldType, UIFieldType


class FieldOption(BaseModel):
    """Option for select field types"""
    value: str
    label: str


class FieldMetadata(BaseModel):
    """Metadata for a field type including UI display information"""
    field_name: TripFieldType
    display_name: str
    ui_type: UIFieldType
    placeholder: Optional[str] = None
    required: bool = True
    options: Optional[List[FieldOption]] = None


class AvailableFieldsResponse(BaseModel):
    """Response model for available fields with metadata"""
    fields: List[FieldMetadata]
