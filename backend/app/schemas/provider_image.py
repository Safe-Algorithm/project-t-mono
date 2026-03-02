import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ProviderImageRead(BaseModel):
    id: uuid.UUID
    provider_id: uuid.UUID
    url: str
    b2_file_id: str
    b2_file_name: str
    original_filename: Optional[str]
    width: Optional[int]
    height: Optional[int]
    size_bytes: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderImageListResponse(BaseModel):
    items: List[ProviderImageRead]
    total: int
