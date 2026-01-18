"""
Unit tests for SendGrid Email Service
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.email import SendGridEmailService


@pytest.fixture
def email_service():
    """Create an email service instance for testing."""
    return SendGridEmailService()


@pytest.mark.asyncio
async def test_send_email_success(email_service):
    """Test successful email sending."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        result = await email_service.send_email(
            to_email="test@example.com",
            subject="Test Subject",
            html_content="<p>Test content</p>",
            text_content="Test content"
        )
        
        assert result["message_id"] == "msg_123456"
        assert result["status_code"] == 202


@pytest.mark.asyncio
async def test_send_email_with_recipient_name(email_service):
    """Test email sending with recipient name."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        result = await email_service.send_email(
            to_email="test@example.com",
            subject="Test Subject",
            html_content="<p>Test content</p>",
            to_name="John Doe"
        )
        
        assert result["message_id"] == "msg_123456"
        # Verify recipient name was included in payload
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert payload["personalizations"][0]["to"][0]["name"] == "John Doe"


@pytest.mark.asyncio
async def test_send_email_html_only(email_service):
    """Test email sending with HTML content only."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        result = await email_service.send_email(
            to_email="test@example.com",
            subject="Test Subject",
            html_content="<p>Test content</p>"
        )
        
        assert result["status_code"] == 202
        # Verify only HTML content was sent
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert len(payload["content"]) == 1
        assert payload["content"][0]["type"] == "text/html"


@pytest.mark.asyncio
async def test_send_verification_email_success(email_service):
    """Test successful verification email sending."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        result = await email_service.send_verification_email(
            to_email="test@example.com",
            to_name="John Doe",
            verification_token="abc123",
            verification_url="https://example.com/verify"
        )
        
        assert result["message_id"] == "msg_123456"
        assert result["status_code"] == 202


@pytest.mark.asyncio
async def test_send_password_reset_email_success(email_service):
    """Test successful password reset email sending."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        result = await email_service.send_password_reset_email(
            to_email="test@example.com",
            to_name="John Doe",
            reset_token="xyz789",
            reset_url="https://example.com/reset"
        )
        
        assert result["message_id"] == "msg_123456"
        assert result["status_code"] == 202


@pytest.mark.asyncio
async def test_send_booking_confirmation_email_success(email_service):
    """Test successful booking confirmation email sending."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        result = await email_service.send_booking_confirmation_email(
            to_email="test@example.com",
            to_name="John Doe",
            trip_name="Desert Safari",
            booking_reference="BOOK123456",
            start_date="2026-02-01",
            total_amount="1500 SAR"
        )
        
        assert result["message_id"] == "msg_123456"
        assert result["status_code"] == 202


@pytest.mark.asyncio
async def test_send_email_with_both_content_types(email_service):
    """Test email sending with both HTML and text content."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        result = await email_service.send_email(
            to_email="test@example.com",
            subject="Test Subject",
            html_content="<p>Test content</p>",
            text_content="Test content"
        )
        
        assert result["status_code"] == 202
        # Verify both content types were sent
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert len(payload["content"]) == 2
        assert payload["content"][0]["type"] == "text/plain"
        assert payload["content"][1]["type"] == "text/html"


@pytest.mark.asyncio
async def test_verification_email_contains_token(email_service):
    """Test that verification email contains the token in the link."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        verification_token = "test_token_123"
        await email_service.send_verification_email(
            to_email="test@example.com",
            to_name="John Doe",
            verification_token=verification_token,
            verification_url="https://example.com/verify"
        )
        
        # Verify token is in the email content
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        html_content = payload["content"][1]["value"]
        assert verification_token in html_content
        assert "https://example.com/verify?token=" in html_content


@pytest.mark.asyncio
async def test_password_reset_email_contains_token(email_service):
    """Test that password reset email contains the token in the link."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        reset_token = "reset_token_456"
        await email_service.send_password_reset_email(
            to_email="test@example.com",
            to_name="John Doe",
            reset_token=reset_token,
            reset_url="https://example.com/reset"
        )
        
        # Verify token is in the email content
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        html_content = payload["content"][1]["value"]
        assert reset_token in html_content
        assert "https://example.com/reset?token=" in html_content


@pytest.mark.asyncio
async def test_booking_confirmation_contains_details(email_service):
    """Test that booking confirmation email contains all booking details."""
    mock_headers = {"X-Message-Id": "msg_123456"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = mock_headers
        mock_response.raise_for_status = lambda: None
        
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        trip_name = "Desert Safari Adventure"
        booking_ref = "BOOK789"
        start_date = "2026-03-15"
        total_amount = "2500 SAR"
        
        await email_service.send_booking_confirmation_email(
            to_email="test@example.com",
            to_name="John Doe",
            trip_name=trip_name,
            booking_reference=booking_ref,
            start_date=start_date,
            total_amount=total_amount
        )
        
        # Verify all details are in the email content
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        html_content = payload["content"][1]["value"]
        assert trip_name in html_content
        assert booking_ref in html_content
        assert start_date in html_content
        assert total_amount in html_content
