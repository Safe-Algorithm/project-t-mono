import uuid
import enum
from typing import Optional

from sqlmodel import SQLModel
from pydantic import field_validator, model_validator

from app.models.user import UserRole


# Shared properties
class UserBase(SQLModel):
    email: Optional[str] = None
    name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_superuser: bool = False


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.NORMAL
    provider_id: uuid.UUID | None = None
    preferred_language: str = "en"
    
    @model_validator(mode='after')
    def validate_email_or_phone(self):
        """For mobile app users, ensure exactly one of email or phone is provided"""
        # This validation will be enforced at the endpoint level based on source
        # Here we just ensure at least one is provided
        if not self.email and not self.phone:
            raise ValueError("Either email or phone must be provided")
        return self


# Properties to receive via API on update, all are optional
class UserRoleUpdate(SQLModel):
    role: UserRole


class UserUpdate(UserBase):
    email: str | None = None  # type: ignore
    password: str | None = None
    name: str | None = None
    phone: str | None = None
    is_superuser: bool | None = None
    preferred_language: str | None = None


class UserPublic(UserBase):
    id: uuid.UUID
    is_active: bool
    role: UserRole
    provider_id: uuid.UUID | None = None
    is_phone_verified: bool = False
    is_email_verified: bool = False
    preferred_language: str = "en"


class UserPublicWithProvider(UserPublic):
    """User with provider company information"""
    provider_company_name: str | None = None
    source: str
