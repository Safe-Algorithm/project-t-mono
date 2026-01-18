"""
Unit tests for Checkout.com Payment Service
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.payment import CheckoutPaymentService


@pytest.fixture
def payment_service():
    """Create a payment service instance for testing."""
    return CheckoutPaymentService()


@pytest.mark.asyncio
async def test_create_payment_success(payment_service):
    """Test successful payment creation."""
    mock_response = {
        "id": "pay_123456",
        "status": "Pending",
        "approved": False,
        "reference": "BOOK123",
        "amount": 150000,  # 1500.00 SAR in halalas
        "currency": "SAR",
        "_links": {
            "redirect": {
                "href": "https://checkout.com/redirect/pay_123456"
            }
        }
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await payment_service.create_payment(
            amount=Decimal("1500.00"),
            currency="SAR",
            reference="BOOK123",
            customer_email="test@example.com",
            customer_name="John Doe"
        )
        
        assert result["payment_id"] == "pay_123456"
        assert result["status"] == "Pending"
        assert result["amount"] == 150000
        assert result["currency"] == "SAR"
        assert "redirect_url" in result


@pytest.mark.asyncio
async def test_create_payment_with_metadata(payment_service):
    """Test payment creation with metadata."""
    mock_response = {
        "id": "pay_123456",
        "status": "Pending",
        "approved": False,
        "reference": "BOOK123",
        "amount": 150000,
        "currency": "SAR",
        "_links": {}
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        metadata = {
            "trip_id": "trip_789",
            "registration_id": "reg_456"
        }
        
        result = await payment_service.create_payment(
            amount=Decimal("1500.00"),
            currency="SAR",
            reference="BOOK123",
            metadata=metadata
        )
        
        assert result["payment_id"] == "pay_123456"
        # Verify metadata was included in the request
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert "metadata" in payload
        assert payload["metadata"]["trip_id"] == "trip_789"


@pytest.mark.asyncio
async def test_create_payment_amount_conversion(payment_service):
    """Test that payment amount is correctly converted to minor units."""
    mock_response = {
        "id": "pay_123456",
        "status": "Pending",
        "approved": False,
        "reference": "BOOK123",
        "amount": 250050,  # 2500.50 SAR in halalas
        "currency": "SAR",
        "_links": {}
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        await payment_service.create_payment(
            amount=Decimal("2500.50"),
            currency="SAR",
            reference="BOOK123"
        )
        
        # Verify amount was converted correctly
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert payload["amount"] == 250050


@pytest.mark.asyncio
async def test_get_payment_details_success(payment_service):
    """Test getting payment details."""
    payment_id = "pay_123456"
    mock_response = {
        "id": payment_id,
        "status": "Authorized",
        "approved": True,
        "amount": 150000,
        "currency": "SAR",
        "reference": "BOOK123"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await payment_service.get_payment_details(payment_id)
        
        assert result["id"] == payment_id
        assert result["status"] == "Authorized"
        assert result["approved"] is True


@pytest.mark.asyncio
async def test_capture_payment_success(payment_service):
    """Test successful payment capture."""
    payment_id = "pay_123456"
    mock_response = {
        "action_id": "act_789",
        "reference": "CAPTURE_123"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await payment_service.capture_payment(
            payment_id=payment_id,
            reference="CAPTURE_123"
        )
        
        assert result["action_id"] == "act_789"


@pytest.mark.asyncio
async def test_capture_payment_partial(payment_service):
    """Test partial payment capture."""
    payment_id = "pay_123456"
    mock_response = {
        "action_id": "act_789",
        "amount": 100000,
        "reference": "PARTIAL_CAPTURE"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await payment_service.capture_payment(
            payment_id=payment_id,
            amount=Decimal("1000.00"),
            reference="PARTIAL_CAPTURE"
        )
        
        # Verify partial amount was sent
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert payload["amount"] == 100000


@pytest.mark.asyncio
async def test_refund_payment_success(payment_service):
    """Test successful payment refund."""
    payment_id = "pay_123456"
    mock_response = {
        "action_id": "ref_789",
        "amount": 150000,
        "currency": "SAR",
        "reference": "REFUND_123"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await payment_service.refund_payment(
            payment_id=payment_id,
            reference="REFUND_123"
        )
        
        assert result["refund_id"] == "ref_789"
        assert result["payment_id"] == payment_id
        assert result["status"] == "refunded"


@pytest.mark.asyncio
async def test_refund_payment_partial(payment_service):
    """Test partial payment refund."""
    payment_id = "pay_123456"
    mock_response = {
        "action_id": "ref_789",
        "amount": 50000,
        "currency": "SAR",
        "reference": "PARTIAL_REFUND"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await payment_service.refund_payment(
            payment_id=payment_id,
            amount=Decimal("500.00"),
            reference="PARTIAL_REFUND"
        )
        
        # Verify partial amount was sent
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert payload["amount"] == 50000


@pytest.mark.asyncio
async def test_void_payment_success(payment_service):
    """Test successful payment void."""
    payment_id = "pay_123456"
    mock_response = {
        "action_id": "void_789",
        "reference": "VOID_123"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        result = await payment_service.void_payment(
            payment_id=payment_id,
            reference="VOID_123"
        )
        
        assert result["action_id"] == "void_789"


@pytest.mark.asyncio
async def test_void_payment_with_metadata(payment_service):
    """Test payment void with metadata."""
    payment_id = "pay_123456"
    mock_response = {
        "action_id": "void_789",
        "reference": "VOID_123"
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        metadata = {"reason": "customer_request"}
        
        result = await payment_service.void_payment(
            payment_id=payment_id,
            reference="VOID_123",
            metadata=metadata
        )
        
        # Verify metadata was included
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert "metadata" in payload
        assert payload["metadata"]["reason"] == "customer_request"


def test_verify_webhook_signature_valid(payment_service):
    """Test webhook signature verification with valid signature."""
    payload = '{"event": "payment.captured"}'
    secret = "webhook_secret_key"
    
    import hmac
    import hashlib
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    result = payment_service.verify_webhook_signature(
        payload=payload,
        signature=expected_signature,
        secret=secret
    )
    
    assert result is True


def test_verify_webhook_signature_invalid(payment_service):
    """Test webhook signature verification with invalid signature."""
    payload = '{"event": "payment.captured"}'
    secret = "webhook_secret_key"
    invalid_signature = "invalid_signature_123"
    
    result = payment_service.verify_webhook_signature(
        payload=payload,
        signature=invalid_signature,
        secret=secret
    )
    
    assert result is False


@pytest.mark.asyncio
async def test_create_payment_with_description(payment_service):
    """Test payment creation with description."""
    mock_response = {
        "id": "pay_123456",
        "status": "Pending",
        "approved": False,
        "reference": "BOOK123",
        "amount": 150000,
        "currency": "SAR",
        "_links": {}
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        description = "Payment for Desert Safari trip"
        
        result = await payment_service.create_payment(
            amount=Decimal("1500.00"),
            currency="SAR",
            reference="BOOK123",
            description=description
        )
        
        # Verify description was included
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert "description" in payload
        assert payload["description"] == description


@pytest.mark.asyncio
async def test_create_payment_enables_3ds(payment_service):
    """Test that 3D Secure is enabled by default."""
    mock_response = {
        "id": "pay_123456",
        "status": "Pending",
        "approved": False,
        "reference": "BOOK123",
        "amount": 150000,
        "currency": "SAR",
        "_links": {}
    }
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_post = mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                json=lambda: mock_response,
                raise_for_status=lambda: None
            )
        )
        
        await payment_service.create_payment(
            amount=Decimal("1500.00"),
            currency="SAR",
            reference="BOOK123"
        )
        
        # Verify 3DS is enabled
        call_args = mock_post.call_args
        payload = call_args[1]["json"]
        assert "3ds" in payload
        assert payload["3ds"]["enabled"] is True
