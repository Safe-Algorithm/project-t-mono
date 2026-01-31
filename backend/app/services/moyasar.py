"""
Moyasar Payment Service

Provides payment processing functionality using Moyasar API.
Moyasar is a Saudi Arabian payment gateway supporting Mada, Visa, Mastercard, Apple Pay, and STC Pay.
"""

from typing import Optional, Dict, Any
from decimal import Decimal
import httpx
import hmac
import hashlib
import base64
from app.core.config import settings


class MoyasarPaymentService:
    """Service for processing payments via Moyasar."""
    
    def __init__(self):
        self.api_key = settings.MOYASAR_API_KEY
        self.api_url = settings.MOYASAR_API_URL
        self.webhook_secret = settings.MOYASAR_WEBHOOK_SECRET
    
    def _get_auth_header(self) -> str:
        """Generate Basic Auth header for Moyasar API."""
        credentials = f"{self.api_key}:"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"
    
    async def create_payment(
        self,
        amount: Decimal,
        currency: str = "SAR",
        description: str = "",
        callback_url: str = "",
        source_type: str = "creditcard",
        metadata: Optional[Dict[str, Any]] = None
    ) -> dict:
        """
        Create a payment request.
        
        Args:
            amount: Payment amount in SAR (e.g., 100.50)
            currency: Currency code (default: SAR for Saudi Riyal)
            description: Payment description
            callback_url: URL to redirect after payment
            source_type: Payment method type (creditcard, applepay, stcpay)
            metadata: Additional metadata to store with payment
            
        Returns:
            dict with payment ID, status, and source URL
        """
        # Convert amount to smallest currency unit (halalas for SAR)
        amount_in_minor = int(amount * 100)
        
        # Prepare payment payload
        payload = {
            "amount": amount_in_minor,
            "currency": currency,
            "description": description,
            "callback_url": callback_url,
            "source": {
                "type": source_type
            }
        }
        
        # Add metadata if provided
        if metadata:
            payload["metadata"] = metadata
        
        # Create payment via Moyasar API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/payments",
                headers={
                    "Authorization": self._get_auth_header(),
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
        
        result = response.json()
        
        return {
            "payment_id": result.get("id"),
            "status": result.get("status"),
            "amount": result.get("amount"),
            "currency": result.get("currency"),
            "description": result.get("description"),
            "source": result.get("source"),
            "callback_url": result.get("callback_url"),
            "metadata": result.get("metadata")
        }
    
    async def get_payment_details(self, payment_id: str) -> dict:
        """
        Get payment details by payment ID.
        
        Args:
            payment_id: Moyasar payment ID
            
        Returns:
            dict with payment details
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/payments/{payment_id}",
                headers={
                    "Authorization": self._get_auth_header()
                },
                timeout=30.0
            )
            response.raise_for_status()
        
        result = response.json()
        
        return {
            "payment_id": result.get("id"),
            "status": result.get("status"),
            "amount": result.get("amount"),
            "currency": result.get("currency"),
            "description": result.get("description"),
            "source": result.get("source"),
            "refunded": result.get("refunded"),
            "refunded_at": result.get("refunded_at"),
            "captured": result.get("captured"),
            "captured_at": result.get("captured_at"),
            "voided_at": result.get("voided_at"),
            "metadata": result.get("metadata"),
            "fee": result.get("fee"),
            "created_at": result.get("created_at"),
            "updated_at": result.get("updated_at")
        }
    
    async def refund_payment(
        self,
        payment_id: str,
        amount: Optional[Decimal] = None,
        description: Optional[str] = None
    ) -> dict:
        """
        Refund a payment (full or partial).
        
        Args:
            payment_id: Moyasar payment ID
            amount: Amount to refund in SAR (if partial refund, otherwise full refund)
            description: Refund description
            
        Returns:
            dict with refund confirmation
        """
        payload = {}
        
        if amount:
            payload["amount"] = int(amount * 100)
        
        if description:
            payload["description"] = description
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/payments/{payment_id}/refund",
                headers={
                    "Authorization": self._get_auth_header(),
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
        
        result = response.json()
        
        return {
            "payment_id": result.get("id"),
            "status": result.get("status"),
            "amount": result.get("amount"),
            "refunded": result.get("refunded"),
            "refunded_at": result.get("refunded_at")
        }
    
    async def void_payment(self, payment_id: str) -> dict:
        """
        Void an authorized payment (before capture).
        
        Args:
            payment_id: Moyasar payment ID
            
        Returns:
            dict with void confirmation
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/payments/{payment_id}/void",
                headers={
                    "Authorization": self._get_auth_header(),
                    "Content-Type": "application/json"
                },
                timeout=30.0
            )
            response.raise_for_status()
        
        result = response.json()
        
        return {
            "payment_id": result.get("id"),
            "status": result.get("status"),
            "voided_at": result.get("voided_at")
        }
    
    def verify_webhook_signature(
        self,
        payload: str,
        signature: str
    ) -> bool:
        """
        Verify webhook signature from Moyasar.
        
        Moyasar uses HMAC-SHA256 for webhook signature verification.
        
        Args:
            payload: Raw webhook payload (JSON string)
            signature: Signature from X-Moyasar-Signature header
            
        Returns:
            bool indicating if signature is valid
        """
        if not self.webhook_secret:
            raise ValueError("MOYASAR_WEBHOOK_SECRET is not configured")
        
        expected_signature = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)


# Singleton instance
payment_service = MoyasarPaymentService()
