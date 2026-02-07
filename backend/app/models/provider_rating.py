"""
Provider Rating model for user ratings and reviews of providers.
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.ext.mutable import MutableList
from sqlmodel import Field, Relationship, SQLModel, JSON

if TYPE_CHECKING:
    from .user import User
    from .provider import Provider


class ProviderRating(SQLModel, table=True):
    """User ratings and reviews for providers"""
    __tablename__ = "providerrating"
    __table_args__ = (
        UniqueConstraint("user_id", "provider_id", name="unique_user_provider_rating"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    provider_id: uuid.UUID = Field(foreign_key="provider.id", index=True)

    # Rating (1-5 stars)
    rating: int = Field(ge=1, le=5)

    # Optional review text
    comment: Optional[str] = Field(default=None, max_length=1000)

    # Optional review images
    images: Optional[List[str]] = Field(default=None, sa_column=Column(MutableList.as_mutable(JSON)))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: "User" = Relationship(back_populates="provider_ratings")
    provider: "Provider" = Relationship(back_populates="ratings")
