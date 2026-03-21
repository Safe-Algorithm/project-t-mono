"""
API routes for the Customer Support Ticketing System.

Sections:
  1. User endpoints – create/list/reply to admin tickets
  2. User endpoints – create/list/reply to trip (provider) tickets
  3. Admin endpoints – view/manage all admin tickets
  4. Provider endpoints – view/manage trip tickets for their trips
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import (
    get_session,
    get_current_active_user,
    get_current_active_admin,
    get_current_active_provider,
)
from app.api.rbac_deps import require_admin_permission, require_provider_permission
from app.models.user import User
from app.models.support_ticket import TicketStatus, SenderType
from app.models.trip_registration import TripRegistration
from app.models.trip import Trip
from app.models.user_push_token import UserPushToken
from app.crud import support_ticket as crud_support
from app.schemas.support_ticket import (
    SupportTicketCreate,
    SupportTicketUpdate,
    SupportTicketRead,
    SupportTicketReadWithMessages,
    TripSupportTicketCreate,
    TripSupportTicketUpdate,
    TripSupportTicketRead,
    TripSupportTicketReadWithMessages,
    TicketMessageCreate,
    TicketMessageRead,
)
from app.services.fcm import fcm_service


def _push_tokens(session: Session, user_id: uuid.UUID) -> list[str]:
    """Return all FCM tokens for a user."""
    return [
        pt.token for pt in session.exec(
            select(UserPushToken).where(UserPushToken.user_id == user_id)
        ).all()
    ]


def _user_lang(user: User) -> str:
    return getattr(user, "preferred_language", "en") or "en"


router = APIRouter()


# =====================================================================
# 1. User → Admin Support Tickets
# =====================================================================


@router.post("/support/tickets", response_model=SupportTicketRead)
def user_create_support_ticket(
    data: SupportTicketCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new support ticket (user → admin)."""
    ticket = crud_support.create_support_ticket(
        session, user_id=current_user.id, data=data
    )
    return SupportTicketRead.model_validate(ticket)


