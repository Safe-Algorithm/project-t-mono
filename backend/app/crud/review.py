"""
CRUD operations for trip reviews and ratings
"""

import uuid
from datetime import datetime, date
from typing import Optional, List
from sqlmodel import Session, select, func, and_
from fastapi import HTTPException

from app.models.links import TripRating
from app.models.trip import Trip
from app.models.trip_registration import TripRegistration
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewUpdate


def can_user_review_trip(
    session: Session,
    user_id: uuid.UUID,
    trip_id: uuid.UUID
) -> tuple[bool, str]:
    """
    Check if a user can review a trip.
    
    Returns:
        tuple: (can_review: bool, reason: str)
    """
    # Check if trip exists
    trip = session.get(Trip, trip_id)
    if not trip:
        return False, "Trip not found"
    
    # Check if trip has ended
    today = date.today()
    trip_end_date = trip.end_date.date() if isinstance(trip.end_date, datetime) else trip.end_date
    if trip_end_date >= today:
        return False, "Cannot review trip until it has ended"
    
    # Check if user has a confirmed registration for this trip
    statement = select(TripRegistration).where(
        and_(
            TripRegistration.user_id == user_id,
            TripRegistration.trip_id == trip_id,
            TripRegistration.status == "confirmed"
        )
    )
    registration = session.exec(statement).first()
    
    if not registration:
        return False, "You must have a confirmed registration to review this trip"
    
    # Check if user has already reviewed this trip
    statement = select(TripRating).where(
        and_(
            TripRating.user_id == user_id,
            TripRating.trip_id == trip_id
        )
    )
    existing_review = session.exec(statement).first()
    
    if existing_review:
        return False, "You have already reviewed this trip"
    
    return True, "OK"


def create_review(
    session: Session,
    user_id: uuid.UUID,
    trip_id: uuid.UUID,
    review_data: ReviewCreate
) -> TripRating:
    """
    Create a new review for a trip.
    
    Args:
        session: Database session
        user_id: ID of the user creating the review
        trip_id: ID of the trip being reviewed
        review_data: Review data
        
    Returns:
        TripRating: Created review
        
    Raises:
        HTTPException: If user cannot review the trip
    """
    # Validate user can review
    can_review, reason = can_user_review_trip(session, user_id, trip_id)
    if not can_review:
        raise HTTPException(status_code=400, detail=reason)
    
    # Create review
    review = TripRating(
        user_id=user_id,
        trip_id=trip_id,
        rating=review_data.rating,
        comment=review_data.comment
    )
    
    session.add(review)
    session.commit()
    session.refresh(review)
    
    return review


def get_review(
    session: Session,
    review_id: uuid.UUID
) -> Optional[TripRating]:
    """Get a review by ID"""
    return session.get(TripRating, review_id)


def get_trip_reviews(
    session: Session,
    trip_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100
) -> List[TripRating]:
    """
    Get all reviews for a trip.
    
    Args:
        session: Database session
        trip_id: ID of the trip
        skip: Number of reviews to skip
        limit: Maximum number of reviews to return
        
    Returns:
        List of reviews
    """
    statement = select(TripRating).where(
        TripRating.trip_id == trip_id
    ).order_by(TripRating.created_at.desc()).offset(skip).limit(limit)
    
    reviews = session.exec(statement).all()
    return list(reviews)


def get_user_reviews(
    session: Session,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100
) -> List[TripRating]:
    """
    Get all reviews by a user.
    
    Args:
        session: Database session
        user_id: ID of the user
        skip: Number of reviews to skip
        limit: Maximum number of reviews to return
        
    Returns:
        List of reviews
    """
    statement = select(TripRating).where(
        TripRating.user_id == user_id
    ).order_by(TripRating.created_at.desc()).offset(skip).limit(limit)
    
    reviews = session.exec(statement).all()
    return list(reviews)


def update_review(
    session: Session,
    review_id: uuid.UUID,
    user_id: uuid.UUID,
    review_data: ReviewUpdate
) -> TripRating:
    """
    Update a review.
    
    Args:
        session: Database session
        review_id: ID of the review
        user_id: ID of the user (must be the review owner)
        review_data: Updated review data
        
    Returns:
        Updated review
        
    Raises:
        HTTPException: If review not found or user is not the owner
    """
    review = session.get(TripRating, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own reviews")
    
    # Update fields
    if review_data.rating is not None:
        review.rating = review_data.rating
    if review_data.comment is not None:
        review.comment = review_data.comment
    
    session.add(review)
    session.commit()
    session.refresh(review)
    
    return review


def delete_review(
    session: Session,
    review_id: uuid.UUID,
    user_id: uuid.UUID
) -> None:
    """
    Delete a review.
    
    Args:
        session: Database session
        review_id: ID of the review
        user_id: ID of the user (must be the review owner)
        
    Raises:
        HTTPException: If review not found or user is not the owner
    """
    review = session.get(TripRating, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own reviews")
    
    session.delete(review)
    session.commit()


def get_trip_average_rating(
    session: Session,
    trip_id: uuid.UUID
) -> dict:
    """
    Get average rating and rating distribution for a trip.
    
    Args:
        session: Database session
        trip_id: ID of the trip
        
    Returns:
        dict with average_rating, total_reviews, and rating_distribution
    """
    # Get average rating and count
    statement = select(
        func.avg(TripRating.rating).label("average"),
        func.count(TripRating.id).label("total")
    ).where(TripRating.trip_id == trip_id)
    
    result = session.exec(statement).first()
    
    if not result or result.total == 0:
        return {
            "trip_id": trip_id,
            "average_rating": 0.0,
            "total_reviews": 0,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        }
    
    # Get rating distribution
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    statement = select(
        TripRating.rating,
        func.count(TripRating.id).label("count")
    ).where(TripRating.trip_id == trip_id).group_by(TripRating.rating)
    
    dist_results = session.exec(statement).all()
    for rating, count in dist_results:
        distribution[rating] = count
    
    return {
        "trip_id": trip_id,
        "average_rating": round(float(result.average), 2),
        "total_reviews": result.total,
        "rating_distribution": distribution
    }
