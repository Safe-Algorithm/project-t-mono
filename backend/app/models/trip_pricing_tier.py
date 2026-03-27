import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .trip_package import TripPackage


class TripPricingTier(SQLModel, table=True):
    """Marginal (waterfall) pricing band for a trip package.

    Bands are ordered by from_participant ASC.  The rate applies to every
    participant whose 1-based position falls in the half-open interval
    [from_participant, next_band.from_participant).  The last band is open-ended.

    Example — base 5000, after 3 people 3000, after 5 people 1000:
        from_participant=1, price_per_person=5000
        from_participant=4, price_per_person=3000
        from_participant=6, price_per_person=1000
    """
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    package_id: uuid.UUID = Field(foreign_key="trippackage.id", index=True)
    from_participant: int = Field(ge=1)
    price_per_person: Decimal = Field(decimal_places=2, max_digits=10)

    package: "TripPackage" = Relationship(back_populates="pricing_tiers")
