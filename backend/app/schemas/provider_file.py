"""
Provider File Schemas

Schemas for provider file uploads during registration.
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
import uuid

from app.models.file_verification_status import FileVerificationStatus


class FileDefinitionNested(BaseModel):
    """Nested file definition info"""
    id: uuid.UUID
    key: str
    name_en: str
    name_ar: str
    description_en: str
    description_ar: str
    
    model_config = ConfigDict(from_attributes=True)


class ProviderFileBase(BaseModel):
    """Base schema for provider file"""
    file_definition_id: uuid.UUID
    file_url: str
    file_name: str
    file_size_bytes: int
    file_extension: str
    content_type: str
    backblaze_file_id: Optional[str] = None
    file_hash: Optional[str] = None


class ProviderFileCreate(ProviderFileBase):
    """Schema for creating a provider file"""
    provider_id: uuid.UUID


class ProviderFilePublic(ProviderFileBase):
    """Public schema for provider file"""
    id: uuid.UUID
    provider_id: uuid.UUID
    file_definition_id: uuid.UUID
    file_verification_status: FileVerificationStatus
    rejection_reason: Optional[str] = None
    reviewed_by_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    uploaded_at: datetime
    file_definition: Optional[FileDefinitionNested] = None
    
    model_config = ConfigDict(from_attributes=True)


class ProviderFileUpdateStatus(BaseModel):
    """Schema for updating provider file verification status"""
    file_verification_status: FileVerificationStatus
    rejection_reason: Optional[str] = None


class FileUploadResponse(BaseModel):
    """Response after successful file upload"""
    file_id: uuid.UUID
    file_url: str
    file_name: str
    file_size_bytes: int
    message: str
