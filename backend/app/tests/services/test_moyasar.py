"""Tests for Moyasar payment service."""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.moyasar import payment_service


class TestMoyasarPaymentService:
    """Test suite for Moyasar payment service."""
    
    @pytest.mark.asyncio
    async def test_create_payment_success(self):
        """Test successful payment creation."""
        mock_response = {
            "id": "pay_123456",
            "status": "initiated",
            "amount": 10000,  # 100.00 SAR in halalas
            "currency": "SAR",
            "description": "Test payment",
            "source": {
                "type": "creditcard",
                "company": "Visa",
                "name": "Test Card",
                "number": "4111"
            },
            "callback_url": "https://example.com/callback",
            "metadata": {"test": "data"}
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=MagicMock(
                    json=lambda: mock_response,
                    raise_for_status=lambda: None
                )
            )
            
            result = await payment_service.create_payment(
                amount=Decimal("100.00"),
                currency="SAR",
                description="Test payment",
                callback_url="https://example.com/callback",
                metadata={"test": "data"}
            )
            
            assert result["payment_id"] == "pay_123456"
            assert result["status"] == "initiated"
            assert result["amount"] == 10000
            assert result["currency"] == "SAR"
    
    @pytest.mark.asyncio
    async def test_get_payment_details(self):
        """Test retrieving payment details."""
        mock_response = {
            "id": "pay_123456",
            "status": "paid",
            "amount": 10000,
            "currency": "SAR",
            "description": "Test payment",
            "source": {"type": "creditcard"},
            "refunded": False,
            "captured": 10000,
            "fee": 300,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=MagicMock(
                    json=lambda: mock_response,
                    raise_for_status=lambda: None
                )
            )
            
            result = await payment_service.get_payment_details("pay_123456")
            
            assert result["payment_id"] == "pay_123456"
            assert result["status"] == "paid"
            assert result["amount"] == 10000
            assert result["fee"] == 300
    
    @pytest.mark.asyncio
    async def test_refund_payment_full(self):
        """Test full refund."""
        mock_response = {
            "id": "pay_123456",
            "status": "refunded",
            "amount": 10000,
            "refunded": True,
            "refunded_at": "2024-01-01T00:00:00Z"
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=MagicMock(
                    json=lambda: mock_response,
                    raise_for_status=lambda: None
                )
            )
            
            result = await payment_service.refund_payment("pay_123456")
            
            assert result["payment_id"] == "pay_123456"
            assert result["status"] == "refunded"
            assert result["refunded"] is True
    
    @pytest.mark.asyncio
    async def test_refund_payment_partial(self):
        """Test partial refund."""
        mock_response = {
            "id": "pay_123456",
            "status": "refunded",
            "amount": 5000,
            "refunded": True,
            "refunded_at": "2024-01-01T00:00:00Z"
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=MagicMock(
                    json=lambda: mock_response,
                    raise_for_status=lambda: None
                )
            )
            
            result = await payment_service.refund_payment(
                "pay_123456",
                amount=Decimal("50.00"),
                description="Partial refund"
            )
            
            assert result["payment_id"] == "pay_123456"
            assert result["amount"] == 5000
    
    @pytest.mark.asyncio
    async def test_void_payment(self):
        """Test voiding a payment."""
        mock_response = {
            "id": "pay_123456",
            "status": "voided",
            "voided_at": "2024-01-01T00:00:00Z"
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=MagicMock(
                    json=lambda: mock_response,
                    raise_for_status=lambda: None
                )
            )
            
            result = await payment_service.void_payment("pay_123456")
            
            assert result["payment_id"] == "pay_123456"
            assert result["status"] == "voided"
    
    def test_verify_webhook_signature_valid(self):
        """Test webhook signature verification with valid signature."""
        payload = '{"id":"pay_123","status":"paid"}'
        
        # Mock the webhook secret
        with patch.object(payment_service, 'webhook_secret', 'test_secret'):
            import hmac
            import hashlib
            
            expected_signature = hmac.new(
                'test_secret'.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            is_valid = payment_service.verify_webhook_signature(payload, expected_signature)
            
            assert is_valid is True
    
    def test_verify_webhook_signature_invalid(self):
        """Test webhook signature verification with invalid signature."""
        payload = '{"id":"pay_123","status":"paid"}'
        invalid_signature = "invalid_signature"
        
        with patch.object(payment_service, 'webhook_secret', 'test_secret'):
            is_valid = payment_service.verify_webhook_signature(payload, invalid_signature)
            
            assert is_valid is False
    
    def test_verify_webhook_signature_no_secret(self):
        """Test webhook signature verification without configured secret."""
        payload = '{"id":"pay_123","status":"paid"}'
        signature = "some_signature"
        
        with patch.object(payment_service, 'webhook_secret', ''):
            with pytest.raises(ValueError, match="MOYASAR_WEBHOOK_SECRET is not configured"):
                payment_service.verify_webhook_signature(payload, signature)
