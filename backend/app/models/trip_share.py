"""TripShare model — stores shareable tokens for trips."""

import uuid
import secrets
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .trip import Trip


def _generate_token() -> str:
    return secrets.token_urlsafe(16)


class TripShare(SQLModel, table=True):
    """One persistent share-token per trip (upserted on request)."""

    __tablename__ = "trip_share"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id", index=True, unique=True)
    share_token: str = Field(default_factory=_generate_token, max_length=64, index=True, unique=True)
    view_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_viewed_at: Optional[datetime] = Field(default=None)

    trip: Optional["Trip"] = Relationship(back_populates="share")
