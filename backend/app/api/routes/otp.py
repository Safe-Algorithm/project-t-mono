"""
Phone OTP Verification Routes

Handles sending and verifying OTP codes for phone number verification.
"""

import secrets
import json
import logging
from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from pydantic import BaseModel, Field

from app.api import deps
from app.core.redis import redis_client
from app.core.config import settings
from app.models.user import User
from app.services.sms import sms_service
from app.services.email import email_service
from app import crud

router = APIRouter()
logger = logging.getLogger(__name__)


class SendOTPRequest(BaseModel):
    phone: str = Field(..., description="Phone number in E.164 format (e.g., +966501234567)")


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., description="Phone number in E.164 format")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")


class OTPResponse(BaseModel):
    message: str
    expires_in: int = Field(..., description="Expiry time in seconds")


@router.post("/send-otp", response_model=OTPResponse)
async def send_otp(
    request: SendOTPRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_user),
    session: Session = Depends(deps.get_session),
):
    """
    Send OTP code to user's phone number.
    Rate limited based on OTP_MAX_ATTEMPTS and OTP_TIME_WINDOW_SECONDS settings.
    """
    phone = request.phone
    
    # Validate phone format
    if not phone.startswith('+'):
        raise HTTPException(
            status_code=400,
            detail="Phone number must be in E.164 format (e.g., +966501234567)"
        )
    
    # Check rate limiting
    rate_limit_key = f"otp_rate_limit:{phone}"
    attempts = redis_client.get(rate_limit_key)
    
    if attempts and int(attempts) >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many OTP requests. Please try again in {settings.OTP_TIME_WINDOW_SECONDS // 60} minutes."
        )
    
    # Generate 6-digit OTP
    otp_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Store OTP in Redis with configurable expiry
    otp_key = f"phone_otp:{phone}"
    otp_data = {
        "otp": otp_code,
        "user_id": str(current_user.id),
        "created_at": datetime.utcnow().isoformat()
    }
    redis_client.setex(otp_key, settings.OTP_EXPIRY_SECONDS, json.dumps(otp_data))
    
    # Update rate limit counter
    if attempts:
        redis_client.incr(rate_limit_key)
    else:
        redis_client.setex(rate_limit_key, 60 * 60, 1)  # 1 hour expiry
    
    # Send OTP via SMS in background
    background_tasks.add_task(sms_service.send_otp, phone, otp_code)
    
    return OTPResponse(
        message="OTP sent successfully",
        expires_in=300  # 5 minutes
    )


@router.post("/verify-otp")
async def verify_otp(
    request: VerifyOTPRequest,
    current_user: User = Depends(deps.get_current_active_user),
    session: Session = Depends(deps.get_session),
):
    """
    Verify OTP code and mark phone as verified.
    """
    phone = request.phone
    otp = request.otp
    
    # Get OTP from Redis
    otp_key = f"phone_otp:{phone}"
    otp_data_str = redis_client.get(otp_key)
    
    if not otp_data_str:
        raise HTTPException(
            status_code=400,
            detail="OTP expired or not found. Please request a new OTP."
        )
    
    # Parse OTP data
    if isinstance(otp_data_str, bytes):
        otp_data = json.loads(otp_data_str.decode())
    else:
        otp_data = json.loads(otp_data_str)
    
    # Verify OTP matches
    if otp_data["otp"] != otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP code"
        )
    
    # Verify user matches
    if otp_data["user_id"] != str(current_user.id):
        raise HTTPException(
            status_code=403,
            detail="OTP does not belong to this user"
        )
    
    # Update user's phone and mark as verified
    current_user.phone = phone
    current_user.is_phone_verified = True
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    
    # Delete OTP from Redis
    redis_client.delete(otp_key)
    
    # Clear rate limit for this phone
    rate_limit_key = f"otp_rate_limit:{phone}"
    redis_client.delete(rate_limit_key)
    
    return {
        "message": "Phone number verified successfully",
        "phone": phone,
        "is_phone_verified": True
    }


