"""
Backblaze B2 Object Storage Service

Provides file upload, download, and deletion functionality using Backblaze B2.
"""

import hashlib
import mimetypes
import asyncio
from typing import Optional, BinaryIO
from datetime import datetime
import httpx
from app.core.config import settings


class BackblazeStorageService:
    """Service for interacting with Backblaze B2 object storage."""
    
    def __init__(self):
        self.key_id = settings.BACKBLAZE_KEY_ID
        self.application_key = settings.BACKBLAZE_APPLICATION_KEY
        self.bucket_name = settings.BACKBLAZE_BUCKET_NAME
        self.bucket_id = settings.BACKBLAZE_BUCKET_ID
        
        # Authorization data (cached after first auth)
        self._auth_token: Optional[str] = None
        self._api_url: Optional[str] = None
        self._download_url: Optional[str] = None
    
    async def _retry_with_backoff(self, func, max_retries: int = 3):
        """
        Retry a function with exponential backoff for transient errors.
        Handles DNS resolution errors and network timeouts.
        """
        for attempt in range(max_retries):
            try:
                return await func()
            except (httpx.ConnectError, httpx.TimeoutException, OSError) as e:
                if attempt == max_retries - 1:
                    raise
                # Exponential backoff: 1s, 2s, 4s
                wait_time = 2 ** attempt
                print(f"Network error (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
            except Exception as e:
                # Don't retry on other errors (auth, validation, etc.)
                raise
        
    async def _authorize(self) -> dict:
        """
        Authorize with Backblaze B2 API.
        Returns authorization data including auth token and API URL.
        """
        if not self.application_key:
            raise ValueError("BACKBLAZE_APPLICATION_KEY not configured")
            
        auth_url = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"
        
        async def _do_auth():
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    auth_url,
                    auth=(self.key_id, self.application_key)
                )
                response.raise_for_status()
                return response.json()
        
        data = await self._retry_with_backoff(_do_auth)
        self._auth_token = data["authorizationToken"]
        self._api_url = data["apiUrl"]
        self._download_url = data["downloadUrl"]
        
        return data
    
    async def _get_upload_url(self) -> dict:
        """Get upload URL for the configured bucket."""
        if not self._auth_token:
            await self._authorize()
            
        if not self.bucket_id:
            raise ValueError("BACKBLAZE_BUCKET_ID not configured")
        
        async def _do_get_url():
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self._api_url}/b2api/v2/b2_get_upload_url",
                    headers={"Authorization": self._auth_token},
                    json={"bucketId": self.bucket_id}
                )
                response.raise_for_status()
                return response.json()
        
        return await self._retry_with_backoff(_do_get_url)
    
    async def upload_file(
        self,
        file_data: bytes,
        file_name: str,
        content_type: Optional[str] = None,
        folder: str = "uploads"
    ) -> dict:
        """
        Upload a file to Backblaze B2.
        
        Args:
            file_data: Binary file data
            file_name: Name of the file
            content_type: MIME type (auto-detected if not provided)
            folder: Folder/prefix for the file
            
        Returns:
            dict with file info including fileId, fileName, and downloadUrl
        """
        # Auto-detect content type if not provided
        if not content_type:
            content_type, _ = mimetypes.guess_type(file_name)
            if not content_type:
                content_type = "application/octet-stream"
        
        # Generate unique file name with timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_name = f"{folder}/{timestamp}_{file_name}"
        
        # Calculate SHA1 hash
        sha1_hash = hashlib.sha1(file_data).hexdigest()
        
        # Get upload URL
        upload_data = await self._get_upload_url()
        upload_url = upload_data["uploadUrl"]
        upload_auth_token = upload_data["authorizationToken"]
        
        # Upload file with retry logic
        async def _do_upload():
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    upload_url,
                    headers={
                        "Authorization": upload_auth_token,
                        "X-Bz-File-Name": unique_name,
                        "Content-Type": content_type,
                        "X-Bz-Content-Sha1": sha1_hash,
                    },
                    content=file_data
                )
                response.raise_for_status()
                return response.json()
        
        file_info = await self._retry_with_backoff(_do_upload)
        
        # Add download URL
        file_info["downloadUrl"] = f"{self._download_url}/file/{self.bucket_name}/{unique_name}"
        
        return file_info
    
    async def delete_file(self, file_id: str, file_name: str) -> dict:
        """
        Delete a file from Backblaze B2.
        
        Args:
            file_id: Backblaze file ID
            file_name: Name of the file
            
        Returns:
            dict with deletion confirmation
        """
        if not self._auth_token:
            await self._authorize()
        
        async def _do_delete():
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self._api_url}/b2api/v2/b2_delete_file_version",
                    headers={"Authorization": self._auth_token},
                    json={
                        "fileId": file_id,
                        "fileName": file_name
                    }
                )
                response.raise_for_status()
                return response.json()
        
        return await self._retry_with_backoff(_do_delete)
    
    async def get_file_info(self, file_id: str) -> dict:
        """
        Get information about a file.
        
        Args:
            file_id: Backblaze file ID
            
        Returns:
            dict with file information
        """
        if not self._auth_token:
            await self._authorize()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._api_url}/b2api/v2/b2_get_file_info",
                headers={"Authorization": self._auth_token},
                json={"fileId": file_id}
            )
            response.raise_for_status()
        
        return response.json()


# Singleton instance
storage_service = BackblazeStorageService()
