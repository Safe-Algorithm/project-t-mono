"""
CRUD operations for File Definitions
"""

from typing import List, Optional
from datetime import datetime
import uuid

from sqlmodel import Session, select
from fastapi import HTTPException

from app.models.file_definition import FileDefinition
from app.schemas.file_definition import FileDefinitionCreate, FileDefinitionUpdate


def create_file_definition(
    session: Session,
    file_definition_in: FileDefinitionCreate
) -> FileDefinition:
    """Create a new file definition"""
    # Check if key already exists
    existing = session.exec(
        select(FileDefinition).where(FileDefinition.key == file_definition_in.key)
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"File definition with key '{file_definition_in.key}' already exists"
        )
    
    file_definition = FileDefinition(**file_definition_in.model_dump())
    session.add(file_definition)
    session.commit()
    session.refresh(file_definition)
    return file_definition


def get_file_definition(
    session: Session,
    file_definition_id: uuid.UUID
) -> Optional[FileDefinition]:
    """Get a file definition by ID"""
    return session.get(FileDefinition, file_definition_id)


def get_file_definition_by_key(
    session: Session,
    key: str
) -> Optional[FileDefinition]:
    """Get a file definition by key"""
    return session.exec(
        select(FileDefinition).where(FileDefinition.key == key)
    ).first()


def get_file_definitions(
    session: Session,
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False
) -> List[FileDefinition]:
    """Get all file definitions"""
    statement = select(FileDefinition)
    
    if active_only:
        statement = statement.where(FileDefinition.is_active == True)
    
    statement = statement.order_by(FileDefinition.display_order, FileDefinition.created_at)
    statement = statement.offset(skip).limit(limit)
    
    return list(session.exec(statement).all())


def get_active_file_definitions_for_provider_registration(
    session: Session
) -> List[FileDefinition]:
    """Get active file definitions for provider registration"""
    statement = select(FileDefinition).where(
        FileDefinition.is_active == True
    ).order_by(FileDefinition.display_order, FileDefinition.created_at)
    
    return list(session.exec(statement).all())


def update_file_definition(
    session: Session,
    file_definition_id: uuid.UUID,
    file_definition_in: FileDefinitionUpdate
) -> Optional[FileDefinition]:
    """Update a file definition"""
    file_definition = session.get(FileDefinition, file_definition_id)
    
    if not file_definition:
        return None
    
    # Update fields
    update_data = file_definition_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(file_definition, key, value)
    
    file_definition.updated_at = datetime.utcnow()
    
    session.add(file_definition)
    session.commit()
    session.refresh(file_definition)
    return file_definition


def delete_file_definition(
    session: Session,
    file_definition_id: uuid.UUID
) -> bool:
    """
    Delete a file definition.
    Only allows deletion if no provider files are associated with it.
    """
    from app.models.provider_file import ProviderFile
    
    file_definition = session.get(FileDefinition, file_definition_id)
    
    if not file_definition:
        return False
    
    # Check if any provider files use this definition
    existing_files = session.exec(
        select(ProviderFile).where(ProviderFile.file_definition_id == file_definition_id)
    ).first()
    
    if existing_files:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete file definition: provider files are associated with it. Deactivate it instead."
        )
    
    session.delete(file_definition)
    session.commit()
    return True


def count_file_definitions(
    session: Session,
    active_only: bool = False
) -> int:
    """Count file definitions"""
    statement = select(FileDefinition)
    
    if active_only:
        statement = statement.where(FileDefinition.is_active == True)
    
    return len(list(session.exec(statement).all()))
