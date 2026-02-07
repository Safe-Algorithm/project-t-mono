"""
CRUD operations for provider reviews and ratings
"""

import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import Session, select, func, and_
from fastapi import HTTPException

from app.models.provider_rating import ProviderRating
from app.models.provider import Provider
from app.models.trip import Trip
from app.models.trip_registration import TripRegistration
from app.models.user import User
from app.schemas.provider_rating import ProviderRatingCreate, ProviderRatingUpdate


def has_user_completed_trip_with_provider(
    session: Session,
    user_id: uuid.UUID,
    provider_id: uuid.UUID,
) -> bool:
    """
    Check if a user has completed at least one trip with the given provider.

    A trip is considered completed if:
    - The trip belongs to the provider
    - The user has a confirmed registration for the trip
    - The trip end_date is in the past
    """
    statement = (
        select(TripRegistration)
        .join(Trip, TripRegistration.trip_id == Trip.id)
        .where(
            TripRegistration.user_id == user_id,
            TripRegistration.status == "confirmed",
            Trip.provider_id == provider_id,
            Trip.end_date < datetime.utcnow(),
        )
    )
    result = session.exec(statement).first()
    return result is not None


def can_user_rate_provider(
    session: Session,
    user_id: uuid.UUID,
    provider_id: uuid.UUID,
) -> tuple[bool, str]:
    """
    Check if a user can rate a provider.

    Returns:
        tuple: (can_rate: bool, reason: str)
    """
    # Check if provider exists
    provider = session.get(Provider, provider_id)
    if not provider:
        return False, "Provider not found"

    # Check provider is not rating themselves
    user = session.get(User, user_id)
    if user and user.provider_id == provider_id:
        return False, "You cannot rate your own provider"

    # Check if user has completed a trip with this provider
    if not has_user_completed_trip_with_provider(session, user_id, provider_id):
        return False, "You must have completed at least one trip with this provider to rate them"

    # Check if user has already rated this provider
    statement = select(ProviderRating).where(
        and_(
            ProviderRating.user_id == user_id,
            ProviderRating.provider_id == provider_id,
        )
    )
    existing_rating = session.exec(statement).first()
    if existing_rating:
        return False, "You have already rated this provider"

    return True, "OK"


def create_provider_rating(
    session: Session,
    user_id: uuid.UUID,
    provider_id: uuid.UUID,
    rating_data: ProviderRatingCreate,
) -> ProviderRating:
    """
    Create a new rating for a provider.

    Raises:
        HTTPException: If user cannot rate the provider
    """
    can_rate, reason = can_user_rate_provider(session, user_id, provider_id)
    if not can_rate:
        raise HTTPException(status_code=400, detail=reason)

    rating = ProviderRating(
        user_id=user_id,
        provider_id=provider_id,
        rating=rating_data.rating,
        comment=rating_data.comment,
    )

    session.add(rating)
    session.commit()
    session.refresh(rating)

    return rating


def get_provider_rating(
    session: Session,
    rating_id: uuid.UUID,
) -> Optional[ProviderRating]:
    """Get a provider rating by ID"""
    return session.get(ProviderRating, rating_id)


def get_provider_ratings(
    session: Session,
    provider_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> List[ProviderRating]:
    """Get all ratings for a provider, ordered by newest first."""
    statement = (
        select(ProviderRating)
        .where(ProviderRating.provider_id == provider_id)
        .order_by(ProviderRating.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    ratings = session.exec(statement).all()
    return list(ratings)


def get_user_provider_rating(
    session: Session,
    user_id: uuid.UUID,
    provider_id: uuid.UUID,
) -> Optional[ProviderRating]:
    """Get a user's rating for a specific provider."""
    statement = select(ProviderRating).where(
        and_(
            ProviderRating.user_id == user_id,
            ProviderRating.provider_id == provider_id,
        )
    )
    return session.exec(statement).first()


def update_provider_rating(
    session: Session,
    rating_id: uuid.UUID,
    user_id: uuid.UUID,
    rating_data: ProviderRatingUpdate,
) -> ProviderRating:
    """
    Update a provider rating.

    Only the rating owner can update their rating.

    Raises:
        HTTPException: If rating not found or user is not the owner
    """
    rating = session.get(ProviderRating, rating_id)
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")

    if rating.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own ratings")

    if rating_data.rating is not None:
        rating.rating = rating_data.rating
    if rating_data.comment is not None:
        rating.comment = rating_data.comment

    rating.updated_at = datetime.utcnow()

    session.add(rating)
    session.commit()
    session.refresh(rating)

    return rating


def delete_provider_rating(
    session: Session,
    rating_id: uuid.UUID,
    user_id: uuid.UUID,
    is_admin: bool = False,
) -> None:
    """
    Delete a provider rating.

    The rating owner or an admin can delete the rating.

    Raises:
        HTTPException: If rating not found or user is not the owner/admin
    """
    rating = session.get(ProviderRating, rating_id)
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")

    if not is_admin and rating.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own ratings")

    session.delete(rating)
    session.commit()


def get_provider_average_rating(
    session: Session,
    provider_id: uuid.UUID,
) -> dict:
    """
    Get average rating and rating distribution for a provider.

    Returns:
        dict with provider_id, average_rating, total_ratings, and rating_distribution
    """
    statement = select(
        func.avg(ProviderRating.rating).label("average"),
        func.count(ProviderRating.id).label("total"),
    ).where(ProviderRating.provider_id == provider_id)

    result = session.exec(statement).first()

    if not result or result.total == 0:
        return {
            "provider_id": provider_id,
            "average_rating": 0.0,
            "total_ratings": 0,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
        }

    # Get rating distribution
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    statement = (
        select(
            ProviderRating.rating,
            func.count(ProviderRating.id).label("count"),
        )
        .where(ProviderRating.provider_id == provider_id)
        .group_by(ProviderRating.rating)
    )

    dist_results = session.exec(statement).all()
    for rating_val, count in dist_results:
        distribution[rating_val] = count

    return {
        "provider_id": provider_id,
        "average_rating": round(float(result.average), 2),
        "total_ratings": result.total,
        "rating_distribution": distribution,
    }
