from typing import Optional
from sqlmodel import SQLModel

class ProviderRequestUpdate(SQLModel):
    denial_reason: Optional[str] = None
