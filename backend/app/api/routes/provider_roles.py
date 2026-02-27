"""
Provider RBAC endpoints.

All endpoints require the caller to be a SUPER_USER provider (i.e. the company
owner / workspace admin).  Regular team members cannot manage roles.

Prefix: /provider/roles  (registered in api.py)
"""
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import get_current_active_provider, get_current_active_super_provider, get_session
from app.crud import rbac as rbac_crud
from app.models.rbac import RoleSource
from app.models.user import User
from app.schemas.rbac import (
    AddPermissionsToRole,
    AssignRolesToUser,
    PermissionRead,
    RoleCreate,
    RoleRead,
    RoleReadWithPermissions,
    RoleUpdate,
    UserRoleLinkRead,
)

router = APIRouter()


# ── Current user's own roles (any authenticated provider) ─────────────────────

@router.get("/me", response_model=List[RoleRead])
def get_my_roles(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Return the roles assigned to the currently authenticated provider user."""
    return rbac_crud.get_user_roles(session, current_user.id, source=RoleSource.PROVIDER)


# ── Permissions catalogue ─────────────────────────────────────────────────────

@router.get("/permissions", response_model=List[PermissionRead])
def list_provider_permissions(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """List all available provider permissions (system-seeded)."""
    perms = rbac_crud.get_permissions(session, source=RoleSource.PROVIDER)
    result = []
    for p in perms:
        rules = rbac_crud.get_permission_rules(session, p.id)
        result.append(PermissionRead(
            id=p.id,
            name=p.name,
            description=p.description,
            source=p.source,
            group_name=p.group_name,
            is_active=p.is_active,
            rules=[{"id": r.id, "http_method": r.http_method, "path_pattern": r.path_pattern} for r in rules],
        ))
    return result


# ── Role CRUD ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[RoleReadWithPermissions])
def list_roles(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """List all roles for this provider."""
    roles = rbac_crud.get_roles(session, source=RoleSource.PROVIDER, provider_id=current_user.provider_id)
    result = []
    for role in roles:
        perms = rbac_crud.get_role_permissions(session, role.id)
        perm_reads = []
        for p in perms:
            rules = rbac_crud.get_permission_rules(session, p.id)
            perm_reads.append(PermissionRead(
                id=p.id, name=p.name, description=p.description,
                source=p.source, group_name=p.group_name, is_active=p.is_active,
                rules=[{"id": r.id, "http_method": r.http_method, "path_pattern": r.path_pattern} for r in rules],
            ))
        result.append(RoleReadWithPermissions(
            id=role.id, name=role.name, description=role.description,
            source=role.source, provider_id=role.provider_id,
            is_system=role.is_system, is_active=role.is_active,
            created_at=role.created_at, updated_at=role.updated_at,
            permissions=perm_reads,
        ))
    return result


@router.post("", response_model=RoleRead, status_code=201)
def create_role(
    role_in: RoleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    """Create a new custom role for this provider."""
    role = rbac_crud.create_role(
        session,
        name=role_in.name,
        source=RoleSource.PROVIDER,
        description=role_in.description,
        provider_id=current_user.provider_id,
    )
    return role


@router.get("/{role_id}", response_model=RoleReadWithPermissions)
def get_role(
    role_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    role = rbac_crud.get_role(session, role_id)
    if not role or role.provider_id != current_user.provider_id:
        raise HTTPException(status_code=404, detail="Role not found")
    perms = rbac_crud.get_role_permissions(session, role.id)
    perm_reads = []
    for p in perms:
        rules = rbac_crud.get_permission_rules(session, p.id)
        perm_reads.append(PermissionRead(
            id=p.id, name=p.name, description=p.description,
            source=p.source, group_name=p.group_name, is_active=p.is_active,
            rules=[{"id": r.id, "http_method": r.http_method, "path_pattern": r.path_pattern} for r in rules],
        ))
    return RoleReadWithPermissions(
        id=role.id, name=role.name, description=role.description,
        source=role.source, provider_id=role.provider_id,
        is_system=role.is_system, is_active=role.is_active,
        created_at=role.created_at, updated_at=role.updated_at,
        permissions=perm_reads,
    )


@router.patch("/{role_id}", response_model=RoleRead)
def update_role(
    role_id: uuid.UUID,
    role_in: RoleUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    role = rbac_crud.get_role(session, role_id)
    if not role or role.provider_id != current_user.provider_id:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be modified")
    return rbac_crud.update_role(
        session, role,
        name=role_in.name,
        description=role_in.description,
        is_active=role_in.is_active,
    )


@router.delete("/{role_id}", status_code=204)
def delete_role(
    role_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    role = rbac_crud.get_role(session, role_id)
    if not role or role.provider_id != current_user.provider_id:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")
    rbac_crud.delete_role(session, role)


# ── Role ↔ Permission management ──────────────────────────────────────────────

@router.post("/{role_id}/permissions", status_code=204)
def add_permissions(
    role_id: uuid.UUID,
    body: AddPermissionsToRole,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    """Attach one or more permissions to a role."""
    role = rbac_crud.get_role(session, role_id)
    if not role or role.provider_id != current_user.provider_id:
        raise HTTPException(status_code=404, detail="Role not found")

    for perm_id in body.permission_ids:
        perm = rbac_crud.get_permission(session, perm_id)
        if not perm or perm.source != RoleSource.PROVIDER:
            raise HTTPException(status_code=400, detail=f"Invalid permission id: {perm_id}")
        rbac_crud.add_permission_to_role(session, role_id, perm_id)


@router.delete("/{role_id}/permissions/{permission_id}", status_code=204)
def remove_permission(
    role_id: uuid.UUID,
    permission_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    role = rbac_crud.get_role(session, role_id)
    if not role or role.provider_id != current_user.provider_id:
        raise HTTPException(status_code=404, detail="Role not found")
    rbac_crud.remove_permission_from_role(session, role_id, permission_id)


# ── Role ↔ User management ────────────────────────────────────────────────────

@router.get("/{role_id}/users", response_model=List[UserRoleLinkRead])
def list_role_users(
    role_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    role = rbac_crud.get_role(session, role_id)
    if not role or role.provider_id != current_user.provider_id:
        raise HTTPException(status_code=404, detail="Role not found")
    return rbac_crud.get_role_users(session, role_id)


@router.post("/{role_id}/users", status_code=204)
def assign_users(
    role_id: uuid.UUID,
    body: AssignRolesToUser,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    """
    Assign role_id to one or more users.
    body.role_ids is reused here as user_ids for simplicity of the schema.
    """
    role = rbac_crud.get_role(session, role_id)
    if not role or role.provider_id != current_user.provider_id:
        raise HTTPException(status_code=404, detail="Role not found")

    from app.crud import user as user_crud
    for user_id in body.role_ids:
        target = user_crud.get_user_by_id(session, user_id=user_id)
        if not target or target.provider_id != current_user.provider_id:
            raise HTTPException(status_code=400, detail=f"User {user_id} not in your team")
        rbac_crud.assign_role_to_user(session, user_id, role_id)


@router.delete("/{role_id}/users/{user_id}", status_code=204)
def remove_user_from_role(
    role_id: uuid.UUID,
    user_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    role = rbac_crud.get_role(session, role_id)
    if not role or role.provider_id != current_user.provider_id:
        raise HTTPException(status_code=404, detail="Role not found")
    rbac_crud.remove_role_from_user(session, user_id, role_id)


# ── Team member roles view ────────────────────────────────────────────────────

@router.get("/users/{user_id}/roles", response_model=List[RoleRead])
def get_user_roles(
    user_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_super_provider),
):
    """List all roles assigned to a specific team member."""
    from app.crud import user as user_crud
    target = user_crud.get_user_by_id(session, user_id=user_id)
    if not target or target.provider_id != current_user.provider_id:
        raise HTTPException(status_code=404, detail="User not found in your team")
    return rbac_crud.get_user_roles(session, user_id, source=RoleSource.PROVIDER)
