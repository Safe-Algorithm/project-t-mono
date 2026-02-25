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

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import (
    get_session,
    get_current_active_user,
    get_current_active_admin,
    get_current_active_provider,
)
from app.models.user import User
from app.models.support_ticket import TicketStatus, SenderType
from app.models.trip_registration import TripRegistration
from app.models.trip import Trip
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
    # Verify registration exists
    from sqlmodel import select

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

    # Get trip to find provider
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

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
    from sqlmodel import select

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
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """Update a support ticket (status, priority, category). Admin only."""
    ticket = crud_support.get_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    updated = crud_support.update_support_ticket(session, ticket=ticket, data=data)
    return SupportTicketRead.model_validate(updated)


@router.post(
    "/admin/support/tickets/{ticket_id}/messages",
    response_model=TicketMessageRead,
)
def admin_reply_support_ticket(
    ticket_id: uuid.UUID,
    data: TicketMessageCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
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
# 4. Provider Panel – Trip Support Tickets
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
):
    """List trip support tickets for the current provider's trips."""
    tickets = crud_support.list_trip_support_tickets_by_provider(
        session, provider_id=current_user.id, status_filter=status, skip=skip, limit=limit
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
):
    """Get a trip support ticket with messages. Provider only (must own the trip)."""
    ticket = crud_support.get_trip_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.provider_id != current_user.id:
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
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Update a trip support ticket (status, priority). Provider only."""
    ticket = crud_support.get_trip_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.provider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your ticket")
    updated = crud_support.update_trip_support_ticket(
        session, ticket=ticket, data=data
    )
    return TripSupportTicketRead.model_validate(updated)


@router.post(
    "/provider/support/tickets/{ticket_id}/messages",
    response_model=TicketMessageRead,
)
def provider_reply_trip_support_ticket(
    ticket_id: uuid.UUID,
    data: TicketMessageCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Reply to a trip support ticket as provider."""
    ticket = crud_support.get_trip_support_ticket(session, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.provider_id != current_user.id:
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
    return TicketMessageRead.model_validate(msg)
