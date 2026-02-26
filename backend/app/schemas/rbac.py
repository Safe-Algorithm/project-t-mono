import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.rbac import RoleSource


# ── Permission schemas ────────────────────────────────────────────────────────

class PermissionRuleRead(BaseModel):
    id: uuid.UUID
    http_method: str
    path_pattern: str

    model_config = {"from_attributes": True}


class PermissionRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    source: RoleSource
    group_name: str
    is_active: bool
    rules: List[PermissionRuleRead] = []

    model_config = {"from_attributes": True}


# ── Role schemas ──────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RoleRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    source: RoleSource
    provider_id: Optional[uuid.UUID]
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoleReadWithPermissions(RoleRead):
    permissions: List[PermissionRead] = []


# ── Assignment schemas ────────────────────────────────────────────────────────

class AddPermissionsToRole(BaseModel):
    permission_ids: List[uuid.UUID]


class AssignRolesToUser(BaseModel):
    role_ids: List[uuid.UUID]


class UserRoleLinkRead(BaseModel):
    user_id: uuid.UUID
    role_id: uuid.UUID
    assigned_at: datetime

    model_config = {"from_attributes": True}
