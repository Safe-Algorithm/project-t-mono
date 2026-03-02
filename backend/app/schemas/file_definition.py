"""
File Definition Schemas

Schemas for managing file definition settings in the admin panel.
"""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import uuid


# ── File Group Schemas ─────────────────────────────────────────────────────────

class ProviderFileGroupBase(BaseModel):
    key: str = Field(max_length=100)
    name_en: str = Field(max_length=200)
    name_ar: str = Field(max_length=200)
    description_en: Optional[str] = Field(default=None, max_length=500)
    description_ar: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    display_order: int = Field(default=0, ge=0)

    @field_validator('key')
    @classmethod
    def validate_key(cls, v: str) -> str:
        if not v:
            raise ValueError("Key cannot be empty")
        if not v.replace('_', '').isalnum():
            raise ValueError("Key must contain only alphanumeric characters and underscores")
        return v.lower()


class ProviderFileGroupCreate(ProviderFileGroupBase):
    pass


class ProviderFileGroupUpdate(BaseModel):
    name_en: Optional[str] = Field(default=None, max_length=200)
    name_ar: Optional[str] = Field(default=None, max_length=200)
    description_en: Optional[str] = Field(default=None, max_length=500)
    description_ar: Optional[str] = Field(default=None, max_length=500)
    is_active: Optional[bool] = None
    display_order: Optional[int] = Field(default=None, ge=0)


class ProviderFileGroupPublic(ProviderFileGroupBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    file_definitions: List["FileDefinitionPublic"] = []

    class Config:
        from_attributes = True


class ProviderFileGroupSummary(BaseModel):
    """Lightweight group info returned in file definition list responses."""
    id: uuid.UUID
    key: str
    name_en: str
    name_ar: str

    class Config:
        from_attributes = True


class ProviderFileGroupListResponse(BaseModel):
    items: List[ProviderFileGroupPublic]
    total: int


# ── File Definition Schemas ───────────────────────────────────────────────────

class FileDefinitionBase(BaseModel):
    """Base schema for file definition"""
    key: str = Field(max_length=100, description="Unique key for the file definition")
    name_en: str = Field(max_length=200, description="English name")
    name_ar: str = Field(max_length=200, description="Arabic name")
    description_en: str = Field(max_length=500, description="English description")
    description_ar: str = Field(max_length=500, description="Arabic description")
    allowed_extensions: List[str] = Field(description="Allowed file extensions (e.g., ['pdf', 'jpg', 'png'])")
    max_size_mb: int = Field(default=10, ge=1, le=500, description="Maximum file size in MB")
    is_required: bool = Field(default=True, description="Whether this file is mandatory")
    is_active: bool = Field(default=True, description="Whether this file definition is active")
    display_order: int = Field(default=0, ge=0, description="Display order in forms")
    file_group_id: Optional[uuid.UUID] = Field(default=None, description="File group this definition belongs to (None = ungrouped)")
    
    @field_validator('allowed_extensions')
    @classmethod
    def validate_extensions(cls, v: List[str]) -> List[str]:
        """Validate and normalize file extensions"""
        if not v:
            raise ValueError("At least one file extension must be specified")
        
        # Normalize extensions (lowercase, remove dots)
        normalized = []
        for ext in v:
            ext = ext.lower().strip().lstrip('.')
            if not ext:
                raise ValueError("File extension cannot be empty")
            if len(ext) > 10:
                raise ValueError(f"File extension '{ext}' is too long (max 10 characters)")
            normalized.append(ext)
        
        return normalized
    
    @field_validator('key')
    @classmethod
    def validate_key(cls, v: str) -> str:
        """Validate key format"""
        if not v:
            raise ValueError("Key cannot be empty")
        # Key should be lowercase with underscores
        if not v.replace('_', '').isalnum():
            raise ValueError("Key must contain only alphanumeric characters and underscores")
        return v.lower()


class FileDefinitionCreate(FileDefinitionBase):
    """Schema for creating a file definition"""
    pass




class FileDefinitionUpdate(BaseModel):
    """Schema for updating a file definition"""
    name_en: Optional[str] = Field(None, max_length=200)
    name_ar: Optional[str] = Field(None, max_length=200)
    description_en: Optional[str] = Field(None, max_length=500)
    description_ar: Optional[str] = Field(None, max_length=500)
    allowed_extensions: Optional[List[str]] = None
    max_size_mb: Optional[int] = Field(None, ge=1, le=500)
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = Field(None, ge=0)
    file_group_id: Optional[uuid.UUID] = None
    
    @field_validator('allowed_extensions')
    @classmethod
    def validate_extensions(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate and normalize file extensions"""
        if v is None:
            return None
        
        if not v:
            raise ValueError("At least one file extension must be specified")
        
        # Normalize extensions (lowercase, remove dots)
        normalized = []
        for ext in v:
            ext = ext.lower().strip().lstrip('.')
            if not ext:
                raise ValueError("File extension cannot be empty")
            if len(ext) > 10:
                raise ValueError(f"File extension '{ext}' is too long (max 10 characters)")
            normalized.append(ext)
        
        return normalized


class FileDefinitionPublic(FileDefinitionBase):
    """Public schema for file definition (returned to clients)"""
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    file_group: Optional[ProviderFileGroupSummary] = None

    class Config:
        from_attributes = True


class FileDefinitionListResponse(BaseModel):
    """Response schema for listing file definitions"""
    items: List[FileDefinitionPublic]
    total: int


# Resolve forward reference
ProviderFileGroupPublic.model_rebuild()
