import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .user import User


class UserPushToken(SQLModel, table=True):
    """Stores FCM push tokens for mobile users. One row per user/platform combo."""

    __tablename__ = "user_push_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, index=True)
    token: str = Field(max_length=512, nullable=False)
    platform: str = Field(default="android", max_length=16)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: "User" = Relationship(back_populates="push_tokens")
