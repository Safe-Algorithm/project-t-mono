from typing import Optional
from sqlmodel import SQLModel

class ProviderRequestUpdate(SQLModel):
    status: str  # "approved" or "denied"
    denial_reason: Optional[str] = None
