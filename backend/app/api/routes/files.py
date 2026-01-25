"""
File Upload API Routes

Endpoints for uploading files (provider documents, trip images, user avatars).
"""

import hashlib
import uuid
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlmodel import Session

from app.api import deps
from app.models.user import User
from app.models.provider import Provider
from app import crud
from app.services.storage import storage_service
from app.schemas.provider_file import (
    ProviderFileCreate,
    ProviderFilePublic,
    FileUploadResponse,
    ProviderFileUpdateStatus
)
from app.schemas.file_definition import FileDefinitionPublic
from app.tasks.file_tasks import process_provider_file_upload
from app.models.file_verification_status import FileVerificationStatus

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/provider-registration/{file_definition_id}", response_model=FileUploadResponse)
async def upload_provider_registration_file(
    *,
    session: Session = Depends(deps.get_session),
    file_definition_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
    background_tasks: BackgroundTasks,
) -> FileUploadResponse:
    """
    Upload a file for provider registration.
    Validates file immediately and dispatches background task for Backblaze upload.
    Returns success immediately without waiting for Backblaze.
    """
    try:
        logger.info(f"File upload request - User: {current_user.id}, Provider: {current_user.provider_id}, File: {file.filename}, Definition: {file_definition_id}")
        
        # Check if user has a provider
        if not current_user.provider_id:
            logger.warning(f"User {current_user.id} attempted file upload without provider")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be associated with a provider to upload files"
            )
        
        # Get provider and check request status
        provider = session.get(Provider, current_user.provider_id)
        if not provider or not provider.provider_request:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provider request not found"
            )
        
        # Prevent file uploads/replacements if provider is already approved
        if provider.provider_request.status == "approved":
            logger.warning(f"Provider {provider.id} attempted file upload but request is already approved")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot upload or replace files after provider request is approved"
            )
        
        # Get file definition
        file_definition = crud.file_definition.get_file_definition(
            session=session,
            file_definition_id=file_definition_id
        )
        
        if not file_definition:
            logger.error(f"File definition {file_definition_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File definition not found"
            )
        
        logger.info(f"File definition found: {file_definition.key}, Active: {file_definition.is_active}")
        
        if not file_definition.is_active:
            logger.warning(f"Attempted upload to inactive file definition: {file_definition.key}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This file definition is not active"
            )
        
        # Validate file extension
        file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        logger.info(f"File extension: {file_extension}, Allowed: {file_definition.allowed_extensions}")
        
        if file_extension not in file_definition.allowed_extensions:
            logger.warning(f"Invalid file extension: {file_extension}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '.{file_extension}' not allowed. Allowed: {', '.join(file_definition.allowed_extensions)}"
            )
        
        # Read file content
        file_content = await file.read()
        file_size_bytes = len(file_content)
        logger.info(f"File size: {file_size_bytes / 1024 / 1024:.2f}MB")
        
        # Validate file size
        max_size_bytes = file_definition.max_size_mb * 1024 * 1024
        if file_size_bytes > max_size_bytes:
            logger.warning(f"File too large: {file_size_bytes / 1024 / 1024:.2f}MB > {file_definition.max_size_mb}MB")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size {file_size_bytes / 1024 / 1024:.2f}MB exceeds maximum {file_definition.max_size_mb}MB"
            )
        
        # Calculate file hash
        file_hash = hashlib.sha256(file_content).hexdigest()
        logger.info(f"File hash calculated: {file_hash[:16]}...")
        
        # Check if file already exists for this provider and definition
        existing_file = crud.provider_file.get_provider_file_by_definition(
            session=session,
            provider_id=current_user.provider_id,
            file_definition_id=file_definition_id
        )
        
        # If exists, prepare to delete old file from Backblaze and DB
        old_file_url = None
        if existing_file:
            logger.info(f"Replacing existing file: {existing_file.id}")
            old_file_url = existing_file.file_url
            crud.provider_file.delete_provider_file(session=session, file_id=existing_file.id)
            logger.info("Old file record deleted")
        
        # Generate a temporary file ID for the response
        temp_file_id = uuid.uuid4()
        
        # Dispatch background task for Backblaze upload and DB creation
        background_tasks.add_task(
            process_provider_file_upload,
            file_content=file_content,
            file_name=file.filename,
            file_extension=file_extension,
            file_size_bytes=file_size_bytes,
            file_hash=file_hash,
            content_type=file.content_type or 'application/octet-stream',
            provider_id=current_user.provider_id,
            file_definition_id=file_definition_id,
            file_definition_key=file_definition.key,
            old_file_url=old_file_url,
        )
        
        logger.info(f"File validation complete - Background upload dispatched for {file.filename}")
        
        # Return immediately without waiting for Backblaze
        return FileUploadResponse(
            file_id=temp_file_id,
            file_url="processing",  # Placeholder - actual URL will be set in background
            file_name=file.filename,
            file_size_bytes=file_size_bytes,
            message="File accepted and is being uploaded"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in file upload: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during file upload: {str(e)}"
        )


