"""
API routes for trip reviews and ratings
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlmodel import Session

from app.api.deps import get_session, get_current_active_user
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewUpdate, ReviewRead, TripAverageRating
from app import crud
from app.services.storage import storage_service

router = APIRouter()


@router.get("/my-reviews", response_model=List[ReviewRead])
def get_my_reviews(
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all reviews by the current user.
    """
    reviews = crud.review.get_user_reviews(
        session=session,
        user_id=current_user.id,
        skip=skip,
        limit=limit
    )
    
    result = []
    for review in reviews:
        review_dict = ReviewRead.from_orm(review)
        review_dict.user_name = current_user.name
        result.append(review_dict)
    
    return result


@router.post("/trips/{trip_id}", response_model=ReviewRead)
def create_trip_review(
    trip_id: uuid.UUID,
    review_data: ReviewCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a review for a trip.
    
    Requirements:
    - User must have a confirmed registration for the trip
    - Trip must have ended
    - User can only review once per trip
    """
    review = crud.review.create_review(
        session=session,
        user_id=current_user.id,
        trip_id=trip_id,
        review_data=review_data
    )
    
    # Add user name to response
    review_dict = ReviewRead.from_orm(review)
    review_dict.user_name = current_user.name
    
    return review_dict


@router.get("/trips/{trip_id}", response_model=List[ReviewRead])
def list_trip_reviews(
    trip_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session)
):
    """
    Get all reviews for a trip.
    
    Public endpoint - no authentication required.
    """
    reviews = crud.review.get_trip_reviews(
        session=session,
        trip_id=trip_id,
        skip=skip,
        limit=limit
    )
    
    # Add user names to reviews
    result = []
    for review in reviews:
        review_dict = ReviewRead.from_orm(review)
        if review.user:
            review_dict.user_name = review.user.name
        result.append(review_dict)
    
    return result


@router.get("/trips/{trip_id}/rating", response_model=TripAverageRating)
def get_trip_rating(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session)
):
    """
    Get average rating and rating distribution for a trip.
    
    Public endpoint - no authentication required.
    """
    rating_data = crud.review.get_trip_average_rating(
        session=session,
        trip_id=trip_id
    )
    
    return TripAverageRating(**rating_data)


@router.put("/{review_id}", response_model=ReviewRead)
def update_review(
    review_id: uuid.UUID,
    review_data: ReviewUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a review.
    
    Only the review owner can update their review.
    """
    review = crud.review.update_review(
        session=session,
        review_id=review_id,
        user_id=current_user.id,
        review_data=review_data
    )
    
    review_dict = ReviewRead.from_orm(review)
    review_dict.user_name = current_user.name
    
    return review_dict


@router.delete("/{review_id}", status_code=204)
def delete_review(
    review_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a review.
    
    Only the review owner can delete their review.
    """
    crud.review.delete_review(
        session=session,
        review_id=review_id,
        user_id=current_user.id
    )
    
    return None


@router.post("/{review_id}/images", response_model=ReviewRead)
async def upload_review_images(
    review_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    review = crud.review.get_review(session=session, review_id=review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only upload images to your own reviews")

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    allowed_extensions = ["jpg", "jpeg", "png", "webp"]
    max_size = 5 * 1024 * 1024

    existing_images = list(review.images or [])
    if len(existing_images) + len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images per review")

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
            folder=f"reviews/review_{review_id}",
            content_type=upload.content_type,
        )

        new_urls.append(upload_result["downloadUrl"])

    review.images = existing_images + new_urls
    session.add(review)
    session.commit()
    session.refresh(review)

    review_dict = ReviewRead.from_orm(review)
    review_dict.user_name = current_user.name
    return review_dict
