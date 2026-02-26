"""
API routes for the Trip Updates / Notifications system.

Sections:
  1. Provider endpoints – send updates to all or specific registration
  2. User endpoints – view updates for a trip, mark as read
  3. Admin endpoints – view all updates for a trip (read-only)
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select
from app.services.storage import storage_service

from app.api.deps import (
    get_session,
    get_current_active_user,
    get_current_active_admin,
    get_current_active_provider,
)
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_registration import TripRegistration
from app.crud import trip_update as crud_update
from app.schemas.trip_update import (
    TripUpdateCreate,
    TripUpdateRead,
    TripUpdateReadWithReceipts,
    TripUpdateReceiptRead,
)

router = APIRouter()


# =====================================================================
# 1. Provider endpoints
# =====================================================================


ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    "application/pdf",
}


async def _save_attachment(file: UploadFile) -> dict:
    """Upload file to Backblaze, return attachment dict."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. Use JPEG, PNG, GIF, WEBP, or PDF."
        )
    file_data = await file.read()
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    unique_name = f"{uuid.uuid4()}.{ext}"
    upload_result = await storage_service.upload_file(
        file_data=file_data,
        file_name=unique_name,
        content_type=file.content_type,
        folder="trip-updates"
    )
    url = upload_result.get("downloadUrl") or upload_result.get("file_url")
    return {"url": url, "filename": file.filename or unique_name, "content_type": file.content_type}


@router.post(
    "/provider/trips/{trip_id}/updates",
    response_model=TripUpdateRead,
)
async def provider_send_update_to_all(
    trip_id: uuid.UUID,
    title: str = Form(...),
    message: str = Form(...),
    is_important: str = Form("false"),
    file: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Send an update to all registered users of a trip."""
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not your trip")

    attachments = [await _save_attachment(file)] if file and file.filename else None
    data = TripUpdateCreate(title=title, message=message, is_important=is_important.lower() == "true", attachments=attachments)
    update = crud_update.create_trip_update(
        session,
        trip_id=trip_id,
        provider_id=current_user.id,
        data=data,
    )
    return TripUpdateRead.model_validate(update)


@router.post(
    "/provider/registrations/{registration_id}/updates",
    response_model=TripUpdateRead,
)
async def provider_send_update_to_registration(
    registration_id: uuid.UUID,
    title: str = Form(...),
    message: str = Form(...),
    is_important: str = Form("false"),
    file: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Send an update to a specific registration (user)."""
    reg = session.get(TripRegistration, registration_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    trip = session.get(Trip, reg.trip_id)
    if not trip or trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not your trip")

    attachments = [await _save_attachment(file)] if file and file.filename else None
    data = TripUpdateCreate(title=title, message=message, is_important=is_important.lower() == "true", attachments=attachments)
    update = crud_update.create_trip_update(
        session,
        trip_id=reg.trip_id,
        provider_id=current_user.id,
        data=data,
        registration_id=registration_id,
    )
    return TripUpdateRead.model_validate(update)


@router.get(
    "/provider/trips/{trip_id}/updates",
    response_model=List[TripUpdateReadWithReceipts],
)
def provider_list_trip_updates(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """List all updates the provider has sent for a trip, with read counts."""
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not your trip")

    updates = crud_update.list_updates_for_trip(session, trip_id=trip_id)

    # Count total recipients per update
    results = []
    for u in updates:
        read_count = crud_update.get_read_count(session, update_id=u.id)
        # Count registrations for this trip
        if u.registration_id:
            total = 1
        else:
            stmt = select(TripRegistration).where(TripRegistration.trip_id == trip_id)
            total = len(list(session.exec(stmt).all()))
        result = TripUpdateReadWithReceipts.model_validate(u)
        result.total_recipients = total
        result.read_count = read_count
        results.append(result)
    return results


@router.get(
    "/provider/updates/{update_id}/receipts",
    response_model=List[TripUpdateReceiptRead],
)
def provider_get_update_receipts(
    update_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Get read receipts for a specific update. Provider only."""
    update = crud_update.get_trip_update(session, update_id=update_id)
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")
    if update.provider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your update")

    receipts = crud_update.get_receipts_for_update(session, update_id=update_id)
    return [TripUpdateReceiptRead.model_validate(r) for r in receipts]


# =====================================================================
# 2. User endpoints
# =====================================================================


@router.get(
    "/trips/{trip_id}/updates",
    response_model=List[TripUpdateRead],
)
def user_list_trip_updates(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get updates for a trip the user is registered for."""
    stmt = select(TripRegistration).where(
        TripRegistration.trip_id == trip_id,
        TripRegistration.user_id == current_user.id,
    )
    registration = session.exec(stmt).first()
    if not registration:
        raise HTTPException(status_code=403, detail="Not registered for this trip")

    updates = crud_update.list_updates_for_user_trip(
        session, trip_id=trip_id, registration_id=registration.id
    )

    results = []
    for u in updates:
        result = TripUpdateRead.model_validate(u)
        result.read = crud_update.has_user_read(
            session, update_id=u.id, user_id=current_user.id
        )
        results.append(result)
    return results


@router.post(
    "/updates/{update_id}/mark-read",
    response_model=TripUpdateReceiptRead,
)
def user_mark_update_read(
    update_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """Mark an update as read."""
    update = crud_update.get_trip_update(session, update_id=update_id)
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    # Verify user is registered for this trip
    stmt = select(TripRegistration).where(
        TripRegistration.trip_id == update.trip_id,
        TripRegistration.user_id == current_user.id,
    )
    registration = session.exec(stmt).first()
    if not registration:
        raise HTTPException(status_code=403, detail="Not registered for this trip")

    # If targeted update, verify it's for this registration
    if update.registration_id and update.registration_id != registration.id:
        raise HTTPException(status_code=403, detail="This update is not for you")

    receipt = crud_update.mark_as_read(
        session, update_id=update_id, user_id=current_user.id
    )
    return TripUpdateReceiptRead.model_validate(receipt)


# =====================================================================
# 3. Admin endpoints (read-only)
# =====================================================================


@router.get(
    "/admin/trip-updates",
    response_model=List[TripUpdateReadWithReceipts],
)
def admin_list_all_trip_updates(
    skip: int = 0,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """List all trip updates across all trips. Admin only."""
    updates = crud_update.list_all_updates(session, skip=skip, limit=limit)
    results = []
    for u in updates:
        read_count = crud_update.get_read_count(session, update_id=u.id)
        if u.registration_id:
            total = 1
        else:
            stmt = select(TripRegistration).where(TripRegistration.trip_id == u.trip_id)
            total = len(list(session.exec(stmt).all()))
        result = TripUpdateReadWithReceipts.model_validate(u)
        result.total_recipients = total
        result.read_count = read_count
        results.append(result)
    return results


@router.get(
    "/admin/trips/{trip_id}/updates",
    response_model=List[TripUpdateReadWithReceipts],
)
def admin_list_trip_updates(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """List all updates for a trip. Admin only."""
    updates = crud_update.list_updates_for_trip(session, trip_id=trip_id)
    results = []
    for u in updates:
        read_count = crud_update.get_read_count(session, update_id=u.id)
        if u.registration_id:
            total = 1
        else:
            stmt = select(TripRegistration).where(TripRegistration.trip_id == trip_id)
            total = len(list(session.exec(stmt).all()))
        result = TripUpdateReadWithReceipts.model_validate(u)
        result.total_recipients = total
        result.read_count = read_count
        results.append(result)
    return results