@router.post("/send-otp-registration", response_model=OTPResponse)
async def send_otp_for_registration(
    request: SendOTPRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(deps.get_session),
):
    """
    Send OTP for phone verification during registration (no authentication required).
    This is used when registering with phone number.
    """
    phone = request.phone
    
    # Validate phone format
    if not phone.startswith('+'):
        raise HTTPException(
            status_code=400,
            detail="Phone number must be in E.164 format (e.g., +966501234567)"
        )
    
    # Check rate limiting
    rate_limit_key = f"otp_rate_limit:{phone}"
    attempts = redis_client.get(rate_limit_key)
    
    if attempts and int(attempts) >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many OTP requests. Please try again in {settings.OTP_TIME_WINDOW_SECONDS // 60} minutes."
        )
    
    # Generate 6-digit OTP
    otp_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Store OTP in Redis with configurable expiry
    otp_key = f"phone_otp_registration:{phone}"
    otp_data = {
        "otp": otp_code,
        "created_at": datetime.utcnow().isoformat()
    }
    redis_client.setex(otp_key, settings.OTP_EXPIRY_SECONDS, json.dumps(otp_data))
    
    # Update rate limit counter
    if attempts:
        redis_client.incr(rate_limit_key)
    else:
        redis_client.setex(rate_limit_key, settings.OTP_TIME_WINDOW_SECONDS, 1)
    
    # Send OTP via SMS in background
    background_tasks.add_task(sms_service.send_otp, phone, otp_code)
    
    return OTPResponse(
        message="OTP sent successfully",
        expires_in=settings.OTP_EXPIRY_SECONDS
    )


@router.post("/verify-otp-registration")
async def verify_otp_for_registration(
    request: VerifyOTPRequest,
    session: Session = Depends(deps.get_session),
):
    """
    Verify OTP code during registration (no authentication required).
    Returns a temporary token that can be used to complete registration.
    """
    phone = request.phone
    otp = request.otp
    
    # Get OTP from Redis
    otp_key = f"phone_otp_registration:{phone}"
    otp_data_str = redis_client.get(otp_key)
    
    if not otp_data_str:
        raise HTTPException(
            status_code=400,
            detail="OTP expired or not found. Please request a new OTP."
        )
    
    # Parse OTP data
    if isinstance(otp_data_str, bytes):
        otp_data = json.loads(otp_data_str.decode())
    else:
        otp_data = json.loads(otp_data_str)
    
    # Verify OTP matches
    if otp_data["otp"] != otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP code"
        )
    
    # Generate verification token for registration completion
    verification_token = secrets.token_urlsafe(32)
    verification_key = f"phone_verified:{verification_token}"
    verification_data = {
        "phone": phone,
        "verified_at": datetime.utcnow().isoformat()
    }
    
    # Store with expiry
    expiry_seconds = settings.OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS
    redis_client.setex(verification_key, expiry_seconds, json.dumps(verification_data))
    
    # Delete OTP from Redis
    redis_client.delete(otp_key)
    
    # Clear rate limit for this phone
    rate_limit_key = f"otp_rate_limit:{phone}"
    redis_client.delete(rate_limit_key)
    
    return {
        "message": "Phone number verified successfully",
        "verification_token": verification_token,
        "phone": phone,
        "expires_in": expiry_seconds
    }


class SendEmailOTPRequest(BaseModel):
    email: str = Field(..., description="Email address")


class VerifyEmailOTPRequest(BaseModel):
    email: str = Field(..., description="Email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")


@router.post("/send-email-otp-registration", response_model=OTPResponse)
async def send_email_otp_for_registration(
    request: SendEmailOTPRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(deps.get_session),
):
    """
    Send OTP to email for registration (no authentication required).
    This is used when registering with email address.
    """
    email = request.email
    
    # Check rate limiting
    rate_limit_key = f"otp_rate_limit:{email}"
    attempts = redis_client.get(rate_limit_key)
    
    if attempts and int(attempts) >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many OTP requests. Please try again in {settings.OTP_TIME_WINDOW_SECONDS // 60} minutes."
        )
    
    # Generate 6-digit OTP
    otp_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Store OTP in Redis with configurable expiry
    otp_key = f"email_otp_registration:{email}"
    otp_data = {
        "otp": otp_code,
        "created_at": datetime.utcnow().isoformat()
    }
    redis_client.setex(otp_key, settings.OTP_EXPIRY_SECONDS, json.dumps(otp_data))
    
    # Update rate limit counter
    if attempts:
        redis_client.incr(rate_limit_key)
    else:
        redis_client.setex(rate_limit_key, settings.OTP_TIME_WINDOW_SECONDS, 1)
    
    # Send OTP via email in background
    background_tasks.add_task(
        email_service.send_otp_email,
        to_email=email,
        otp_code=otp_code
    )
    
    return OTPResponse(
        message="OTP sent successfully to your email",
        expires_in=settings.OTP_EXPIRY_SECONDS
    )


