"""
CRUD operations for Provider Files
"""

from typing import List, Optional
from datetime import datetime
import uuid

from sqlmodel import Session, select
from fastapi import HTTPException

from app.models.provider_file import ProviderFile
from app.models.file_verification_status import FileVerificationStatus
from app.schemas.provider_file import ProviderFileCreate


def create_provider_file(
    session: Session,
    provider_file_in: ProviderFileCreate
) -> ProviderFile:
    """Create a new provider file"""
    provider_file = ProviderFile(**provider_file_in.model_dump())
    session.add(provider_file)
    session.commit()
    session.refresh(provider_file)
    return provider_file


def get_provider_file(
    session: Session,
    file_id: uuid.UUID
) -> Optional[ProviderFile]:
    """Get a provider file by ID"""
    return session.get(ProviderFile, file_id)


def get_provider_files(
    session: Session,
    provider_id: uuid.UUID
) -> List[ProviderFile]:
    """Get all files for a provider"""
    statement = select(ProviderFile).where(
        ProviderFile.provider_id == provider_id
    ).order_by(ProviderFile.uploaded_at.desc())
    
    return list(session.exec(statement).all())


def get_provider_file_by_definition(
    session: Session,
    provider_id: uuid.UUID,
    file_definition_id: uuid.UUID
) -> Optional[ProviderFile]:
    """Get a provider file by provider and file definition"""
    statement = select(ProviderFile).where(
        ProviderFile.provider_id == provider_id,
        ProviderFile.file_definition_id == file_definition_id
    )
    return session.exec(statement).first()


def update_file_verification_status(
    session: Session,
    file_id: uuid.UUID,
    status: FileVerificationStatus,
    reviewed_by_id: uuid.UUID,
    rejection_reason: Optional[str] = None
) -> Optional[ProviderFile]:
    """
    Update the verification status of a provider file.
    """
    provider_file = session.get(ProviderFile, file_id)
    if not provider_file:
        return None
    
    provider_file.file_verification_status = status
    provider_file.reviewed_by_id = reviewed_by_id
    provider_file.reviewed_at = datetime.utcnow()
    
    # Set or clear rejection reason based on status
    if status == FileVerificationStatus.REJECTED:
        provider_file.rejection_reason = rejection_reason
    else:
        # Clear rejection reason if status is not rejected
        provider_file.rejection_reason = None
    
    session.add(provider_file)
    session.commit()
    session.refresh(provider_file)
    
    return provider_file


def delete_provider_file(
    session: Session,
    file_id: uuid.UUID
) -> bool:
    """Delete a provider file"""
    provider_file = session.get(ProviderFile, file_id)
    
    if not provider_file:
        return False
    
    session.delete(provider_file)
    session.commit()
    return True


def count_accepted_files(
    session: Session,
    provider_id: uuid.UUID
) -> int:
    """Count accepted files for a provider"""
    statement = select(ProviderFile).where(
        ProviderFile.provider_id == provider_id,
        ProviderFile.file_verification_status == FileVerificationStatus.ACCEPTED
    )
    return len(list(session.exec(statement).all()))


def are_all_files_accepted(
    session: Session,
    provider_id: uuid.UUID
) -> bool:
    """Check if all provider files are accepted (none processing or rejected)"""
    statement = select(ProviderFile).where(
        ProviderFile.provider_id == provider_id
    )
    files = list(session.exec(statement).all())
    
    # If no files, return False (can't approve without files)
    if not files:
        return False
    
    # All files must be accepted
    return all(
        file.file_verification_status == FileVerificationStatus.ACCEPTED 
        for file in files
    )


def count_required_files(
    session: Session,
    provider_id: uuid.UUID
) -> int:
    """Count total required files for a provider based on active file definitions"""
    from app.models.file_definition import FileDefinition
    
    statement = select(FileDefinition).where(
        FileDefinition.is_active == True,
        FileDefinition.is_required == True
    )
    return len(list(session.exec(statement).all()))


def get_missing_file_definitions(
    session: Session,
    provider_id: uuid.UUID
) -> List["FileDefinition"]:
    """
    Get all active file definitions that the provider hasn't uploaded yet.
    Returns file definitions that are active but have no corresponding provider file.
    """
    from app.models.file_definition import FileDefinition
    
    # Get all active file definitions
    all_definitions_stmt = select(FileDefinition).where(
        FileDefinition.is_active == True
    )
    all_definitions = list(session.exec(all_definitions_stmt).all())
    
    # Get file definition IDs that the provider has already uploaded
    uploaded_definitions_stmt = select(ProviderFile.file_definition_id).where(
        ProviderFile.provider_id == provider_id
    )
    uploaded_definition_ids = set(session.exec(uploaded_definitions_stmt).all())
    
    # Filter out definitions that have already been uploaded
    missing_definitions = [
        definition for definition in all_definitions
        if definition.id not in uploaded_definition_ids
    ]
    
    return missing_definitions


def can_replace_file(
    session: Session,
    file_id: uuid.UUID
) -> bool:
    """Check if a file can be replaced (only if status is rejected)"""
    provider_file = session.get(ProviderFile, file_id)
    
    if not provider_file:
        return False
    
    return provider_file.file_verification_status == FileVerificationStatus.REJECTED
