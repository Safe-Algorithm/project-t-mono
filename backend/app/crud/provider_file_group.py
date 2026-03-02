"""
CRUD operations for ProviderFileGroup
"""

from typing import List, Optional
from datetime import datetime
import uuid

from sqlmodel import Session, select
from fastapi import HTTPException

from app.models.provider_file_group import ProviderFileGroup
from app.schemas.file_definition import ProviderFileGroupCreate, ProviderFileGroupUpdate


def create_group(session: Session, group_in: ProviderFileGroupCreate) -> ProviderFileGroup:
    existing = session.exec(
        select(ProviderFileGroup).where(ProviderFileGroup.key == group_in.key)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"File group with key '{group_in.key}' already exists")

    group = ProviderFileGroup(**group_in.model_dump())
    session.add(group)
    session.commit()
    session.refresh(group)
    return group


def get_group(session: Session, group_id: uuid.UUID) -> Optional[ProviderFileGroup]:
    return session.get(ProviderFileGroup, group_id)


def get_group_by_key(session: Session, key: str) -> Optional[ProviderFileGroup]:
    return session.exec(
        select(ProviderFileGroup).where(ProviderFileGroup.key == key)
    ).first()


def get_groups(
    session: Session,
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
) -> List[ProviderFileGroup]:
    stmt = select(ProviderFileGroup)
    if active_only:
        stmt = stmt.where(ProviderFileGroup.is_active == True)
    stmt = stmt.order_by(ProviderFileGroup.display_order, ProviderFileGroup.created_at)
    stmt = stmt.offset(skip).limit(limit)
    return list(session.exec(stmt).all())


def count_groups(session: Session, active_only: bool = False) -> int:
    stmt = select(ProviderFileGroup)
    if active_only:
        stmt = stmt.where(ProviderFileGroup.is_active == True)
    return len(list(session.exec(stmt).all()))


def update_group(
    session: Session,
    group_id: uuid.UUID,
    group_in: ProviderFileGroupUpdate,
) -> Optional[ProviderFileGroup]:
    group = session.get(ProviderFileGroup, group_id)
    if not group:
        return None
    for field, value in group_in.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    group.updated_at = datetime.utcnow()
    session.add(group)
    session.commit()
    session.refresh(group)
    return group


def delete_group(session: Session, group_id: uuid.UUID) -> bool:
    """
    Delete a file group.
    Blocked if any file definitions still reference it — deactivate instead.
    """
    from app.models.file_definition import FileDefinition

    group = session.get(ProviderFileGroup, group_id)
    if not group:
        return False

    linked = session.exec(
        select(FileDefinition).where(FileDefinition.file_group_id == group_id)
    ).first()
    if linked:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete file group: file definitions are linked to it. Deactivate it instead.",
        )

    session.delete(group)
    session.commit()
    return True
