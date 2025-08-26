from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from datetime import datetime, timezone

from app.api.deps import get_current_active_superuser, get_session
from app.models.user import User
from app.models.provider import ProviderRequest, Provider
from app.models.trip import Trip

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser),
) -> Dict[str, Any]:
    """Get dashboard statistics for admin panel."""
    
    # Provider request statistics
    provider_requests_stats = session.exec(
        select(
            ProviderRequest.status,
            func.count(ProviderRequest.id).label('count')
        ).group_by(ProviderRequest.status)
    ).all()
    
    provider_request_counts = {
        'pending': 0,
        'approved': 0,
        'denied': 0
    }
    for stat in provider_requests_stats:
        provider_request_counts[stat.status] = stat.count
    
    # Provider statistics - all providers are considered active since there's no is_active field
    total_providers = session.exec(
        select(func.count(Provider.id))
    ).first() or 0
    
    provider_counts = {
        'total': total_providers,
        'active': total_providers,  # All providers are considered active
        'inactive': 0  # No inactive field in the model
    }
    
    # Trip statistics based on dates
    now = datetime.now(timezone.utc)
    
    # Upcoming trips (start_date > now)
    upcoming_trips = session.exec(
        select(func.count(Trip.id)).where(Trip.start_date > now)
    ).first() or 0
    
    # Current trips (start_date <= now <= end_date)
    current_trips = session.exec(
        select(func.count(Trip.id)).where(
            Trip.start_date <= now,
            Trip.end_date >= now
        )
    ).first() or 0
    
    # Past trips (end_date < now)
    past_trips = session.exec(
        select(func.count(Trip.id)).where(Trip.end_date < now)
    ).first() or 0
    
    # Total trips
    total_trips = session.exec(
        select(func.count(Trip.id))
    ).first() or 0
    
    return {
        "provider_requests": provider_request_counts,
        "providers": provider_counts,
        "trips": {
            "total": total_trips,
            "upcoming": upcoming_trips,
            "current": current_trips,
            "past": past_trips
        }
    }
