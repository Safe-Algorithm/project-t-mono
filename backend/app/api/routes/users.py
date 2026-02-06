import json
import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlmodel import Session, select
from app import crud
from app.api import deps
from app.core.redis import redis_client
from app.core.config import settings
from app.schemas.user import UserCreate, UserPublic, UserUpdate
from app.models.user import User
from app.services.sms import sms_service
from app.services.email import email_service
from app.services.storage import storage_service
from app.schemas.registration_history import RegistrationHistoryItem

router = APIRouter()

@router.post("", response_model=UserPublic)
def create_user(
    *, 
    session: Session = Depends(deps.get_session), 
    user_in: UserCreate
):
    """
    Create new user.
    """
    user = crud.user.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = crud.user.create_user(session=session, user_in=user_in)
    return user

@router.get("/me", response_model=UserPublic)
def read_users_me(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Get current user.
    """
    return current_user


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *,
    session: Session = Depends(deps.get_session),
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    background_tasks: BackgroundTasks,
    phone_verification_token: str = None,
    email_verification_token: str = None,
):
    """
    Update current user profile.
    
    If changing email or phone:
    - Must verify via OTP first
    - Provide verification_token from OTP verification
    - Old email/phone will be replaced
    - Verified status will be updated
    """
    # Check if user is trying to change email
    if user_in.email and user_in.email != current_user.email:
        if not email_verification_token:
            raise HTTPException(
                status_code=400,
                detail="Email verification token required when changing email. Please verify your new email first."
            )
        
        # Verify the email token
        verification_key = f"email_verified:{email_verification_token}"
        verification_data_str = redis_client.get(verification_key)
        
        if not verification_data_str:
            raise HTTPException(
                status_code=400,
                detail="Email verification token expired or invalid. Please verify again."
            )
        
        # Parse and validate
        verification_data = json.loads(
            verification_data_str.decode() if isinstance(verification_data_str, bytes) else verification_data_str
        )
        
        if verification_data.get("email") != user_in.email:
            raise HTTPException(
                status_code=400,
                detail="Email in verification token does not match the email you're trying to set."
            )
        
        # Check if email already exists for another user
        existing_user = crud.user.get_user_by_email_and_source(
            session=session, email=user_in.email, source=current_user.source
        )
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Email already registered by another user."
            )
        
        # Update email and mark as verified
        current_user.email = user_in.email
        current_user.is_email_verified = True
        
        # Delete verification token
        redis_client.delete(verification_key)
    
    # Check if user is trying to change phone
    if user_in.phone and user_in.phone != current_user.phone:
        if not phone_verification_token:
            raise HTTPException(
                status_code=400,
                detail="Phone verification token required when changing phone. Please verify your new phone first."
            )
        
        # Verify the phone token
        verification_key = f"phone_verified:{phone_verification_token}"
        verification_data_str = redis_client.get(verification_key)
        
        if not verification_data_str:
            raise HTTPException(
                status_code=400,
                detail="Phone verification token expired or invalid. Please verify again."
            )
        
        # Parse and validate
        verification_data = json.loads(
            verification_data_str.decode() if isinstance(verification_data_str, bytes) else verification_data_str
        )
        
        if verification_data.get("phone") != user_in.phone:
            raise HTTPException(
                status_code=400,
                detail="Phone in verification token does not match the phone you're trying to set."
            )
        
        # Check if phone already exists for another user
        existing_user = crud.user.get_user_by_phone_and_source(
            session=session, phone=user_in.phone, source=current_user.source
        )
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Phone already registered by another user."
            )
        
        # Update phone and mark as verified
        current_user.phone = user_in.phone
        current_user.is_phone_verified = True
        
        # Delete verification token
        redis_client.delete(verification_key)
    
    # Update other fields
    if user_in.name is not None:
        current_user.name = user_in.name
    
    if user_in.password is not None:
        from app.core.security import get_password_hash
        current_user.hashed_password = get_password_hash(user_in.password)
    
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    
    return current_user


@router.post("/me/avatar", response_model=UserPublic)
async def upload_avatar(
    *,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_active_user),
    file: UploadFile = File(...),
):
    """
    Upload user avatar/profile picture.
    
    Accepts image files (jpg, jpeg, png, gif, webp).
    Maximum file size: 5MB
    """
    # Validate file type
    allowed_extensions = ["jpg", "jpeg", "png", "gif", "webp"]
    file_extension = file.filename.split(".")[-1].lower() if file.filename else ""
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Validate file size (5MB max)
    max_size = 5 * 1024 * 1024  # 5MB in bytes
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds 5MB limit"
        )
    
    # Reset file pointer
    await file.seek(0)
    
    # Delete old avatar if exists
    if current_user.avatar_file_id and current_user.avatar_file_name:
        try:
            await storage_service.delete_file(
                file_id=current_user.avatar_file_id,
                file_name=current_user.avatar_file_name
            )
        except Exception as e:
            # Log but don't fail if old avatar deletion fails
            print(f"Failed to delete old avatar: {e}")
    
    # Upload new avatar
    try:
        upload_result = await storage_service.upload_file(
            file_data=file_content,
            file_name=file.filename,
            folder=f"avatars/user_{current_user.id}",
            content_type=file.content_type
        )
        
        # Update user avatar URL, file ID, and file name
        current_user.avatar_url = upload_result["downloadUrl"]
        current_user.avatar_file_id = upload_result["fileId"]
        current_user.avatar_file_name = upload_result["fileName"]
        session.add(current_user)
        session.commit()
        session.refresh(current_user)
        
        return current_user
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload avatar: {str(e)}"
        )


@router.get("/me/registrations", response_model=List[RegistrationHistoryItem])
def get_my_registration_history(
    *,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
) -> List[RegistrationHistoryItem]:
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.trip import Trip as TripModel
    from app.models.provider import Provider as ProviderModel

    statement = (
        select(TripRegistrationModel)
        .where(TripRegistrationModel.user_id == current_user.id)
        .order_by(TripRegistrationModel.registration_date.desc())
        .offset(skip)
        .limit(limit)
    )
    registrations = list(session.exec(statement).all())

    items: List[RegistrationHistoryItem] = []
    for registration in registrations:
        # Relationship loading can vary depending on session config; ensure we always have trip/provider.
        trip: TripModel | None = registration.trip
        if trip is None:
            trip = session.get(TripModel, registration.trip_id)
        if trip is None:
            raise HTTPException(status_code=500, detail="Registration has missing trip")

        provider: ProviderModel | None = trip.provider
        if provider is None:
            provider = session.get(ProviderModel, trip.provider_id)

        provider_payload = {
            "id": provider.id if provider else trip.provider_id,
            "company_name": provider.company_name if provider else "Unknown",
        }

        trip_payload = {
            "id": trip.id,
            "name_en": trip.name_en,
            "name_ar": trip.name_ar,
            "description_en": trip.description_en,
            "description_ar": trip.description_ar,
            "start_date": trip.start_date,
            "end_date": trip.end_date,
            "provider_id": trip.provider_id,
            "provider": provider_payload,
        }

        items.append(
            RegistrationHistoryItem.model_validate(
                {
                    "id": registration.id,
                    "trip_id": registration.trip_id,
                    "user_id": registration.user_id,
                    "registration_date": registration.registration_date,
                    "total_participants": registration.total_participants,
                    "total_amount": registration.total_amount,
                    "status": registration.status,
                    "participants": list(registration.participants or []),
                    "trip": trip_payload,
                }
            )
        )

    return items
