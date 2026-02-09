"""
Schemas for the Trip Updates / Notifications system.
"""

import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class TripUpdateCreate(BaseModel):
    title: str = Field(..., max_length=255)
    message: str = Field(..., max_length=5000)
    attachments: Optional[list] = None
    is_important: bool = False


class TripUpdateRead(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    provider_id: uuid.UUID
    registration_id: Optional[uuid.UUID] = None
    title: str
    message: str
    attachments: Optional[list] = None
    is_important: bool
    created_at: datetime
    read: bool = False  # computed field for user context

    class Config:
        from_attributes = True


class TripUpdateReadWithReceipts(TripUpdateRead):
    total_recipients: int = 0
    read_count: int = 0


class TripUpdateReceiptRead(BaseModel):
    id: uuid.UUID
    update_id: uuid.UUID
    user_id: uuid.UUID
    read_at: datetime

    class Config:
        from_attributes = True
