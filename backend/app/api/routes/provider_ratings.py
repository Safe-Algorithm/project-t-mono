"""
API routes for provider reviews and ratings
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session

from app.api.deps import get_session, get_current_active_user, get_current_active_admin
from app.models.user import User
from app.schemas.provider_rating import (
    ProviderRatingCreate,
    ProviderRatingUpdate,
    ProviderRatingRead,
    ProviderAverageRating,
)
from app import crud
from app.services.storage import storage_service

router = APIRouter()


@router.post("/providers/{provider_id}/ratings", response_model=ProviderRatingRead)
def create_provider_rating(
    provider_id: uuid.UUID,
    rating_data: ProviderRatingCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a rating for a provider.

    Requirements:
    - User must have completed at least one trip with this provider
    - User can only rate a provider once
    - Provider cannot rate themselves
    """
    rating = crud.provider_rating.create_provider_rating(
        session=session,
        user_id=current_user.id,
        provider_id=provider_id,
        rating_data=rating_data,
    )

    result = ProviderRatingRead.from_orm(rating)
    result.user_name = current_user.name
    return result


@router.get("/providers/{provider_id}/ratings", response_model=List[ProviderRatingRead])
def list_provider_ratings(
    provider_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
):
    """
    Get all ratings for a provider.

    Public endpoint - no authentication required.
    """
    ratings = crud.provider_rating.get_provider_ratings(
        session=session,
        provider_id=provider_id,
        skip=skip,
        limit=limit,
    )

    result = []
    for rating in ratings:
        rating_dict = ProviderRatingRead.from_orm(rating)
        if rating.user:
            rating_dict.user_name = rating.user.name
        result.append(rating_dict)

    return result


@router.get("/providers/{provider_id}/rating", response_model=ProviderAverageRating)
def get_provider_rating(
    provider_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    """
    Get average rating and rating distribution for a provider.

    Public endpoint - no authentication required.
    """
    rating_data = crud.provider_rating.get_provider_average_rating(
        session=session,
        provider_id=provider_id,
    )

    return ProviderAverageRating(**rating_data)


@router.get("/providers/{provider_id}/ratings/me", response_model=ProviderRatingRead)
def get_my_provider_rating(
    provider_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get the current user's rating for a specific provider.
    """
    rating = crud.provider_rating.get_user_provider_rating(
        session=session,
        user_id=current_user.id,
        provider_id=provider_id,
    )

    if not rating:
        raise HTTPException(status_code=404, detail="You have not rated this provider")

    result = ProviderRatingRead.from_orm(rating)
    result.user_name = current_user.name
    return result


@router.put("/providers/ratings/{rating_id}", response_model=ProviderRatingRead)
def update_provider_rating(
    rating_id: uuid.UUID,
    rating_data: ProviderRatingUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update a provider rating.

    Only the rating owner can update their rating.
    """
    rating = crud.provider_rating.update_provider_rating(
        session=session,
        rating_id=rating_id,
        user_id=current_user.id,
        rating_data=rating_data,
    )

    result = ProviderRatingRead.from_orm(rating)
    result.user_name = current_user.name
    return result


@router.delete("/providers/ratings/{rating_id}", status_code=204)
def delete_provider_rating(
    rating_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a provider rating.

    Only the rating owner can delete their rating.
    """
    crud.provider_rating.delete_provider_rating(
        session=session,
        rating_id=rating_id,
        user_id=current_user.id,
    )

    return None


@router.delete("/admin/providers/ratings/{rating_id}", status_code=204)
def admin_delete_provider_rating(
    rating_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """
    Admin endpoint to delete any provider rating (moderation).
    """
    crud.provider_rating.delete_provider_rating(
        session=session,
        rating_id=rating_id,
        user_id=current_user.id,
        is_admin=True,
    )

    return None


@router.post("/providers/ratings/{rating_id}/images", response_model=ProviderRatingRead)
async def upload_provider_rating_images(
    rating_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Upload images for a provider rating.

    Maximum 5 images per rating.
    """
    rating = crud.provider_rating.get_provider_rating(session=session, rating_id=rating_id)
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    if rating.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only upload images to your own ratings")

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    allowed_extensions = ["jpg", "jpeg", "png", "webp"]
    max_size = 5 * 1024 * 1024

    existing_images = list(rating.images or [])
    if len(existing_images) + len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images per rating")

    new_urls: List[str] = []
    for upload in files:
        file_extension = upload.filename.split(".")[-1].lower() if upload.filename else ""
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}",
            )

        file_content = await upload.read()
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

        unique_name = f"{uuid.uuid4()}.{file_extension}"
        upload_result = await storage_service.upload_file(
            file_data=file_content,
            file_name=unique_name,
            folder=f"provider_ratings/rating_{rating_id}",
            content_type=upload.content_type,
        )

        new_urls.append(upload_result["downloadUrl"])

    rating.images = existing_images + new_urls
    session.add(rating)
    session.commit()
    session.refresh(rating)

    result = ProviderRatingRead.from_orm(rating)
    result.user_name = current_user.name
    return result
