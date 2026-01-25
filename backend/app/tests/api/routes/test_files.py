"""
Tests for file upload endpoints (provider documents).
"""

import io
import uuid
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import UserRole
from app.models.file_verification_status import FileVerificationStatus
from app.tests.utils.user import user_authentication_headers
from app import crud
from app.schemas.file_definition import FileDefinitionCreate
from app.schemas.provider_file import ProviderFileCreate


def test_replace_provider_file_deletes_old_from_backblaze(
    client: TestClient, session: Session
) -> None:
    """Test that replacing a rejected file deletes the old file from Backblaze."""
    # Create a provider user
    user, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER
    )
    
    # Create a file definition
    file_def = crud.file_definition.create_file_definition(
        session=session,
        file_definition_in=FileDefinitionCreate(
            key="test_document",
            name_en="Test Document",
            name_ar="وثيقة اختبار",
            description_en="Test document for testing",
            description_ar="وثيقة اختبار للاختبار",
            allowed_extensions=["pdf", "jpg"],
            max_size_mb=5,
            is_required=True,
            is_active=True,
        )
    )
    
    # Create an existing rejected file
    existing_file = crud.provider_file.create_provider_file(
        session=session,
        provider_file_in=ProviderFileCreate(
            provider_id=user.provider_id,
            file_definition_id=file_def.id,
            file_url="https://example.com/old-file.pdf",
            file_name="old-file.pdf",
            file_size_bytes=1024,
            file_extension="pdf",
            content_type="application/pdf",
            backblaze_file_id="old-file-id-123",
            file_hash="oldhash123",
        )
    )
    
    # Set file status to REJECTED so it can be replaced
    crud.provider_file.update_file_verification_status(
        session=session,
        file_id=existing_file.id,
        status=FileVerificationStatus.REJECTED,
        reviewed_by_id=user.id,
        rejection_reason="Document not clear"
    )
    
    # Mock the storage service at the route level where it's imported
    with patch('app.api.routes.files.storage_service') as mock_storage:
        # Mock upload
        mock_storage.upload_file = AsyncMock(return_value={
            'downloadUrl': 'https://example.com/new-file.pdf',
            'fileId': 'new-file-id-456'
        })
        # Mock delete
        mock_storage.delete_file = AsyncMock(return_value={'success': True})
        
        # Replace the file
        new_file_content = b"new file content"
        files = {
            'file': ('new-file.pdf', io.BytesIO(new_file_content), 'application/pdf')
        }
        
        response = client.put(
            f"{settings.API_V1_STR}/files/provider-registration/{file_def.id}",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['file_url'] == 'https://example.com/new-file.pdf'
        assert data['message'] == 'File replaced successfully and is now under review'
        
        # Verify delete was called with BOTH file_id AND file_name (full path)
        mock_storage.delete_file.assert_called_once()
        call_args = mock_storage.delete_file.call_args
        assert call_args.kwargs['file_id'] == 'old-file-id-123'
        # The file_name should be just the filename since URL doesn't contain bucket name
        assert call_args.kwargs['file_name'] == 'old-file.pdf'


def test_replace_provider_file_extracts_correct_path_from_url(
    client: TestClient, session: Session
) -> None:
    """Test that file replacement extracts correct file path from Backblaze URL."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER
    )
    
    # Create a file definition
    file_def = crud.file_definition.create_file_definition(
        session=session,
        file_definition_in=FileDefinitionCreate(
            key="test_document_path",
            name_en="Test Document Path",
            name_ar="وثيقة اختبار",
            description_en="Test document",
            description_ar="وثيقة اختبار",
            allowed_extensions=["pdf"],
            max_size_mb=5,
            is_required=True,
            is_active=True,
        )
    )
    
    # Create existing file with realistic Backblaze URL
    existing_file = crud.provider_file.create_provider_file(
        session=session,
        provider_file_in=ProviderFileCreate(
            provider_id=user.provider_id,
            file_definition_id=file_def.id,
            file_url="https://f003.backblazeb2.com/file/Safe-Algo-Test-Bucket/provider_documents/provider_123/document.pdf",
            file_name="document.pdf",
            file_size_bytes=1024,
            file_extension="pdf",
            content_type="application/pdf",
            backblaze_file_id="old-file-id-456",
            file_hash="oldhash",
        )
    )
    
    crud.provider_file.update_file_verification_status(
        session=session,
        file_id=existing_file.id,
        status=FileVerificationStatus.REJECTED,
        reviewed_by_id=user.id,
        rejection_reason="Test"
    )
    
    with patch('app.api.routes.files.storage_service') as mock_storage:
        # Mock bucket_name attribute
        mock_storage.bucket_name = "Safe-Algo-Test-Bucket"
        mock_storage.upload_file = AsyncMock(return_value={
            'downloadUrl': 'https://example.com/new.pdf',
            'fileId': 'new-file-id'
        })
        mock_storage.delete_file = AsyncMock(return_value={'success': True})
        
        files = {
            'file': ('new.pdf', io.BytesIO(b"content"), 'application/pdf')
        }
        
        response = client.put(
            f"{settings.API_V1_STR}/files/provider-registration/{file_def.id}",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200
        
        # Verify delete was called with correct full path
        mock_storage.delete_file.assert_called_once()
        call_args = mock_storage.delete_file.call_args
        assert call_args.kwargs['file_id'] == 'old-file-id-456'
        # Should extract the full path after bucket name
        assert call_args.kwargs['file_name'] == 'provider_documents/provider_123/document.pdf'


def test_replace_provider_file_handles_missing_backblaze_id(
    client: TestClient, session: Session
) -> None:
    """Test that file replacement works even if old file has no backblaze_file_id."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER
    )
    
    # Create a file definition
    file_def = crud.file_definition.create_file_definition(
        session=session,
        file_definition_in=FileDefinitionCreate(
            key="test_document_2",
            name_en="Test Document 2",
            name_ar="وثيقة اختبار 2",
            description_en="Test document for testing",
            description_ar="وثيقة اختبار للاختبار",
            allowed_extensions=["pdf"],
            max_size_mb=5,
            is_required=True,
            is_active=True,
        )
    )
    
    # Create an existing rejected file WITHOUT backblaze_file_id (old file)
    existing_file = crud.provider_file.create_provider_file(
        session=session,
        provider_file_in=ProviderFileCreate(
            provider_id=user.provider_id,
            file_definition_id=file_def.id,
            file_url="https://example.com/old-file-no-id.pdf",
            file_name="old-file-no-id.pdf",
            file_size_bytes=1024,
            file_extension="pdf",
            content_type="application/pdf",
            backblaze_file_id=None,  # No Backblaze ID
            file_hash="oldhash456",
        )
    )
    
    # Set to REJECTED
    crud.provider_file.update_file_verification_status(
        session=session,
        file_id=existing_file.id,
        status=FileVerificationStatus.REJECTED,
        reviewed_by_id=user.id,
        rejection_reason="Missing information"
    )
    
    with patch('app.api.routes.files.storage_service') as mock_storage:
        mock_storage.upload_file = AsyncMock(return_value={
            'downloadUrl': 'https://example.com/new-file-2.pdf',
            'fileId': 'new-file-id-789'
        })
        mock_storage.delete_file = AsyncMock(return_value={'success': True})
        
        # Replace the file
        files = {
            'file': ('new-file-2.pdf', io.BytesIO(b"new content"), 'application/pdf')
        }
        
        response = client.put(
            f"{settings.API_V1_STR}/files/provider-registration/{file_def.id}",
            headers=headers,
            files=files
        )
        
        # Should succeed even without backblaze_file_id
        assert response.status_code == 200
        
        # Delete should NOT be called since there's no backblaze_file_id
        mock_storage.delete_file.assert_not_called()


