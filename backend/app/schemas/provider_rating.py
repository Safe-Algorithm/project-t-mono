"""
Schemas for provider reviews and ratings
"""

from datetime import datetime
from typing import Optional, List
import uuid
from pydantic import BaseModel, Field, validator


class ProviderRatingCreate(BaseModel):
    """Schema for creating a provider rating"""
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=1000, description="Review comment")

    @validator('comment')
    def validate_comment(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
        return v


class ProviderRatingUpdate(BaseModel):
    """Schema for updating a provider rating"""
    rating: Optional[int] = Field(None, ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=1000, description="Review comment")

    @validator('comment')
    def validate_comment(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
        return v


class ProviderRatingRead(BaseModel):
    """Schema for reading a provider rating"""
    id: uuid.UUID
    user_id: uuid.UUID
    provider_id: uuid.UUID
    rating: int
    comment: Optional[str]
    images: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class ProviderAverageRating(BaseModel):
    """Schema for provider average rating"""
    provider_id: uuid.UUID
    average_rating: float
    total_ratings: int
    rating_distribution: dict = Field(
        default_factory=dict,
        description="Distribution of ratings (1-5 stars)"
    )