@router.post("/verify-email-otp-registration")
async def verify_email_otp_for_registration(
    request: VerifyEmailOTPRequest,
    session: Session = Depends(deps.get_session),
):
    """
    Verify email OTP code during registration (no authentication required).
    Returns a temporary token that can be used to complete registration.
    """
    email = request.email
    otp = request.otp
    
    # Get OTP from Redis
    otp_key = f"email_otp_registration:{email}"
    otp_data_str = redis_client.get(otp_key)
    
    if not otp_data_str:
        raise HTTPException(
            status_code=400,
            detail="OTP expired or not found. Please request a new OTP."
        )
    
    # Parse OTP data
    if isinstance(otp_data_str, bytes):
        otp_data = json.loads(otp_data_str.decode())
    else:
        otp_data = json.loads(otp_data_str)
    
    # Verify OTP matches
    if otp_data["otp"] != otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP code"
        )
    
    # Generate verification token for registration completion
    verification_token = secrets.token_urlsafe(32)
    verification_key = f"email_verified:{verification_token}"
    verification_data = {
        "email": email,
        "verified_at": datetime.utcnow().isoformat()
    }
    redis_client.setex(verification_key, settings.OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS, json.dumps(verification_data))
    
    # Delete OTP from Redis
    redis_client.delete(otp_key)
    
    # Clear rate limit for this email
    rate_limit_key = f"otp_rate_limit:{email}"
    redis_client.delete(rate_limit_key)
    
    return {
        "message": "Email verified successfully",
        "verification_token": verification_token,
        "email": email,
        "expires_in": settings.OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS
    }


@router.post("/send-password-reset-otp", response_model=OTPResponse)
async def send_password_reset_otp(
    request: SendEmailOTPRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(deps.get_session),
):
    """
    Send OTP for password reset (no authentication required).
    User must exist in the system.
    """
    email = request.email
    
    # Check if user exists with this email
    user = crud.user.get_user_by_email(session, email=email)
    if not user:
        # Don't reveal if email exists or not for security
        return OTPResponse(
            message="If an account exists with this email, an OTP has been sent",
            expires_in=settings.OTP_EXPIRY_SECONDS
        )
    
    # Check rate limiting
    rate_limit_key = f"otp_rate_limit:{email}"
    attempts = redis_client.get(rate_limit_key)
    
    if attempts and int(attempts) >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many OTP requests. Please try again in {settings.OTP_TIME_WINDOW_SECONDS // 60} minutes."
        )
    
    # Generate 6-digit OTP
    otp_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Store OTP in Redis
    otp_key = f"password_reset_otp:{email}"
    otp_data = {
        "otp": otp_code,
        "user_id": str(user.id),
        "created_at": datetime.utcnow().isoformat()
    }
    redis_client.setex(otp_key, settings.OTP_EXPIRY_SECONDS, json.dumps(otp_data))
    
    # Update rate limit counter
    if attempts:
        redis_client.incr(rate_limit_key)
    else:
        redis_client.setex(rate_limit_key, settings.OTP_TIME_WINDOW_SECONDS, 1)
    
    # Send OTP via email in background
    background_tasks.add_task(
        email_service.send_otp_email,
        to_email=email,
        otp_code=otp_code,
        to_name=user.name
    )
    
    return OTPResponse(
        message="If an account exists with this email, an OTP has been sent",
        expires_in=settings.OTP_EXPIRY_SECONDS
    )


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., description="Email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")
    new_password: str = Field(..., min_length=8, description="New password")


