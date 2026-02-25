"""
CRUD operations for public provider profiles
"""

import uuid
from typing import Optional
from sqlmodel import Session, select, func
from fastapi import HTTPException

from app.models.provider import Provider
from app.models.trip import Trip
from app.models.links import TripRating


def get_provider_profile_public(
    session: Session,
    provider_id: uuid.UUID
) -> dict:
    """
    Get public provider profile with statistics.
    
    Args:
        session: Database session
        provider_id: ID of the provider
        
    Returns:
        dict with provider info and statistics
        
    Raises:
        HTTPException: If provider not found
    """
    # Get provider
    provider = session.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Get total trips count
    total_trips_statement = select(func.count(Trip.id)).where(Trip.provider_id == provider_id)
    total_trips = session.exec(total_trips_statement).first() or 0
    
    # Get active trips count
    active_trips_statement = select(func.count(Trip.id)).where(
        Trip.provider_id == provider_id,
        Trip.is_active == True
    )
    active_trips = session.exec(active_trips_statement).first() or 0
    
    # Get average rating and total reviews across all provider's trips
    # Join Trip and TripRating to get all ratings for this provider's trips
    rating_statement = select(
        func.avg(TripRating.rating).label("average"),
        func.count(TripRating.id).label("total")
    ).select_from(TripRating).join(
        Trip, TripRating.trip_id == Trip.id
    ).where(
        Trip.provider_id == provider_id
    )
    
    rating_result = session.exec(rating_statement).first()
    
    average_rating = 0.0
    total_reviews = 0
    
    if rating_result and rating_result.total > 0:
        average_rating = round(float(rating_result.average), 2)
        total_reviews = rating_result.total
    
    return {
        "id": provider.id,
        "company_name": provider.company_name,
        "company_email": provider.company_email,
        "company_phone": provider.company_phone,
        "company_avatar_url": provider.company_avatar_url,
        "company_cover_url": provider.company_cover_url,
        "bio_en": provider.bio_en,
        "bio_ar": provider.bio_ar,
        "company_metadata": provider.company_metadata or {},
        "total_trips": total_trips,
        "active_trips": active_trips,
        "average_rating": average_rating,
        "total_reviews": total_reviews,
    }
