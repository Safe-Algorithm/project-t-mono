"""
Background tasks for file uploads.

This module contains background tasks for processing file uploads,
particularly for provider registration documents that need to be
uploaded to cloud storage (Backblaze B2).
"""

import hashlib
import uuid
import logging
from typing import Optional

from sqlmodel import Session

from app.core.db import engine
from app import crud
from app.services.storage import storage_service
from app.schemas.provider_file import ProviderFileCreate

logger = logging.getLogger(__name__)


async def process_provider_file_upload(
    file_content: bytes,
    file_name: str,
    file_extension: str,
    file_size_bytes: int,
    file_hash: str,
    content_type: str,
    provider_id: uuid.UUID,
    file_definition_id: uuid.UUID,
    file_definition_key: str,
    old_file_url: Optional[str] = None,
) -> None:
    """
    Background task to upload provider file to Backblaze B2 and create database record.
    
    This runs asynchronously after the API endpoint returns success to the client.
    The file has already been validated (size, extension, etc.) before this task runs.
    
    Args:
        file_content: Raw file bytes
        file_name: Original filename from upload
        file_extension: File extension (e.g., 'jpg', 'pdf')
        file_size_bytes: Size of file in bytes
        file_hash: SHA256 hash of file content
        content_type: MIME type of file
        provider_id: UUID of the provider
        file_definition_id: UUID of the file definition
        file_definition_key: Key of file definition (e.g., 'zakat_certificate')
        old_file_url: URL of old file to delete from Backblaze (if replacing)
    """
    try:
        logger.info(
            f"Background upload started - Provider: {provider_id}, "
            f"Definition: {file_definition_id}, File: {file_name}"
        )
        
        # Upload to Backblaze B2
        folder_path = f"provider_documents/provider_{provider_id}"
        unique_file_name = f"{file_definition_key}_{uuid.uuid4()}.{file_extension}"
        
        upload_result = await storage_service.upload_file(
            file_data=file_content,
            file_name=unique_file_name,
            content_type=content_type,
            folder=folder_path
        )
        
        file_url = upload_result.get('downloadUrl') or upload_result.get('file_url')
        backblaze_file_id = upload_result.get('fileId')
        logger.info(f"Backblaze upload complete: {file_url}, File ID: {backblaze_file_id}")
        
        # Delete old file from Backblaze if replacing
        # Note: This only happens during registration (before approval) when a provider
        # uploads a file multiple times. The old database record is already deleted,
        # so we don't have access to backblaze_file_id. For approved providers replacing
        # rejected files, the synchronous PUT endpoint is used which has proper deletion.
        if old_file_url:
            try:
                # We don't have backblaze_file_id here since the old DB record was deleted
                # Old files will remain in Backblaze but won't be referenced in DB
                # This is acceptable for pre-approval uploads as they're temporary
                old_file_name = old_file_url.split('/')[-1]
                logger.info(f"Old file from pre-approval upload will remain in Backblaze: {old_file_name}")
            except Exception as delete_error:
                logger.error(f"Error processing old file info: {str(delete_error)}")
        
        # Create database record
        with Session(engine) as db_session:
            provider_file_in = ProviderFileCreate(
                provider_id=provider_id,
                file_definition_id=file_definition_id,
                file_url=file_url,
                file_name=file_name,
                file_size_bytes=file_size_bytes,
                file_extension=file_extension,
                content_type=content_type,
                backblaze_file_id=backblaze_file_id,
                file_hash=file_hash
            )
            
            provider_file = crud.provider_file.create_provider_file(
                session=db_session,
                provider_file_in=provider_file_in
            )
            
            logger.info(
                f"Background upload complete - DB record created: {provider_file.id}, "
                f"Provider: {provider_id}, File: {file_name}"
            )
            
    except Exception as e:
        logger.error(
            f"Background upload failed - Provider: {provider_id}, "
            f"Definition: {file_definition_id}, File: {file_name}, "
            f"Error: {str(e)}",
            exc_info=True
        )
        # Note: In production, you might want to:
        # - Store failed uploads in a separate table for retry
        # - Send notifications to admins
        # - Implement retry logic with exponential backoff
