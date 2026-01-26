import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import get_current_active_user, get_session
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_favorite import TripFavorite
from app.models.trip_like import TripLike
from app.models.trip_bookmark import TripBookmark
from app.schemas.trip import TripRead

router = APIRouter()


# ==================== FAVORITES ====================

@router.post("/trips/{trip_id}/favorite", status_code=201)
def add_trip_to_favorites(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Add a trip to the current user's favorites."""
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    existing = session.exec(
        select(TripFavorite).where(
            TripFavorite.user_id == current_user.id,
            TripFavorite.trip_id == trip_id
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Trip already in favorites")
    
    try:
        favorite = TripFavorite(user_id=current_user.id, trip_id=trip_id)
        session.add(favorite)
        session.commit()
        return {"message": "Trip added to favorites"}
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Trip already in favorites")


@router.delete("/trips/{trip_id}/favorite", status_code=200)
def remove_trip_from_favorites(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Remove a trip from the current user's favorites."""
    favorite = session.exec(
        select(TripFavorite).where(
            TripFavorite.user_id == current_user.id,
            TripFavorite.trip_id == trip_id
        )
    ).first()
    
    if not favorite:
        raise HTTPException(status_code=404, detail="Trip not in favorites")
    
    session.delete(favorite)
    session.commit()
    return {"message": "Trip removed from favorites"}


@router.get("/favorites", response_model=List[TripRead])
def get_user_favorites(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
):
    """Get the current user's favorite trips."""
    statement = (
        select(Trip)
        .join(TripFavorite, TripFavorite.trip_id == Trip.id)
        .where(TripFavorite.user_id == current_user.id)
        .order_by(TripFavorite.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    trips = session.exec(statement).all()
    return trips


# ==================== LIKES ====================

@router.post("/trips/{trip_id}/like", status_code=201)
def like_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Like a trip - indicates the trip was good."""
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    existing = session.exec(
        select(TripLike).where(
            TripLike.user_id == current_user.id,
            TripLike.trip_id == trip_id
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Trip already liked")
    
    try:
        like = TripLike(user_id=current_user.id, trip_id=trip_id)
        session.add(like)
        session.commit()
        return {"message": "Trip liked"}
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Trip already liked")


@router.delete("/trips/{trip_id}/like", status_code=200)
def unlike_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Remove like from a trip."""
    like = session.exec(
        select(TripLike).where(
            TripLike.user_id == current_user.id,
            TripLike.trip_id == trip_id
        )
    ).first()
    
    if not like:
        raise HTTPException(status_code=404, detail="Trip not liked")
    
    session.delete(like)
    session.commit()
    return {"message": "Trip unliked"}


@router.get("/likes", response_model=List[TripRead])
def get_user_likes(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
):
    """Get trips the current user has liked."""
    statement = (
        select(Trip)
        .join(TripLike, TripLike.trip_id == Trip.id)
        .where(TripLike.user_id == current_user.id)
        .order_by(TripLike.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    trips = session.exec(statement).all()
    return trips


# ==================== BOOKMARKS ====================

@router.post("/trips/{trip_id}/bookmark", status_code=201)
def bookmark_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Bookmark a trip - save for later viewing."""
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    existing = session.exec(
        select(TripBookmark).where(
            TripBookmark.user_id == current_user.id,
            TripBookmark.trip_id == trip_id
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Trip already bookmarked")
    
    try:
        bookmark = TripBookmark(user_id=current_user.id, trip_id=trip_id)
        session.add(bookmark)
        session.commit()
        return {"message": "Trip bookmarked"}
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Trip already bookmarked")


@router.delete("/trips/{trip_id}/bookmark", status_code=200)
def unbookmark_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Remove bookmark from a trip."""
    bookmark = session.exec(
        select(TripBookmark).where(
            TripBookmark.user_id == current_user.id,
            TripBookmark.trip_id == trip_id
        )
    ).first()
    
    if not bookmark:
        raise HTTPException(status_code=404, detail="Trip not bookmarked")
    
    session.delete(bookmark)
    session.commit()
    return {"message": "Trip unbookmarked"}


@router.get("/bookmarks", response_model=List[TripRead])
def get_user_bookmarks(
    *,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
):
    """Get trips the current user has bookmarked."""
    statement = (
        select(Trip)
        .join(TripBookmark, TripBookmark.trip_id == Trip.id)
        .where(TripBookmark.user_id == current_user.id)
        .order_by(TripBookmark.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    trips = session.exec(statement).all()
    return trips