@router.put("/provider-registration/{file_definition_id}", response_model=FileUploadResponse)
async def replace_provider_file(
    *,
    session: Session = Depends(deps.get_session),
    file_definition_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> FileUploadResponse:
    """
    Replace an existing provider file (for profile page).
    Only allowed if the existing file status is REJECTED.
    Uploads synchronously and returns actual file URL.
    """
    try:
        logger.info(f"File replacement request - User: {current_user.id}, Provider: {current_user.provider_id}, File: {file.filename}, Definition: {file_definition_id}")
        
        # Check if user has a provider
        if not current_user.provider_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be associated with a provider to upload files"
            )
        
        # Get existing file
        existing_file = crud.provider_file.get_provider_file_by_definition(
            session=session,
            provider_id=current_user.provider_id,
            file_definition_id=file_definition_id
        )
        
        if not existing_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No existing file found for this definition"
            )
        
        # Check if file can be replaced (only if rejected)
        if existing_file.file_verification_status != FileVerificationStatus.REJECTED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot replace file with status '{existing_file.file_verification_status.value}'. Only rejected files can be replaced."
            )
        
        # Get file definition
        file_definition = crud.file_definition.get_file_definition(
            session=session,
            file_definition_id=file_definition_id
        )
        
        if not file_definition or not file_definition.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File definition not found or not active"
            )
        
        # Validate file extension
        file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        if file_extension not in file_definition.allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '.{file_extension}' not allowed. Allowed: {', '.join(file_definition.allowed_extensions)}"
            )
        
        # Read and validate file
        file_content = await file.read()
        file_size_bytes = len(file_content)
        max_size_bytes = file_definition.max_size_mb * 1024 * 1024
        
        if file_size_bytes > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size {file_size_bytes / 1024 / 1024:.2f}MB exceeds maximum {file_definition.max_size_mb}MB"
            )
        
        # Calculate file hash
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # Upload to Backblaze synchronously
        folder_path = f"provider_documents/provider_{current_user.provider_id}"
        unique_file_name = f"{file_definition.key}_{uuid.uuid4()}.{file_extension}"
        
        upload_result = await storage_service.upload_file(
            file_data=file_content,
            file_name=unique_file_name,
            content_type=file.content_type or 'application/octet-stream',
            folder=folder_path
        )
        
        file_url = upload_result.get('downloadUrl') or upload_result.get('file_url')
        backblaze_file_id = upload_result.get('fileId')
        logger.info(f"File uploaded to Backblaze: {file_url}, File ID: {backblaze_file_id}")
        
        # Delete old file from Backblaze
        if existing_file.backblaze_file_id and existing_file.file_url:
            try:
                # Extract full file path from URL - Backblaze needs the full path including folder
                # URL format: https://domain/file/bucket_name/folder/subfolder/filename
                # We need: folder/subfolder/filename
                url_parts = existing_file.file_url.split('/')
                # Find the bucket name and get everything after it
                try:
                    bucket_index = url_parts.index(storage_service.bucket_name)
                    old_file_path = '/'.join(url_parts[bucket_index + 1:])
                except (ValueError, AttributeError):
                    # Fallback: just use the last part (filename only)
                    old_file_path = url_parts[-1]
                
                await storage_service.delete_file(
                    file_id=existing_file.backblaze_file_id,
                    file_name=old_file_path
                )
                logger.info(f"Deleted old file from Backblaze: {existing_file.backblaze_file_id} ({old_file_path})")
            except Exception as e:
                logger.warning(f"Failed to delete old file from Backblaze: {str(e)}")
                # Continue even if deletion fails - we'll still replace the database record
        elif existing_file.file_url:
            # Log warning if we can't delete because backblaze_file_id is missing
            logger.warning(f"Cannot delete old file from Backblaze - missing backblaze_file_id for file: {existing_file.id}")
        
        
        # Delete old file record
        crud.provider_file.delete_provider_file(session=session, file_id=existing_file.id)
        
        # Create new file record with PROCESSING status
        provider_file_in = ProviderFileCreate(
            provider_id=current_user.provider_id,
            file_definition_id=file_definition_id,
            file_url=file_url,
            file_name=file.filename,
            file_size_bytes=file_size_bytes,
            file_extension=file_extension,
            content_type=file.content_type or 'application/octet-stream',
            backblaze_file_id=backblaze_file_id,
            file_hash=file_hash
        )
        
        new_file = crud.provider_file.create_provider_file(
            session=session,
            provider_file_in=provider_file_in
        )
        
        logger.info(f"File replacement complete - New file ID: {new_file.id}")
        
        return FileUploadResponse(
            file_id=new_file.id,
            file_url=file_url,
            file_name=file.filename,
            file_size_bytes=file_size_bytes,
            message="File replaced successfully and is now under review"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in file replacement: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during file replacement: {str(e)}"
        )


