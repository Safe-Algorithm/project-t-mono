"""
Models for the Customer Support Ticketing System.

Two ticket types:
  A. SupportTicket  – User → Admin (general support)
  B. TripSupportTicket – User → Provider (trip-specific)

Both share TicketMessage for conversation threads.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, List

from sqlmodel import JSON, Column, Field, Relationship, SQLModel


# ===== Enums =====


class TicketCategory(str, enum.Enum):
    TECHNICAL = "technical"
    BILLING = "billing"
    GENERAL = "general"


class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_ON_USER = "waiting_on_user"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SenderType(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"
    PROVIDER = "provider"


# ===== Models =====


class SupportTicket(SQLModel, table=True):
    """User → Admin support ticket."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)

    subject: str = Field(max_length=255)
    description: str = Field(max_length=2000)
    category: TicketCategory = Field(default=TicketCategory.GENERAL)
    priority: TicketPriority = Field(default=TicketPriority.MEDIUM)
    status: TicketStatus = Field(default=TicketStatus.OPEN, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = Field(default=None)

    # Relationships
    messages: List["TicketMessage"] = Relationship(
        back_populates="support_ticket",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class TripSupportTicket(SQLModel, table=True):
    """User → Provider support ticket (trip-specific)."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    provider_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id", index=True)
    registration_id: uuid.UUID = Field(foreign_key="tripregistration.id", index=True)

    subject: str = Field(max_length=255)
    description: str = Field(max_length=2000)
    status: TicketStatus = Field(default=TicketStatus.OPEN, index=True)
    priority: TicketPriority = Field(default=TicketPriority.MEDIUM)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = Field(default=None)

    # Relationships
    messages: List["TicketMessage"] = Relationship(
        back_populates="trip_support_ticket",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "foreign_keys": "[TicketMessage.trip_support_ticket_id]",
        },
    )


class TicketMessage(SQLModel, table=True):
    """A message in a ticket conversation thread.

    Linked to either a SupportTicket or a TripSupportTicket (exactly one).
    """

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # Polymorphic FK – exactly one should be set
    support_ticket_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="supportticket.id", index=True
    )
    trip_support_ticket_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="tripsupportticket.id", index=True
    )

    sender_id: uuid.UUID = Field(foreign_key="user.id")
    sender_type: SenderType = Field()
    message: str = Field(max_length=5000)
    attachments: Optional[list] = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    support_ticket: Optional["SupportTicket"] = Relationship(back_populates="messages")
    trip_support_ticket: Optional["TripSupportTicket"] = Relationship(
        back_populates="messages",
        sa_relationship_kwargs={
            "foreign_keys": "[TicketMessage.trip_support_ticket_id]",
        },
    )
