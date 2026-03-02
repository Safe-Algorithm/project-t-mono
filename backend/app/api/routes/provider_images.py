"""Provider Image Collection API.

Endpoints:
  GET    /provider/images              — list my image collection
  DELETE /provider/images/{id}         — delete an image from collection + Backblaze
  POST   /trips/{trip_id}/images/from-collection  — reuse a collection image on a trip
"""

import asyncio
import uuid
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import crud
from app.api.deps import get_current_active_provider, get_session
from app.api.rbac_deps import require_provider_permission
from app.models.user import User
from app.schemas.provider_image import ProviderImageRead, ProviderImageListResponse

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Collection endpoints ─────────────────────────────────────────────────────

@router.get("/provider/images", response_model=ProviderImageListResponse, tags=["provider-images"])
def list_provider_images(
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Return the authenticated provider's image collection."""
    items = crud.provider_image.get_images_by_provider(
        session=session,
        provider_id=current_user.provider_id,
        skip=skip,
        limit=limit,
    )
    total = crud.provider_image.count_images_by_provider(
        session=session,
        provider_id=current_user.provider_id,
    )
    return ProviderImageListResponse(items=items, total=total)


@router.delete("/provider/images/{image_id}", tags=["provider-images"])
async def delete_provider_image(
    image_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Delete an image from the provider's collection and from Backblaze."""
    from app.services.storage import storage_service

    img = crud.provider_image.get_image(session=session, image_id=image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    if img.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorised")

    # Delete from Backblaze (best-effort — don't fail the request if B2 is unavailable)
    try:
        await storage_service.delete_file(
            file_id=img.b2_file_id,
            file_name=img.b2_file_name,
        )
    except Exception as exc:
        logger.warning(f"Could not delete B2 file {img.b2_file_id}: {exc}")

    crud.provider_image.delete_image(session=session, image=img)
    return {"message": "Image deleted"}


# ─── Reuse from collection on a trip ─────────────────────────────────────────

@router.post(
    "/trips/{trip_id}/images/from-collection",
    tags=["trips"],
)
def add_collection_image_to_trip(
    trip_id: uuid.UUID,
    image_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Attach an existing collection image to a trip without re-uploading."""
    img = crud.provider_image.get_image(session=session, image_id=image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    if img.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorised")

    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorised to modify this trip")

    if img.url in (trip.images or []):
        raise HTTPException(status_code=409, detail="Image already attached to this trip")

    trip.images = (trip.images or []) + [img.url]
    session.add(trip)
    session.commit()
    session.refresh(trip)

    return {
        "message": "Image attached to trip",
        "url": img.url,
        "total_images": len(trip.images),
    }