@router.get("/support/tickets", response_model=List[SupportTicketRead])
def user_list_support_tickets(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """List the current user's admin support tickets."""
    tickets = crud_support.list_support_tickets_by_user(
        session, user_id=current_user.id
    )
    return [SupportTicketRead.model_validate(t) for t in tickets]


@router.get("/support/tickets/{ticket_id}", response_model=SupportTicketReadWithMessages)
def user_get_support_ticket(
    ticket_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get a support ticket with messages. User can only see their own."""
    ticket = crud_support.get_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    messages = crud_support.get_messages_for_support_ticket(session, ticket_id=ticket_id)
    result = SupportTicketReadWithMessages.model_validate(ticket)
    result.messages = [TicketMessageRead.model_validate(m) for m in messages]
    return result


@router.post(
    "/support/tickets/{ticket_id}/messages", response_model=TicketMessageRead
)
def user_reply_support_ticket(
    ticket_id: uuid.UUID,
    data: TicketMessageCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """Reply to an admin support ticket (user side)."""
    ticket = crud_support.get_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Ticket is closed")
    msg = crud_support.add_message(
        session,
        sender_id=current_user.id,
        sender_type=SenderType.USER,
        data=data,
        support_ticket_id=ticket_id,
    )
    return TicketMessageRead.model_validate(msg)


# =====================================================================
# 2. User → Provider Trip Support Tickets
# =====================================================================


@router.post(
    "/trips/{trip_id}/support", response_model=TripSupportTicketRead
)
def user_create_trip_support_ticket(
    trip_id: uuid.UUID,
    data: TripSupportTicketCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """Create a trip support ticket. User must have a registration for this trip."""
    from datetime import datetime

    # Get trip first so we can validate it
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Block tickets for trips that have already ended
    if trip.end_date and trip.end_date < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Cannot open a support ticket for a trip that has already ended",
        )

    # Verify the user has a registration for this trip
    stmt = select(TripRegistration).where(
        TripRegistration.trip_id == trip_id,
        TripRegistration.user_id == current_user.id,
    )
    registration = session.exec(stmt).first()
    if not registration:
        raise HTTPException(
            status_code=403,
            detail="You must be registered for this trip to create a support ticket",
        )

    ticket = crud_support.create_trip_support_ticket(
        session,
        user_id=current_user.id,
        provider_id=trip.provider_id,
        trip_id=trip_id,
        registration_id=registration.id,
        data=data,
    )
    return TripSupportTicketRead.model_validate(ticket)


@router.get(
    "/trips/{trip_id}/support", response_model=List[TripSupportTicketRead]
)
def user_list_trip_support_tickets(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """List user's support tickets for a specific trip."""
    stmt = select(TripRegistration).where(
        TripRegistration.trip_id == trip_id,
        TripRegistration.user_id == current_user.id,
    )
    registration = session.exec(stmt).first()
    if not registration:
        raise HTTPException(status_code=403, detail="Not registered for this trip")

    tickets = crud_support.list_trip_support_tickets_by_registration(
        session, registration_id=registration.id
    )
    return [TripSupportTicketRead.model_validate(t) for t in tickets]


@router.get(
    "/support/trip-tickets",
    response_model=List[TripSupportTicketRead],
)
def user_list_all_trip_support_tickets(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """List all trip support tickets raised by the current user (across all trips)."""
    tickets = crud_support.list_trip_support_tickets_by_user(
        session, user_id=current_user.id
    )
    return [TripSupportTicketRead.model_validate(t) for t in tickets]


@router.get(
    "/support/trip-tickets/{ticket_id}",
    response_model=TripSupportTicketReadWithMessages,
)
def user_get_trip_support_ticket(
    ticket_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """Get a trip support ticket with messages. User can only see their own."""
    ticket = crud_support.get_trip_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    messages = crud_support.get_messages_for_trip_support_ticket(
        session, ticket_id=ticket_id
    )
    result = TripSupportTicketReadWithMessages.model_validate(ticket)
    result.messages = [TicketMessageRead.model_validate(m) for m in messages]
    return result


@router.post(
    "/support/trip-tickets/{ticket_id}/messages",
    response_model=TicketMessageRead,
)
def user_reply_trip_support_ticket(
    ticket_id: uuid.UUID,
    data: TicketMessageCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """Reply to a trip support ticket (user side)."""
    ticket = crud_support.get_trip_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Ticket is closed")
    msg = crud_support.add_message(
        session,
        sender_id=current_user.id,
        sender_type=SenderType.USER,
        data=data,
        trip_support_ticket_id=ticket_id,
    )
    return TicketMessageRead.model_validate(msg)


# =====================================================================
# 3. Admin Panel – Admin Support Tickets
# =====================================================================


@router.get(
    "/admin/support/tickets", response_model=List[SupportTicketRead]
)
def admin_list_support_tickets(
    status: Optional[TicketStatus] = None,
    skip: int = 0,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
    _rbac: None = Depends(require_admin_permission),
):
    """List all admin support tickets. Admin only."""
    tickets = crud_support.list_all_support_tickets(
        session, status_filter=status, skip=skip, limit=limit
    )
    return [SupportTicketRead.model_validate(t) for t in tickets]


@router.get(
    "/admin/support/tickets/{ticket_id}",
    response_model=SupportTicketReadWithMessages,
)
def admin_get_support_ticket(
    ticket_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
    _rbac: None = Depends(require_admin_permission),
):
    """Get a support ticket with messages. Admin only."""
    ticket = crud_support.get_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    messages = crud_support.get_messages_for_support_ticket(
        session, ticket_id=ticket_id
    )
    result = SupportTicketReadWithMessages.model_validate(ticket)
    result.messages = [TicketMessageRead.model_validate(m) for m in messages]
    return result


@router.patch(
    "/admin/support/tickets/{ticket_id}", response_model=SupportTicketRead
)
def admin_update_support_ticket(
    ticket_id: uuid.UUID,
    data: SupportTicketUpdate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
    _rbac: None = Depends(require_admin_permission),
):
    """Update a support ticket (status, priority, category). Admin only."""
    ticket = crud_support.get_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    updated = crud_support.update_support_ticket(session, ticket=ticket, data=data)
    # Notify ticket owner if status changed
    if data.status is not None and data.status != ticket.status:
        tokens = _push_tokens(session, ticket.user_id)
        owner = session.get(User, ticket.user_id)
        lang = _user_lang(owner) if owner else "en"
        for token in tokens:
            background_tasks.add_task(
                fcm_service.notify_support_ticket_status,
                fcm_token=token, subject=ticket.subject,
                status=data.status.value, lang=lang,
                ticket_id=str(ticket_id), ticket_type="admin",
            )
    return SupportTicketRead.model_validate(updated)


@router.post(
    "/admin/support/tickets/{ticket_id}/messages",
    response_model=TicketMessageRead,
)
def admin_reply_support_ticket(
    ticket_id: uuid.UUID,
    data: TicketMessageCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
    _rbac: None = Depends(require_admin_permission),
):
    """Reply to a support ticket as admin."""
    ticket = crud_support.get_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    msg = crud_support.add_message(
        session,
        sender_id=current_user.id,
        sender_type=SenderType.ADMIN,
        data=data,
        support_ticket_id=ticket_id,
    )
    # Notify ticket owner
    tokens = _push_tokens(session, ticket.user_id)
    owner = session.get(User, ticket.user_id)
    lang = _user_lang(owner) if owner else "en"
    for token in tokens:
        background_tasks.add_task(
            fcm_service.notify_support_ticket_message,
            fcm_token=token, subject=ticket.subject,
            preview=data.message, lang=lang,
            ticket_id=str(ticket_id), ticket_type="admin",
        )
    return TicketMessageRead.model_validate(msg)


# Admin can also see all trip support tickets
@router.get(
    "/admin/support/trip-tickets",
    response_model=List[TripSupportTicketRead],
)
def admin_list_trip_support_tickets(
    status: Optional[TicketStatus] = None,
    skip: int = 0,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
    _rbac: None = Depends(require_admin_permission),
):
    """List all trip support tickets. Admin only."""
    tickets = crud_support.list_all_trip_support_tickets(
        session, status_filter=status, skip=skip, limit=limit
    )
    return [TripSupportTicketRead.model_validate(t) for t in tickets]


@router.get(
    "/admin/support/trip-tickets/{ticket_id}",
    response_model=TripSupportTicketReadWithMessages,
)
def admin_get_trip_support_ticket(
    ticket_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
    _rbac: None = Depends(require_admin_permission),
):
    """Get a trip support ticket with messages. Admin only."""
    ticket = crud_support.get_trip_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    messages = crud_support.get_messages_for_trip_support_ticket(
        session, ticket_id=ticket_id
    )
    result = TripSupportTicketReadWithMessages.model_validate(ticket)
    result.messages = [TicketMessageRead.model_validate(m) for m in messages]
    return result


# =====================================================================
# 4. Provider Panel – Admin Support Tickets (Provider → Admin)
# =====================================================================


@router.post("/provider/support/admin-tickets", response_model=SupportTicketRead)
def provider_create_admin_ticket(
    data: SupportTicketCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Create a new support ticket directed to admin (provider → admin)."""
    ticket = crud_support.create_support_ticket(
        session, user_id=current_user.id, data=data
    )
    return SupportTicketRead.model_validate(ticket)


@router.get("/provider/support/admin-tickets", response_model=List[SupportTicketRead])
def provider_list_admin_tickets(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """List admin support tickets raised by this provider."""
    tickets = crud_support.list_support_tickets_by_user(
        session, user_id=current_user.id
    )
    return [SupportTicketRead.model_validate(t) for t in tickets]


@router.get(
    "/provider/support/admin-tickets/{ticket_id}",
    response_model=SupportTicketReadWithMessages,
)
def provider_get_admin_ticket(
    ticket_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Get an admin support ticket with messages. Provider can only see their own."""
    ticket = crud_support.get_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    messages = crud_support.get_messages_for_support_ticket(session, ticket_id=ticket_id)
    result = SupportTicketReadWithMessages.model_validate(ticket)
    result.messages = [TicketMessageRead.model_validate(m) for m in messages]
    return result


@router.post(
    "/provider/support/admin-tickets/{ticket_id}/messages",
    response_model=TicketMessageRead,
)
def provider_reply_admin_ticket(
    ticket_id: uuid.UUID,
    data: TicketMessageCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Reply to an admin support ticket (provider side)."""
    ticket = crud_support.get_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Ticket is closed")
    msg = crud_support.add_message(
        session,
        sender_id=current_user.id,
        sender_type=SenderType.PROVIDER,
        data=data,
        support_ticket_id=ticket_id,
    )
    return TicketMessageRead.model_validate(msg)


# =====================================================================
# 5. Provider Panel – Trip Support Tickets (User → Provider)
# =====================================================================


@router.get(
    "/provider/support/tickets",
    response_model=List[TripSupportTicketRead],
)
def provider_list_trip_support_tickets(
    status: Optional[TicketStatus] = None,
    skip: int = 0,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """List trip support tickets for the current provider's trips."""
    if not current_user.provider_id:
        return []
    tickets = crud_support.list_trip_support_tickets_by_provider(
        session, provider_id=current_user.provider_id, status_filter=status, skip=skip, limit=limit
    )
    return [TripSupportTicketRead.model_validate(t) for t in tickets]


@router.get(
    "/provider/support/tickets/{ticket_id}",
    response_model=TripSupportTicketReadWithMessages,
)
def provider_get_trip_support_ticket(
    ticket_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Get a trip support ticket with messages. Provider only (must own the trip)."""
    ticket = crud_support.get_trip_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    messages = crud_support.get_messages_for_trip_support_ticket(
        session, ticket_id=ticket_id
    )
    result = TripSupportTicketReadWithMessages.model_validate(ticket)
    result.messages = [TicketMessageRead.model_validate(m) for m in messages]
    return result


@router.patch(
    "/provider/support/tickets/{ticket_id}",
    response_model=TripSupportTicketRead,
)
def provider_update_trip_support_ticket(
    ticket_id: uuid.UUID,
    data: TripSupportTicketUpdate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Update a trip support ticket (status, priority). Provider only."""
    ticket = crud_support.get_trip_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    updated = crud_support.update_trip_support_ticket(
        session, ticket=ticket, data=data
    )
    # Notify user if status changed
    if data.status is not None and data.status != ticket.status:
        tokens = _push_tokens(session, ticket.user_id)
        user = session.get(User, ticket.user_id)
        lang = _user_lang(user) if user else "en"
        for token in tokens:
            background_tasks.add_task(
                fcm_service.notify_support_ticket_status,
                fcm_token=token, subject=ticket.subject,
                status=data.status.value, lang=lang,
                ticket_id=str(ticket_id), ticket_type="trip",
            )
    return TripSupportTicketRead.model_validate(updated)


@router.post(
    "/provider/support/tickets/{ticket_id}/messages",
    response_model=TicketMessageRead,
)
def provider_reply_trip_support_ticket(
    ticket_id: uuid.UUID,
    data: TicketMessageCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _rbac: None = Depends(require_provider_permission),
):
    """Reply to a trip support ticket as provider."""
    ticket = crud_support.get_trip_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Ticket is closed")
    msg = crud_support.add_message(
        session,
        sender_id=current_user.id,
        sender_type=SenderType.PROVIDER,
        data=data,
        trip_support_ticket_id=ticket_id,
    )
    # Notify the user who raised the trip ticket
    tokens = _push_tokens(session, ticket.user_id)
    user = session.get(User, ticket.user_id)
    lang = _user_lang(user) if user else "en"
    for token in tokens:
        background_tasks.add_task(
            fcm_service.notify_support_ticket_message,
            fcm_token=token, subject=ticket.subject,
            preview=data.message, lang=lang,
            ticket_id=str(ticket_id), ticket_type="trip",
        )
    return TicketMessageRead.model_validate(msg)
