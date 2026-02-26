import uuid
from typing import List, Optional

from sqlmodel import Session, select

from app.models.rbac import (
    Permission,
    PermissionRule,
    Role,
    RolePermissionLink,
    RoleSource,
    UserRoleLink,
)


# ── Permissions ───────────────────────────────────────────────────────────────

def get_permissions(
    session: Session,
    source: Optional[RoleSource] = None,
    group_name: Optional[str] = None,
) -> List[Permission]:
    stmt = select(Permission).where(Permission.is_active == True)
    if source:
        stmt = stmt.where(Permission.source == source)
    if group_name:
        stmt = stmt.where(Permission.group_name == group_name)
    return session.exec(stmt).all()


def get_permission(session: Session, permission_id: uuid.UUID) -> Optional[Permission]:
    return session.get(Permission, permission_id)


def get_permission_rules(session: Session, permission_id: uuid.UUID) -> List[PermissionRule]:
    return session.exec(
        select(PermissionRule).where(PermissionRule.permission_id == permission_id)
    ).all()


# ── Roles ─────────────────────────────────────────────────────────────────────

def create_role(
    session: Session,
    name: str,
    source: RoleSource,
    description: Optional[str] = None,
    provider_id: Optional[uuid.UUID] = None,
    is_system: bool = False,
) -> Role:
    role = Role(
        name=name,
        source=source,
        description=description,
        provider_id=provider_id,
        is_system=is_system,
    )
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


def get_role(session: Session, role_id: uuid.UUID) -> Optional[Role]:
    return session.get(Role, role_id)


def get_roles(
    session: Session,
    source: RoleSource,
    provider_id: Optional[uuid.UUID] = None,
    include_inactive: bool = False,
) -> List[Role]:
    stmt = select(Role).where(Role.source == source)
    if not include_inactive:
        stmt = stmt.where(Role.is_active == True)
    if source == RoleSource.PROVIDER and provider_id is not None:
        stmt = stmt.where(Role.provider_id == provider_id)
    return session.exec(stmt).all()


def update_role(
    session: Session,
    role: Role,
    name: Optional[str] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> Role:
    from datetime import datetime
    if name is not None:
        role.name = name
    if description is not None:
        role.description = description
    if is_active is not None:
        role.is_active = is_active
    role.updated_at = datetime.utcnow()
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


def delete_role(session: Session, role: Role) -> None:
    session.delete(role)
    session.commit()


# ── Role ↔ Permission links ───────────────────────────────────────────────────

def add_permission_to_role(
    session: Session, role_id: uuid.UUID, permission_id: uuid.UUID
) -> RolePermissionLink:
    existing = session.get(RolePermissionLink, (role_id, permission_id))
    if existing:
        return existing
    link = RolePermissionLink(role_id=role_id, permission_id=permission_id)
    session.add(link)
    session.commit()
    return link


def remove_permission_from_role(
    session: Session, role_id: uuid.UUID, permission_id: uuid.UUID
) -> None:
    link = session.get(RolePermissionLink, (role_id, permission_id))
    if link:
        session.delete(link)
        session.commit()


def get_role_permissions(session: Session, role_id: uuid.UUID) -> List[Permission]:
    stmt = (
        select(Permission)
        .join(RolePermissionLink, RolePermissionLink.permission_id == Permission.id)
        .where(RolePermissionLink.role_id == role_id)
        .where(Permission.is_active == True)
    )
    return session.exec(stmt).all()


# ── User ↔ Role links ─────────────────────────────────────────────────────────

def assign_role_to_user(
    session: Session, user_id: uuid.UUID, role_id: uuid.UUID
) -> UserRoleLink:
    existing = session.get(UserRoleLink, (user_id, role_id))
    if existing:
        return existing
    link = UserRoleLink(user_id=user_id, role_id=role_id)
    session.add(link)
    session.commit()
    return link


def remove_role_from_user(
    session: Session, user_id: uuid.UUID, role_id: uuid.UUID
) -> None:
    link = session.get(UserRoleLink, (user_id, role_id))
    if link:
        session.delete(link)
        session.commit()


def get_user_roles(
    session: Session, user_id: uuid.UUID, source: Optional[RoleSource] = None
) -> List[Role]:
    stmt = (
        select(Role)
        .join(UserRoleLink, UserRoleLink.role_id == Role.id)
        .where(UserRoleLink.user_id == user_id)
        .where(Role.is_active == True)
    )
    if source:
        stmt = stmt.where(Role.source == source)
    return session.exec(stmt).all()


def get_role_users(session: Session, role_id: uuid.UUID):
    """Return all UserRoleLink rows for a role (caller fetches user details)."""
    return session.exec(
        select(UserRoleLink).where(UserRoleLink.role_id == role_id)
    ).all()


# ── Permission enforcement helper ─────────────────────────────────────────────

def get_all_rules_for_user(
    session: Session,
    user_id: uuid.UUID,
    source: RoleSource,
    provider_id: Optional[uuid.UUID] = None,
) -> List[PermissionRule]:
    """
    Return all PermissionRule rows reachable from the user's active roles
    filtered by source (and provider_id for provider roles).
    """
    role_stmt = (
        select(Role)
        .join(UserRoleLink, UserRoleLink.role_id == Role.id)
        .where(UserRoleLink.user_id == user_id)
        .where(Role.is_active == True)
        .where(Role.source == source)
    )
    if source == RoleSource.PROVIDER and provider_id is not None:
        role_stmt = role_stmt.where(Role.provider_id == provider_id)

    roles = session.exec(role_stmt).all()
    if not roles:
        return []

    role_ids = [r.id for r in roles]

    perm_stmt = (
        select(Permission)
        .join(RolePermissionLink, RolePermissionLink.permission_id == Permission.id)
        .where(RolePermissionLink.role_id.in_(role_ids))
        .where(Permission.is_active == True)
    )
    permissions = session.exec(perm_stmt).all()
    if not permissions:
        return []

    perm_ids = [p.id for p in permissions]
    rules = session.exec(
        select(PermissionRule).where(PermissionRule.permission_id.in_(perm_ids))
    ).all()
    return rules