@router.get("/provider-registration", response_model=List[ProviderFilePublic])
def get_provider_registration_files(
    *,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_active_user),
) -> List[ProviderFilePublic]:
    """
    Get all uploaded files for current user's provider.
    """
    if not current_user.provider_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be associated with a provider"
        )
    
    files = crud.provider_file.get_provider_files(
        session=session,
        provider_id=current_user.provider_id
    )
    
    return files


@router.get("/provider-registration/missing-definitions", response_model=List[FileDefinitionPublic])
def get_missing_file_definitions(
    *,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_active_user),
) -> List[FileDefinitionPublic]:
    """
    Get all active file definitions that the current provider hasn't uploaded yet.
    These are optional for existing providers (even if marked required) since they
    may have been added after the provider registered.
    """
    if not current_user.provider_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be associated with a provider"
        )
    
    missing_definitions = crud.provider_file.get_missing_file_definitions(
        session=session,
        provider_id=current_user.provider_id
    )
    
    return missing_definitions


@router.patch("/admin/provider-files/{file_id}/status", response_model=ProviderFilePublic)
def update_provider_file_status(
    *,
    session: Session = Depends(deps.get_session),
    file_id: uuid.UUID,
    status_update: ProviderFileUpdateStatus,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> ProviderFilePublic:
    """
    Update provider file verification status (Admin only).
    Rejection reason is required when rejecting a file.
    """
    # Validate rejection reason is provided when rejecting
    if status_update.file_verification_status == FileVerificationStatus.REJECTED:
        if not status_update.rejection_reason or not status_update.rejection_reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rejection reason is required when rejecting a file"
            )
    
    provider_file = crud.provider_file.update_file_verification_status(
        session=session,
        file_id=file_id,
        status=status_update.file_verification_status,
        reviewed_by_id=current_user.id,
        rejection_reason=status_update.rejection_reason
    )
    
    if not provider_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider file not found"
        )
    
    logger.info(
        f"File {file_id} status updated to {status_update.file_verification_status.value} "
        f"by admin {current_user.id}"
    )
    
    return provider_file

@router.delete("/provider-registration/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_registration_file(
    *,
    session: Session = Depends(deps.get_session),
    file_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Delete a provider registration file.
    """
    if not current_user.provider_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be associated with a provider"
        )
    
    # Get file
    provider_file = crud.provider_file.get_provider_file(
        session=session,
        file_id=file_id
    )
    
    if not provider_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Check ownership
    if provider_file.provider_id != current_user.provider_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this file"
        )
    
    # Delete from storage (skip for now - need to store Backblaze file ID)
    # TODO: Store Backblaze file ID in ProviderFile model to enable deletion
    logger.info(f"Deleting file record: {file_id}")
    
    # Delete record
    crud.provider_file.delete_provider_file(session=session, file_id=file_id)
    
    return None


# Old verify endpoint removed - replaced by PATCH /admin/provider-files/{file_id}/status
# which uses the new FileVerificationStatus enum (processing/accepted/rejected)


@router.get("/provider/{provider_id}/files", response_model=List[ProviderFilePublic])
def get_provider_files_admin(
    *,
    session: Session = Depends(deps.get_session),
    provider_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> List[ProviderFilePublic]:
    """
    Get all files for a specific provider (Admin only).
    """
    files = crud.provider_file.get_provider_files(
        session=session,
        provider_id=provider_id
    )
    
    return files
