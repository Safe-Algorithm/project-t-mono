from sqlmodel import Session
import datetime
from app import crud
from app.models.trip import Trip
from app.schemas.trip import TripCreate
from app.tests.utils.provider import create_random_provider
from app.tests.utils.user import random_lower_string

def create_random_trip(session: Session) -> Trip:
    provider = create_random_provider(session)
    trip_in = TripCreate(
        name_en=random_lower_string(),
        name_ar=random_lower_string(),
        description_en=random_lower_string(),
        description_ar=random_lower_string(),
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        max_participants=10
    )
    return crud.trip.create_trip(session=session, trip_in=trip_in, provider=provider)
