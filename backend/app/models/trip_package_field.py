import uuid
from typing import TYPE_CHECKING, List, Optional, Dict, Any
from sqlalchemy import Column, JSON
from sqlalchemy.dialects.postgresql import ENUM as SQLEnum
from sqlmodel import Field, Relationship, SQLModel

from .trip_field import TripFieldType

if TYPE_CHECKING:
    from .trip_package import TripPackage


class TripPackageRequiredField(SQLModel, table=True):
    """Model to store which fields are required for a specific trip package"""
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    package_id: uuid.UUID = Field(foreign_key="trippackage.id")
    field_type: TripFieldType = Field(sa_column=Column(SQLEnum(TripFieldType, name='tripfieldtype', values_callable=lambda obj: [e.value for e in obj])))
    is_required: bool = Field(default=True)
    validation_config: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    
    package: "TripPackage" = Relationship(back_populates="required_fields")
