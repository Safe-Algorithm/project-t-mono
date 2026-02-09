"""
Schemas for the Customer Support Ticketing System.
"""

import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.support_ticket import (
    TicketCategory,
    TicketPriority,
    TicketStatus,
    SenderType,
)


# ===== Ticket Message Schemas =====


class TicketMessageCreate(BaseModel):
    message: str = Field(..., max_length=5000)
    attachments: Optional[list] = None


class TicketMessageRead(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_type: SenderType
    message: str
    attachments: Optional[list] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Support Ticket (User → Admin) Schemas =====


class SupportTicketCreate(BaseModel):
    subject: str = Field(..., max_length=255)
    description: str = Field(..., max_length=2000)
    category: TicketCategory = TicketCategory.GENERAL
    priority: TicketPriority = TicketPriority.MEDIUM


class SupportTicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    category: Optional[TicketCategory] = None


class SupportTicketRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    subject: str
    description: str
    category: TicketCategory
    priority: TicketPriority
    status: TicketStatus
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SupportTicketReadWithMessages(SupportTicketRead):
    messages: List[TicketMessageRead] = []


# ===== Trip Support Ticket (User → Provider) Schemas =====


class TripSupportTicketCreate(BaseModel):
    subject: str = Field(..., max_length=255)
    description: str = Field(..., max_length=2000)
    priority: TicketPriority = TicketPriority.MEDIUM


class TripSupportTicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None


class TripSupportTicketRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    provider_id: uuid.UUID
    trip_id: uuid.UUID
    registration_id: uuid.UUID
    subject: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TripSupportTicketReadWithMessages(TripSupportTicketRead):
    messages: List[TicketMessageRead] = []
