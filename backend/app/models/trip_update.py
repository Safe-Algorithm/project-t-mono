"""
Models for the Trip Updates / Notifications system.

Provider sends updates (text + optional attachments) to registered users.
Updates can target all registrations or a specific registration.
Read receipts track which users have seen each update.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List

from sqlmodel import JSON, Column, Field, Relationship, SQLModel


class TripUpdate(SQLModel, table=True):
    """An update/notification sent by a provider for a trip."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id", index=True)
    provider_id: uuid.UUID = Field(foreign_key="user.id", index=True)

    # Nullable – if set, the update targets a specific registration only
    registration_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="tripregistration.id", index=True
    )

    title: str = Field(max_length=255)
    message: str = Field(max_length=5000)
    attachments: Optional[list] = Field(default=None, sa_column=Column(JSON))
    is_important: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    receipts: List["TripUpdateReceipt"] = Relationship(
        back_populates="update",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class TripUpdateReceipt(SQLModel, table=True):
    """Tracks whether a user has read a specific trip update."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    update_id: uuid.UUID = Field(foreign_key="tripupdate.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    read_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    update: Optional["TripUpdate"] = Relationship(back_populates="receipts")
