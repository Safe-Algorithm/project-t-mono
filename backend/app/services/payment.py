"""
Checkout.com Payment Service

Provides payment processing functionality using Checkout.com API.
"""

from typing import Optional, Dict, Any
from decimal import Decimal
import httpx
from app.core.config import settings


class CheckoutPaymentService:
    """Service for processing payments via Checkout.com."""
    
    def __init__(self):
        self.secret_key = settings.CHECKOUT_SECRET_KEY
        self.public_key = settings.CHECKOUT_PUBLIC_KEY
        self.api_url = settings.CHECKOUT_API_URL
    
    async def create_payment(
        self,
        amount: Decimal,
        currency: str = "SAR",
        reference: str = "",
        customer_email: Optional[str] = None,
        customer_name: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> dict:
        """
        Create a payment request.
        
        Args:
            amount: Payment amount (will be converted to smallest currency unit)
            currency: Currency code (default: SAR for Saudi Riyal)
            reference: Payment reference (e.g., booking ID)
            customer_email: Customer email address
            customer_name: Customer name
            description: Payment description
            metadata: Additional metadata to store with payment
            
        Returns:
            dict with payment ID, status, and redirect URL
        """
        # Convert amount to smallest currency unit (e.g., SAR to halalas)
        amount_in_minor = int(amount * 100)
        
        # Prepare payment payload
        payload = {
            "source": {
                "type": "card"
            },
            "amount": amount_in_minor,
            "currency": currency,
            "reference": reference,
            "capture": True,  # Auto-capture payment
            "3ds": {
                "enabled": True  # Enable 3D Secure
            }
        }
        
        # Add customer information if provided
        if customer_email or customer_name:
            payload["customer"] = {}
            if customer_email:
                payload["customer"]["email"] = customer_email
            if customer_name:
                payload["customer"]["name"] = customer_name
        
        # Add description if provided
        if description:
            payload["description"] = description
        
        # Add metadata if provided
        if metadata:
            payload["metadata"] = metadata
        
        # Create payment via Checkout.com API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/payments",
                headers={
                    "Authorization": self.secret_key,
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
            "approved": result.get("approved"),
            "reference": result.get("reference"),
            "amount": result.get("amount"),
            "currency": result.get("currency"),
            "redirect_url": result.get("_links", {}).get("redirect", {}).get("href")
        }
    
    async def get_payment_details(self, payment_id: str) -> dict:
        """
        Get payment details by payment ID.
        
        Args:
            payment_id: Checkout.com payment ID
            
        Returns:
            dict with payment details
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/payments/{payment_id}",
                headers={
                    "Authorization": self.secret_key
                },
                timeout=30.0
            )
            response.raise_for_status()
        
        return response.json()
    
    async def capture_payment(
        self,
        payment_id: str,
        amount: Optional[Decimal] = None,
        reference: Optional[str] = None
    ) -> dict:
        """
        Capture a previously authorized payment.
        
        Args:
            payment_id: Checkout.com payment ID
            amount: Amount to capture (if partial capture)
            reference: Capture reference
            
        Returns:
            dict with capture confirmation
        """
        payload = {}
        
        if amount:
            payload["amount"] = int(amount * 100)
        
        if reference:
            payload["reference"] = reference
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/payments/{payment_id}/captures",
                headers={
                    "Authorization": self.secret_key,
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
        
        return response.json()
    
    async def refund_payment(
        self,
        payment_id: str,
        amount: Optional[Decimal] = None,
        reference: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> dict:
        """
        Refund a payment (full or partial).
        
        Args:
            payment_id: Checkout.com payment ID
            amount: Amount to refund (if partial refund, otherwise full refund)
            reference: Refund reference
            metadata: Additional metadata
            
        Returns:
            dict with refund confirmation
        """
        payload = {}
        
        if amount:
            payload["amount"] = int(amount * 100)
        
        if reference:
            payload["reference"] = reference
        
        if metadata:
            payload["metadata"] = metadata
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/payments/{payment_id}/refunds",
                headers={
                    "Authorization": self.secret_key,
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
        
        result = response.json()
        
        return {
            "refund_id": result.get("action_id"),
            "payment_id": payment_id,
            "amount": result.get("amount"),
            "currency": result.get("currency"),
            "reference": result.get("reference"),
            "status": "refunded"
        }
    
    async def void_payment(
        self,
        payment_id: str,
        reference: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> dict:
        """
        Void an authorized payment (before capture).
        
        Args:
            payment_id: Checkout.com payment ID
            reference: Void reference
            metadata: Additional metadata
            
        Returns:
            dict with void confirmation
        """
        payload = {}
        
        if reference:
            payload["reference"] = reference
        
        if metadata:
            payload["metadata"] = metadata
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/payments/{payment_id}/voids",
                headers={
                    "Authorization": self.secret_key,
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
        
        return response.json()
    
    def verify_webhook_signature(
        self,
        payload: str,
        signature: str,
        secret: str
    ) -> bool:
        """
        Verify webhook signature from Checkout.com.
        
        Args:
            payload: Raw webhook payload
            signature: Signature from Cko-Signature header
            secret: Webhook secret key
            
        Returns:
            bool indicating if signature is valid
        """
        import hmac
        import hashlib
        
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)


# Singleton instance
payment_service = CheckoutPaymentService()