def test_replace_provider_file_only_allowed_for_rejected(
    client: TestClient, session: Session
) -> None:
    """Test that only REJECTED files can be replaced."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER
    )
    
    # Create a file definition
    file_def = crud.file_definition.create_file_definition(
        session=session,
        file_definition_in=FileDefinitionCreate(
            key="test_document_3",
            name_en="Test Document 3",
            name_ar="وثيقة اختبار 3",
            description_en="Test document",
            description_ar="وثيقة اختبار",
            allowed_extensions=["pdf"],
            max_size_mb=5,
            is_required=True,
            is_active=True,
        )
    )
    
    # Create a file with PROCESSING status
    existing_file = crud.provider_file.create_provider_file(
        session=session,
        provider_file_in=ProviderFileCreate(
            provider_id=user.provider_id,
            file_definition_id=file_def.id,
            file_url="https://example.com/processing-file.pdf",
            file_name="processing-file.pdf",
            file_size_bytes=1024,
            file_extension="pdf",
            content_type="application/pdf",
            backblaze_file_id="processing-file-id",
            file_hash="processinghash",
        )
    )
    
    # Try to replace a PROCESSING file (should fail)
    files = {
        'file': ('new-file.pdf', io.BytesIO(b"content"), 'application/pdf')
    }
    
    response = client.put(
        f"{settings.API_V1_STR}/files/provider-registration/{file_def.id}",
        headers=headers,
        files=files
    )
    
    assert response.status_code == 403
    assert "Only rejected files can be replaced" in response.json()["detail"]


def test_replace_provider_file_validates_file_type(
    client: TestClient, session: Session
) -> None:
    """Test that file replacement validates file extension."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER
    )
    
    # Create a file definition that only accepts PDF
    file_def = crud.file_definition.create_file_definition(
        session=session,
        file_definition_in=FileDefinitionCreate(
            key="test_document_4",
            name_en="Test Document 4",
            name_ar="وثيقة اختبار 4",
            description_en="Test document",
            description_ar="وثيقة اختبار",
            allowed_extensions=["pdf"],  # Only PDF
            max_size_mb=5,
            is_required=True,
            is_active=True,
        )
    )
    
    # Create a rejected file
    existing_file = crud.provider_file.create_provider_file(
        session=session,
        provider_file_in=ProviderFileCreate(
            provider_id=user.provider_id,
            file_definition_id=file_def.id,
            file_url="https://example.com/old.pdf",
            file_name="old.pdf",
            file_size_bytes=1024,
            file_extension="pdf",
            content_type="application/pdf",
            backblaze_file_id="old-id",
            file_hash="oldhash",
        )
    )
    
    crud.provider_file.update_file_verification_status(
        session=session,
        file_id=existing_file.id,
        status=FileVerificationStatus.REJECTED,
        reviewed_by_id=user.id,
        rejection_reason="Test"
    )
    
    # Try to upload a JPG file (should fail)
    files = {
        'file': ('image.jpg', io.BytesIO(b"image content"), 'image/jpeg')
    }
    
    response = client.put(
        f"{settings.API_V1_STR}/files/provider-registration/{file_def.id}",
        headers=headers,
        files=files
    )
    
    assert response.status_code == 400
    assert "not allowed" in response.json()["detail"]


