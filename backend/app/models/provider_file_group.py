"""
Provider File Group Model

Groups of file definitions for provider registration.
Admins create groups (e.g. 'Saudi Company', 'Qatari Company') and attach
file definitions to each. Providers pick a group at registration time and
are only required to upload the files belonging to that group.
"""

from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import uuid

from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from .file_definition import FileDefinition


class ProviderFileGroup(SQLModel, table=True):
    """
    A named category of file definitions for provider registration.
    Examples: 'Saudi Company', 'Qatari Company', 'Individual Freelancer'.
    """
    __tablename__ = "providerfilegroup"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    key: str = Field(index=True, unique=True, max_length=100)  # e.g. "saudi_company"

    name_en: str = Field(max_length=200)
    name_ar: str = Field(max_length=200)

    description_en: Optional[str] = Field(default=None, max_length=500)
    description_ar: Optional[str] = Field(default=None, max_length=500)

    is_active: bool = Field(default=True)
    display_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    file_definitions: List["FileDefinition"] = Relationship(back_populates="file_group")
