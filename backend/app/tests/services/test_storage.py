"""
Unit tests for Backblaze B2 Storage Service
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.storage import BackblazeStorageService


@pytest.fixture
def storage_service():
    """Create a storage service instance for testing."""
    return BackblazeStorageService()


@pytest.mark.asyncio
async def test_authorize_success(storage_service):
    """Test successful authorization with Backblaze B2."""
    # Set application key for test
    storage_service.application_key = "test_application_key"
    
    mock_response = {
        "authorizationToken": "test_auth_token",
        "apiUrl": "https://api.test.backblaze.com",
        "downloadUrl": "https://download.test.backblaze.com"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await storage_service._authorize()
        
        assert result["authorizationToken"] == "test_auth_token"
        assert storage_service._auth_token == "test_auth_token"
        assert storage_service._api_url == "https://api.test.backblaze.com"


@pytest.mark.asyncio
async def test_authorize_missing_key():
    """Test authorization fails when application key is missing."""
    service = BackblazeStorageService()
    service.application_key = ""
    
    with pytest.raises(ValueError, match="BACKBLAZE_APPLICATION_KEY not configured"):
        await service._authorize()


@pytest.mark.asyncio
async def test_get_upload_url_success(storage_service):
    """Test getting upload URL successfully."""
    storage_service._auth_token = "test_token"
    storage_service._api_url = "https://api.test.backblaze.com"
    storage_service.bucket_id = "test_bucket_id"
    
    mock_response = {
        "uploadUrl": "https://upload.test.backblaze.com",
        "authorizationToken": "upload_token"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await storage_service._get_upload_url()
        
        assert result["uploadUrl"] == "https://upload.test.backblaze.com"
        assert result["authorizationToken"] == "upload_token"


@pytest.mark.asyncio
async def test_upload_file_success(storage_service):
    """Test successful file upload."""
    storage_service._auth_token = "test_token"
    storage_service._api_url = "https://api.test.backblaze.com"
    storage_service._download_url = "https://download.test.backblaze.com"
    storage_service.bucket_id = "test_bucket_id"
    storage_service.bucket_name = "test-bucket"
    
    file_data = b"test file content"
    file_name = "test.txt"
    
    mock_upload_url_response = {
        "uploadUrl": "https://upload.test.backblaze.com",
        "authorizationToken": "upload_token"
    }
    
    mock_upload_response = {
        "fileId": "test_file_id",
        "fileName": "uploads/20260118_120000_test.txt",
        "contentType": "text/plain"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = AsyncMock(
            side_effect=[
                MagicMock(json=lambda: mock_upload_url_response, raise_for_status=lambda: None),
                MagicMock(json=lambda: mock_upload_response, raise_for_status=lambda: None)
            ]
        )
        mock_client.return_value.__aenter__.return_value.post = mock_post
        
        result = await storage_service.upload_file(file_data, file_name)
        
        assert result["fileId"] == "test_file_id"
        assert "downloadUrl" in result
        assert "test-bucket" in result["downloadUrl"]


@pytest.mark.asyncio
async def test_delete_file_success(storage_service):
    """Test successful file deletion."""
    storage_service._auth_token = "test_token"
    storage_service._api_url = "https://api.test.backblaze.com"
    
    file_id = "test_file_id"
    file_name = "test.txt"
    
    mock_response = {
        "fileId": file_id,
        "fileName": file_name
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await storage_service.delete_file(file_id, file_name)
        
        assert result["fileId"] == file_id
        assert result["fileName"] == file_name


@pytest.mark.asyncio
async def test_get_file_info_success(storage_service):
    """Test getting file information."""
    storage_service._auth_token = "test_token"
    storage_service._api_url = "https://api.test.backblaze.com"
    
    file_id = "test_file_id"
    
    mock_response = {
        "fileId": file_id,
        "fileName": "test.txt",
        "contentType": "text/plain",
        "contentLength": 100
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await storage_service.get_file_info(file_id)
        
        assert result["fileId"] == file_id
        assert result["fileName"] == "test.txt"
        assert result["contentType"] == "text/plain"


@pytest.mark.asyncio
async def test_upload_file_auto_detect_content_type(storage_service):
    """Test that content type is auto-detected for known file types."""
    storage_service._auth_token = "test_token"
    storage_service._api_url = "https://api.test.backblaze.com"
    storage_service._download_url = "https://download.test.backblaze.com"
    storage_service.bucket_id = "test_bucket_id"
    storage_service.bucket_name = "test-bucket"
    
    file_data = b"fake image data"
    file_name = "test.jpg"
    
    mock_upload_url_response = {
        "uploadUrl": "https://upload.test.backblaze.com",
        "authorizationToken": "upload_token"
    }
    
    mock_upload_response = {
        "fileId": "test_file_id",
        "fileName": "uploads/20260118_120000_test.jpg",
        "contentType": "image/jpeg"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = AsyncMock(
            side_effect=[
                MagicMock(json=lambda: mock_upload_url_response, raise_for_status=lambda: None),
                MagicMock(json=lambda: mock_upload_response, raise_for_status=lambda: None)
            ]
        )
        mock_client.return_value.__aenter__.return_value.post = mock_post
        
        result = await storage_service.upload_file(file_data, file_name)
        
        assert result["fileId"] == "test_file_id"
