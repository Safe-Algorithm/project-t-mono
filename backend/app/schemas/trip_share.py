"""Schemas for trip sharing."""

import uuid
from datetime import datetime
from pydantic import BaseModel


class TripShareResponse(BaseModel):
    share_token: str
    share_url: str
    view_count: int
    created_at: datetime

    class Config:
        from_attributes = True
