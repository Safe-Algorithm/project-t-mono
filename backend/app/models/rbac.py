import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from enum import Enum

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .user import User
    from .provider import Provider


class RoleSource(str, Enum):
    ADMIN = "admin"
    PROVIDER = "provider"


# ── M2M link tables ──────────────────────────────────────────────────────────

class RolePermissionLink(SQLModel, table=True):
    __tablename__ = "role_permission_link"
    role_id: uuid.UUID = Field(foreign_key="role.id", primary_key=True)
    permission_id: uuid.UUID = Field(foreign_key="permission.id", primary_key=True)


class UserRoleLink(SQLModel, table=True):
    __tablename__ = "user_role_link"
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    role_id: uuid.UUID = Field(foreign_key="role.id", primary_key=True)
    assigned_at: datetime = Field(default_factory=datetime.utcnow)


# ── Core tables ───────────────────────────────────────────────────────────────

class Permission(SQLModel, table=True):
    """
    A named logical action (e.g. 'Manage Trips').
    System-seeded and immutable by end users.
    The actual endpoint rules live in PermissionRule.
    """
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    source: RoleSource = Field(index=True)
    group_name: str = Field(max_length=100)
    is_active: bool = Field(default=True)

    rules: List["PermissionRule"] = Relationship(back_populates="permission")
    roles: List["Role"] = Relationship(back_populates="permissions", link_model=RolePermissionLink)


class PermissionRule(SQLModel, table=True):
    """
    A single (http_method, path_pattern) pair that belongs to a Permission.
    path_pattern uses glob-style wildcards, e.g. /trips/* or /trips/*/packages/*.
    """
    __tablename__ = "permissionrule"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    permission_id: uuid.UUID = Field(foreign_key="permission.id", index=True)
    http_method: str = Field(max_length=10)
    path_pattern: str = Field(max_length=300)

    permission: Optional[Permission] = Relationship(back_populates="rules")


class Role(SQLModel, table=True):
    """
    A named collection of permissions.
    Provider roles are scoped to a single provider (provider_id is set).
    Admin roles have provider_id=None.
    is_system roles are created by the seeder and cannot be deleted.
    """
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    source: RoleSource = Field(index=True)
    provider_id: Optional[uuid.UUID] = Field(default=None, foreign_key="provider.id", index=True)
    is_system: bool = Field(default=False)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    permissions: List[Permission] = Relationship(back_populates="roles", link_model=RolePermissionLink)
    users: List["User"] = Relationship(back_populates="rbac_roles", link_model=UserRoleLink)
    provider: Optional["Provider"] = Relationship(back_populates="roles")
