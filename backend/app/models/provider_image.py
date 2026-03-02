import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .provider import Provider


class ProviderImage(SQLModel, table=True):
    """An image uploaded by a provider, stored in their reusable Image Collection."""

    __tablename__ = "provider_image"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    provider_id: uuid.UUID = Field(foreign_key="provider.id", index=True)

    # Backblaze storage details — needed for deletion
    b2_file_id: str = Field(max_length=200)
    b2_file_name: str = Field(max_length=500)

    # Public CDN URL
    url: str = Field(max_length=1000)

    # Optional original filename for display
    original_filename: Optional[str] = Field(default=None, max_length=255)

    # Image dimensions after processing
    width: Optional[int] = Field(default=None)
    height: Optional[int] = Field(default=None)

    # Compressed size in bytes
    size_bytes: Optional[int] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    provider: "Provider" = Relationship(back_populates="images")
