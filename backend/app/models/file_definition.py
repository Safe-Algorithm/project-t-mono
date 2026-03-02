"""
File Definition Model

Defines required files for provider registration with localization support.
Managed by admins through the admin panel.
"""

from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import uuid

from sqlmodel import Field, SQLModel, Column, JSON, Relationship

if TYPE_CHECKING:
    from .provider_file_group import ProviderFileGroup


class FileDefinition(SQLModel, table=True):
    """
    File definition for provider registration documents.
    Admins can configure what files providers must upload during registration.
    """
    __tablename__ = "filedefinition"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    # File identification
    key: str = Field(index=True, unique=True, max_length=100)  # e.g., "zakat_certificate"
    
    # Localized names
    name_en: str = Field(max_length=200)  # e.g., "Zakat Registration Certificate"
    name_ar: str = Field(max_length=200)  # e.g., "شهادة تسجيل الزكاة"
    
    # Localized descriptions
    description_en: str = Field(max_length=500)  # Hint text in English
    description_ar: str = Field(max_length=500)  # Hint text in Arabic
    
    # File constraints
    allowed_extensions: List[str] = Field(sa_column=Column(JSON))  # e.g., ["pdf", "jpg", "png"]
    max_size_mb: int = Field(default=10)  # Maximum file size in MB
    
    # Validation
    is_required: bool = Field(default=True)  # Whether this file is mandatory
    is_active: bool = Field(default=True)  # Whether this file definition is active
    
    # Display order
    display_order: int = Field(default=0)  # Order in which to display in forms

    # File group (nullable — None means "ungrouped / global")
    file_group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="providerfilegroup.id", index=True)
    file_group: Optional["ProviderFileGroup"] = Relationship(back_populates="file_definitions")

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "key": "zakat_certificate",
                "name_en": "Zakat Registration Certificate",
                "name_ar": "شهادة تسجيل الزكاة",
                "description_en": "Your Zakat Registration Certificate that proves you have registered with Zakat, Tax and Customs Authority",
                "description_ar": "شهادة تسجيل الزكاة الخاصة بك والتي تثبت تسجيلك لدى هيئة الزكاة والضريبة والجمارك",
                "allowed_extensions": ["pdf", "jpg", "png"],
                "max_size_mb": 100,
                "is_required": True,
                "is_active": True,
                "display_order": 1
            }
        }