def test_replace_provider_file_validates_file_size(
    client: TestClient, session: Session
) -> None:
    """Test that file replacement validates file size."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER
    )
    
    # Create a file definition with 1MB limit
    file_def = crud.file_definition.create_file_definition(
        session=session,
        file_definition_in=FileDefinitionCreate(
            key="test_document_5",
            name_en="Test Document 5",
            name_ar="وثيقة اختبار 5",
            description_en="Test document",
            description_ar="وثيقة اختبار",
            allowed_extensions=["pdf"],
            max_size_mb=1,  # 1MB limit
            is_required=True,
            is_active=True,
        )
    )
    
    # Create a rejected file
    existing_file = crud.provider_file.create_provider_file(
        session=session,
        provider_file_in=ProviderFileCreate(
            provider_id=user.provider_id,
            file_definition_id=file_def.id,
            file_url="https://example.com/old.pdf",
            file_name="old.pdf",
            file_size_bytes=1024,
            file_extension="pdf",
            content_type="application/pdf",
            backblaze_file_id="old-id",
            file_hash="oldhash",
        )
    )
    
    crud.provider_file.update_file_verification_status(
        session=session,
        file_id=existing_file.id,
        status=FileVerificationStatus.REJECTED,
        reviewed_by_id=user.id,
        rejection_reason="Test"
    )
    
    # Try to upload a file larger than 1MB (should fail)
    large_content = b"x" * (2 * 1024 * 1024)  # 2MB
    files = {
        'file': ('large.pdf', io.BytesIO(large_content), 'application/pdf')
    }
    
    response = client.put(
        f"{settings.API_V1_STR}/files/provider-registration/{file_def.id}",
        headers=headers,
        files=files
    )
    
    assert response.status_code == 400
    assert "exceeds maximum" in response.json()["detail"]
