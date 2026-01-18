"""
Schemas for trip reviews and ratings
"""

from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, Field, validator


class ReviewCreate(BaseModel):
    """Schema for creating a review"""
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=1000, description="Review comment")
    
    @validator('comment')
    def validate_comment(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
        return v


class ReviewUpdate(BaseModel):
    """Schema for updating a review"""
    rating: Optional[int] = Field(None, ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=1000, description="Review comment")
    
    @validator('comment')
    def validate_comment(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
        return v


class ReviewRead(BaseModel):
    """Schema for reading a review"""
    id: uuid.UUID
    user_id: uuid.UUID
    trip_id: uuid.UUID
    rating: int
    comment: Optional[str]
    created_at: datetime
    user_name: Optional[str] = None  # Populated from user relationship
    
    class Config:
        from_attributes = True


class TripAverageRating(BaseModel):
    """Schema for trip average rating"""
    trip_id: uuid.UUID
    average_rating: float
    total_reviews: int
    rating_distribution: dict = Field(
        default_factory=dict,
        description="Distribution of ratings (1-5 stars)"
    )
