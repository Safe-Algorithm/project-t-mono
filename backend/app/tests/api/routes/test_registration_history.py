import datetime
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models.source import RequestSource
from app.models.trip_registration import TripRegistration as TripRegistrationModel
from app.models.trip_registration import TripRegistrationParticipant as TripRegistrationParticipantModel
from app.models.user import UserRole
from app.schemas.trip import TripCreate
from app.tests.utils.user import user_authentication_headers


def test_my_registration_history_empty(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    resp = client.get(f"{settings.API_V1_STR}/users/me/registrations", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_my_registration_history_orders_newest_first_and_filters_to_user(
    client: TestClient, session: Session
) -> None:
    provider_user, _provider_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )

    user1, headers1 = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    user2, headers2 = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    trip1 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name="Trip 1",
            description="Desc 1",
            start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            max_participants=10,
        ),
        provider=provider_user.provider,
    )

    trip2 = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name="Trip 2",
            description="Desc 2",
            start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=2),
            max_participants=10,
        ),
        provider=provider_user.provider,
    )

    older_date = datetime.datetime(2026, 1, 1, 10, 0, 0)
    newer_date = datetime.datetime(2026, 1, 2, 10, 0, 0)

    reg_old = TripRegistrationModel(
        trip_id=trip1.id,
        user_id=user1.id,
        registration_date=older_date,
        total_participants=1,
        total_amount=Decimal("100.00"),
        status="pending",
    )
    session.add(reg_old)
    session.commit()
    session.refresh(reg_old)

    p1 = TripRegistrationParticipantModel(
        registration_id=reg_old.id,
        package_id=None,
        registration_user_id=user1.id,
        is_registration_user=True,
        name="User One",
        email=user1.email,
        phone=user1.phone,
    )
    session.add(p1)

    reg_new = TripRegistrationModel(
        trip_id=trip2.id,
        user_id=user1.id,
        registration_date=newer_date,
        total_participants=2,
        total_amount=Decimal("200.00"),
        status="confirmed",
    )
    session.add(reg_new)

    reg_other_user = TripRegistrationModel(
        trip_id=trip1.id,
        user_id=user2.id,
        registration_date=newer_date,
        total_participants=1,
        total_amount=Decimal("99.00"),
        status="pending",
    )
    session.add(reg_other_user)

    session.commit()

    resp1 = client.get(f"{settings.API_V1_STR}/users/me/registrations", headers=headers1)
    assert resp1.status_code == 200
    data1 = resp1.json()

    assert len(data1) == 2
    assert data1[0]["id"] == str(reg_new.id)
    assert data1[1]["id"] == str(reg_old.id)

    # Ensure nested trip/provider info is present
    assert data1[0]["trip"]["id"] == str(trip2.id)
    assert data1[0]["trip"]["provider"]["company_name"] == provider_user.provider.company_name

    # Ensure participants included
    assert len(data1[1]["participants"]) == 1
    assert data1[1]["participants"][0]["name"] == "User One"

    resp2 = client.get(f"{settings.API_V1_STR}/users/me/registrations", headers=headers2)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2) == 1
    assert data2[0]["id"] == str(reg_other_user.id)


def test_my_registration_history_pagination(client: TestClient, session: Session) -> None:
    provider_user, _provider_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    trip = crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name="Trip Paginated",
            description="Desc",
            start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            max_participants=10,
        ),
        provider=provider_user.provider,
    )

    reg1 = TripRegistrationModel(
        trip_id=trip.id,
        user_id=user.id,
        registration_date=datetime.datetime(2026, 1, 1, 10, 0, 0),
        total_participants=1,
        total_amount=Decimal("10.00"),
        status="pending",
    )
    reg2 = TripRegistrationModel(
        trip_id=trip.id,
        user_id=user.id,
        registration_date=datetime.datetime(2026, 1, 2, 10, 0, 0),
        total_participants=1,
        total_amount=Decimal("20.00"),
        status="pending",
    )
    session.add(reg1)
    session.add(reg2)
    session.commit()

    resp = client.get(
        f"{settings.API_V1_STR}/users/me/registrations?skip=1&limit=1", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    # newest first -> skip=1 should return the older
    assert data[0]["id"] == str(reg1.id)
