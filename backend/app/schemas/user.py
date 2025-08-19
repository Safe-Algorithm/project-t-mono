import uuid
import enum
from typing import Optional

from sqlmodel import SQLModel

from app.models.user import UserRole


# Shared properties
class UserBase(SQLModel):
    email: str
    name: str
    phone: str
    is_superuser: bool = False


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.NORMAL
    provider_id: uuid.UUID | None = None


# Properties to receive via API on update, all are optional
class UserRoleUpdate(SQLModel):
    role: UserRole


class UserUpdate(UserBase):
    email: str | None = None  # type: ignore
    password: str | None = None
    name: str | None = None
    phone: str | None = None
    is_superuser: bool | None = None


class UserPublic(UserBase):
    id: uuid.UUID
    is_active: bool
    role: UserRole
    provider_id: uuid.UUID | None = None
