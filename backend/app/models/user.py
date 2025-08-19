import uuid
from typing import List, Optional, TYPE_CHECKING
import enum
from sqlmodel import Field, SQLModel, Relationship

from .links import TripParticipant, TripRating

if TYPE_CHECKING:
    from .trip import Trip
    from .provider import Provider, ProviderRequest


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    PROVIDER = "provider"
    SUPER_PROVIDER = "super_provider"
    NORMAL = "normal"

class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    phone: str
    hashed_password: str
    is_active: bool = Field(default=True)
    is_superuser: bool = Field(default=False)
    role: UserRole = Field(default=UserRole.NORMAL)

    provider_id: Optional[uuid.UUID] = Field(default=None, foreign_key="provider.id")
    provider: Optional["Provider"] = Relationship(back_populates="users")

    provider_requests: List["ProviderRequest"] = Relationship(back_populates="user")

    trips: List["Trip"] = Relationship(back_populates="participants", link_model=TripParticipant)
    trip_ratings: List[TripRating] = Relationship(back_populates="user")
