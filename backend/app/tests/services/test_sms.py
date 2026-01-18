"""
Unit tests for Twilio SMS Service
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.sms import TwilioSMSService


@pytest.fixture
def sms_service():
    """Create an SMS service instance for testing."""
    return TwilioSMSService()


@pytest.mark.asyncio
async def test_send_sms_success(sms_service):
    """Test successful SMS sending."""
    mock_response = {
        "sid": "SM123456789",
        "status": "queued",
        "to": "+966501234567",
        "from": "+18128182666",
        "date_created": "2026-01-18T12:00:00Z",
        "error_code": None,
        "error_message": None
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await sms_service.send_sms(
            to_phone="+966501234567",
            message="Test message"
        )
        
        assert result["message_sid"] == "SM123456789"
        assert result["status"] == "queued"
        assert result["to"] == "+966501234567"


@pytest.mark.asyncio
async def test_send_sms_invalid_phone_format(sms_service):
    """Test SMS sending fails with invalid phone format."""
    with pytest.raises(ValueError, match="Phone number must be in E.164 format"):
        await sms_service.send_sms(
            to_phone="0501234567",  # Missing country code
            message="Test message"
        )


@pytest.mark.asyncio
async def test_send_sms_message_too_long(sms_service):
    """Test SMS sending fails with message exceeding max length."""
    long_message = "x" * 1601  # Exceeds 1600 character limit
    
    with pytest.raises(ValueError, match="Message exceeds maximum length"):
        await sms_service.send_sms(
            to_phone="+966501234567",
            message=long_message
        )


@pytest.mark.asyncio
async def test_send_sms_with_messaging_service(sms_service):
    """Test SMS sending using messaging service SID."""
    mock_response = {
        "sid": "SM123456789",
        "status": "queued",
        "to": "+966501234567",
        "from": None,
        "messaging_service_sid": "MGaa171a12a0b31318ed0a20306a4b7dce",
        "date_created": "2026-01-18T12:00:00Z"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await sms_service.send_sms(
            to_phone="+966501234567",
            message="Test message",
            use_messaging_service=True
        )
        
        assert result["message_sid"] == "SM123456789"
        # Verify messaging service was used in the call
        call_args = mock_post.call_args
        assert "MessagingServiceSid" in call_args[1]["data"]


@pytest.mark.asyncio
async def test_send_otp_success(sms_service):
    """Test successful OTP sending."""
    mock_response = {
        "sid": "SM123456789",
        "status": "queued",
        "to": "+966501234567",
        "from": "+18128182666",
        "date_created": "2026-01-18T12:00:00Z"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await sms_service.send_otp(
            to_phone="+966501234567",
            otp_code="123456"
        )
        
        assert result["message_sid"] == "SM123456789"
        assert result["status"] == "queued"


@pytest.mark.asyncio
async def test_send_trip_reminder_success(sms_service):
    """Test successful trip reminder sending."""
    mock_response = {
        "sid": "SM123456789",
        "status": "queued",
        "to": "+966501234567",
        "from": "+18128182666",
        "date_created": "2026-01-18T12:00:00Z"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await sms_service.send_trip_reminder(
            to_phone="+966501234567",
            trip_name="Desert Safari",
            start_date="2026-02-01"
        )
        
        assert result["message_sid"] == "SM123456789"


@pytest.mark.asyncio
async def test_send_booking_confirmation_success(sms_service):
    """Test successful booking confirmation sending."""
    mock_response = {
        "sid": "SM123456789",
        "status": "queued",
        "to": "+966501234567",
        "from": "+18128182666",
        "date_created": "2026-01-18T12:00:00Z"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await sms_service.send_booking_confirmation(
            to_phone="+966501234567",
            trip_name="Desert Safari",
            booking_reference="BOOK123456"
        )
        
        assert result["message_sid"] == "SM123456789"


@pytest.mark.asyncio
async def test_get_message_status_success(sms_service):
    """Test getting message status."""
    message_sid = "SM123456789"
    mock_response = {
        "sid": message_sid,
        "status": "delivered",
        "to": "+966501234567",
        "from": "+18128182666",
        "date_sent": "2026-01-18T12:01:00Z"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await sms_service.get_message_status(message_sid)
        
        assert result["sid"] == message_sid
        assert result["status"] == "delivered"


@pytest.mark.asyncio
async def test_send_sms_without_messaging_service(sms_service):
    """Test SMS sending using direct phone number."""
    mock_response = {
        "sid": "SM123456789",
        "status": "queued",
        "to": "+966501234567",
        "from": "+18128182666",
        "date_created": "2026-01-18T12:00:00Z"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await sms_service.send_sms(
            to_phone="+966501234567",
            message="Test message",
            use_messaging_service=False
        )
        
        assert result["message_sid"] == "SM123456789"
        # Verify direct phone number was used
        call_args = mock_post.call_args
        assert "From" in call_args[1]["data"]
        assert call_args[1]["data"]["From"] == "+18128182666"
