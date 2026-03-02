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


def _get_provider_file_group_id(
    session: Session,
    provider_id: uuid.UUID,
) -> Optional[uuid.UUID]:
    """Return the file_group_id stored on the Provider row (may be None)."""
    from app.models.provider import Provider as ProviderModel
    provider = session.get(ProviderModel, provider_id)
    return provider.file_group_id if provider else None


def _build_required_defs_query(
    file_group_id: Optional[uuid.UUID],
):
    """Build a select statement for active required FileDefinitions scoped to a group.

    Rules:
    - If the provider has a file_group_id → only definitions belonging to that group.
    - If no group → only ungrouped definitions (file_group_id IS NULL).
    """
    from app.models.file_definition import FileDefinition
    from sqlmodel import col

    stmt = select(FileDefinition).where(
        FileDefinition.is_required == True,
        FileDefinition.is_active == True,
    )
    if file_group_id is not None:
        stmt = stmt.where(FileDefinition.file_group_id == file_group_id)
    else:
        stmt = stmt.where(col(FileDefinition.file_group_id).is_(None))
    return stmt


def are_all_files_accepted(
    session: Session,
    provider_id: uuid.UUID
) -> bool:
    """Check if all required provider files are accepted.

    Only checks definitions that belong to the provider's file group (or
    ungrouped definitions if the provider has no group set).

    Returns True if there are no active required file definitions.
    Returns True if all uploaded files for required definitions are accepted.
    Returns False if any required file is missing or not yet accepted.
    """
    file_group_id = _get_provider_file_group_id(session, provider_id)
    required_defs = list(session.exec(_build_required_defs_query(file_group_id)).all())

    if not required_defs:
        return True

    uploaded = {
        f.file_definition_id: f
        for f in session.exec(
            select(ProviderFile).where(ProviderFile.provider_id == provider_id)
        ).all()
    }

    for defn in required_defs:
        file = uploaded.get(defn.id)
        if file is None:
            return False
        if file.file_verification_status != FileVerificationStatus.ACCEPTED:
            return False

    return True


def count_required_files(
    session: Session,
    provider_id: uuid.UUID
) -> int:
    """Count total required files for a provider scoped to their file group."""
    file_group_id = _get_provider_file_group_id(session, provider_id)
    return len(list(session.exec(_build_required_defs_query(file_group_id)).all()))


def get_missing_file_definitions(
    session: Session,
    provider_id: uuid.UUID
) -> List["FileDefinition"]:
    """
    Get active file definitions the provider hasn't uploaded yet, scoped to their group.
    """
    from app.models.file_definition import FileDefinition
    from sqlmodel import col

    file_group_id = _get_provider_file_group_id(session, provider_id)

    stmt = select(FileDefinition).where(FileDefinition.is_active == True)
    if file_group_id is not None:
        stmt = stmt.where(FileDefinition.file_group_id == file_group_id)
    else:
        stmt = stmt.where(col(FileDefinition.file_group_id).is_(None))
    all_definitions = list(session.exec(stmt).all())

    uploaded_ids = set(
        session.exec(
            select(ProviderFile.file_definition_id).where(ProviderFile.provider_id == provider_id)
        ).all()
    )

    return [d for d in all_definitions if d.id not in uploaded_ids]


def can_replace_file(
    session: Session,
    file_id: uuid.UUID
) -> bool:
    """Check if a file can be replaced (only if status is rejected)"""
    provider_file = session.get(ProviderFile, file_id)
    
    if not provider_file:
        return False
    
    return provider_file.file_verification_status == FileVerificationStatus.REJECTED