@router.post("/reset-password")
async def reset_password_with_otp(
    request: ResetPasswordRequest,
    session: Session = Depends(deps.get_session),
):
    """
    Reset password using OTP verification (no authentication required).
    """
    email = request.email
    otp = request.otp
    new_password = request.new_password
    
    # Get OTP from Redis
    otp_key = f"password_reset_otp:{email}"
    otp_data_str = redis_client.get(otp_key)
    
    if not otp_data_str:
        raise HTTPException(
            status_code=400,
            detail="OTP expired or not found. Please request a new OTP."
        )
    
    # Parse OTP data
    if isinstance(otp_data_str, bytes):
        otp_data = json.loads(otp_data_str.decode())
    else:
        otp_data = json.loads(otp_data_str)
    
    # Verify OTP matches
    if otp_data["otp"] != otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP code"
        )
    
    # Get user
    user = crud.user.get_user_by_email(session, email=email)
    if not user or str(user.id) != otp_data["user_id"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid request"
        )
    
    # Update password
    user.hashed_password = crud.user.get_password_hash(new_password)
    session.add(user)
    session.commit()
    
    # Delete OTP from Redis
    redis_client.delete(otp_key)
    
    # Clear rate limit
    rate_limit_key = f"otp_rate_limit:{email}"
    redis_client.delete(rate_limit_key)
    
    return {
        "message": "Password reset successfully"
    }


@router.post("/send-email-change-otp", response_model=OTPResponse)
async def send_email_change_otp(
    request: SendEmailOTPRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_user),
    session: Session = Depends(deps.get_session),
):
    """
    Send OTP to new email for email change verification (authentication required).
    """
    new_email = request.email
    
    # Check if email is already in use
    existing_user = crud.user.get_user_by_email(session, email=new_email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already in use"
        )
    
    # Check rate limiting
    rate_limit_key = f"otp_rate_limit:{new_email}"
    attempts = redis_client.get(rate_limit_key)
    
    if attempts and int(attempts) >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many OTP requests. Please try again in {settings.OTP_TIME_WINDOW_SECONDS // 60} minutes."
        )
    
    # Generate 6-digit OTP
    otp_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    
    # Store OTP in Redis
    otp_key = f"email_change_otp:{current_user.id}:{new_email}"
    otp_data = {
        "otp": otp_code,
        "user_id": str(current_user.id),
        "new_email": new_email,
        "created_at": datetime.utcnow().isoformat()
    }
    redis_client.setex(otp_key, settings.OTP_EXPIRY_SECONDS, json.dumps(otp_data))
    
    # Update rate limit counter
    if attempts:
        redis_client.incr(rate_limit_key)
    else:
        redis_client.setex(rate_limit_key, settings.OTP_TIME_WINDOW_SECONDS, 1)
    
    # Send OTP via email in background
    background_tasks.add_task(
        email_service.send_otp_email,
        to_email=new_email,
        otp_code=otp_code,
        to_name=current_user.name
    )
    
    return OTPResponse(
        message="OTP sent to new email address",
        expires_in=settings.OTP_EXPIRY_SECONDS
    )


class VerifyEmailChangeRequest(BaseModel):
    new_email: str = Field(..., description="New email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")


@router.post("/verify-email-change")
async def verify_email_change(
    request: VerifyEmailChangeRequest,
    current_user: User = Depends(deps.get_current_active_user),
    session: Session = Depends(deps.get_session),
):
    """
    Verify OTP and change user's email address (authentication required).
    """
    new_email = request.new_email
    otp = request.otp
    
    # Get OTP from Redis
    otp_key = f"email_change_otp:{current_user.id}:{new_email}"
    otp_data_str = redis_client.get(otp_key)
    
    if not otp_data_str:
        raise HTTPException(
            status_code=400,
            detail="OTP expired or not found. Please request a new OTP."
        )
    
    # Parse OTP data
    if isinstance(otp_data_str, bytes):
        otp_data = json.loads(otp_data_str.decode())
    else:
        otp_data = json.loads(otp_data_str)
    
    # Verify OTP matches
    if otp_data["otp"] != otp:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP code"
        )
    
    # Verify user and email match
    if otp_data["user_id"] != str(current_user.id) or otp_data["new_email"] != new_email:
        raise HTTPException(
            status_code=400,
            detail="Invalid request"
        )
    
    # Check again if email is still available
    existing_user = crud.user.get_user_by_email(session, email=new_email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already in use"
        )
    
    # Update user's email
    current_user.email = new_email
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    
    # Delete OTP from Redis
    redis_client.delete(otp_key)
    
    # Clear rate limit
    rate_limit_key = f"otp_rate_limit:{new_email}"
    redis_client.delete(rate_limit_key)
    
    return {
        "message": "Email changed successfully",
        "new_email": new_email
    }
