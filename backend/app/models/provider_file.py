"""
Provider File Model

Stores uploaded files for provider registration.
Links to FileDefinition for validation and display.
"""

from typing import Optional, TYPE_CHECKING
from datetime import datetime
import uuid

from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import Enum as SQLAlchemyEnum

from app.models.file_verification_status import FileVerificationStatus


class ProviderFile(SQLModel, table=True):
    """
    Uploaded files for provider registration.
    Each file is linked to a FileDefinition and a Provider.
    """
    __tablename__ = "providerfile"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    # Relationships
    provider_id: uuid.UUID = Field(foreign_key="provider.id", index=True)
    file_definition_id: uuid.UUID = Field(foreign_key="filedefinition.id", index=True)
    
    # File information
    file_url: str = Field(max_length=500)  # URL to access the file
    file_name: str = Field(max_length=255)  # Original filename
    file_size_bytes: int  # File size in bytes
    file_extension: str = Field(max_length=10)  # e.g., "pdf", "jpg"
    content_type: str = Field(max_length=100)  # MIME type
    backblaze_file_id: Optional[str] = Field(default=None, max_length=255)  # Backblaze file ID for deletion
    
    # File hash for integrity
    file_hash: Optional[str] = Field(default=None, max_length=64)  # SHA256 hash
    
    # Verification status
    file_verification_status: FileVerificationStatus = Field(
        default=FileVerificationStatus.PROCESSING,
        sa_column=Column(
            SQLAlchemyEnum(FileVerificationStatus, values_callable=lambda x: [e.value for e in x]),
            nullable=False
        )
    )
    rejection_reason: Optional[str] = Field(default=None, max_length=500)
    reviewed_by_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")
    reviewed_at: Optional[datetime] = Field(default=None)
    
    # Metadata
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    provider: Optional["Provider"] = Relationship(back_populates="files")
    file_definition: Optional["FileDefinition"] = Relationship()
