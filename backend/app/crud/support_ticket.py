"""
CRUD operations for the Customer Support Ticketing System.
"""

import uuid
from datetime import datetime
from typing import Optional, List

from sqlmodel import Session, select

from app.models.support_ticket import (
    SupportTicket,
    TripSupportTicket,
    TicketMessage,
    TicketStatus,
    SenderType,
)
from app.schemas.support_ticket import (
    SupportTicketCreate,
    SupportTicketUpdate,
    TripSupportTicketCreate,
    TripSupportTicketUpdate,
    TicketMessageCreate,
)


# ===== Support Ticket (User → Admin) =====


def create_support_ticket(
    session: Session, *, user_id: uuid.UUID, data: SupportTicketCreate
) -> SupportTicket:
    ticket = SupportTicket(
        user_id=user_id,
        subject=data.subject,
        description=data.description,
        category=data.category,
        priority=data.priority,
    )
    session.add(ticket)
    session.commit()
    session.refresh(ticket)
    return ticket


def get_support_ticket(
    session: Session, *, ticket_id: uuid.UUID
) -> Optional[SupportTicket]:
    return session.get(SupportTicket, ticket_id)


def list_support_tickets_by_user(
    session: Session, *, user_id: uuid.UUID
) -> List[SupportTicket]:
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.user_id == user_id)
        .order_by(SupportTicket.created_at.desc())
    )
    return list(session.exec(stmt).all())


def list_all_support_tickets(
    session: Session,
    *,
    status_filter: Optional[TicketStatus] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[SupportTicket]:
    stmt = select(SupportTicket).order_by(SupportTicket.created_at.desc())
    if status_filter:
        stmt = stmt.where(SupportTicket.status == status_filter)
    stmt = stmt.offset(skip).limit(limit)
    return list(session.exec(stmt).all())


def update_support_ticket(
    session: Session,
    *,
    ticket: SupportTicket,
    data: SupportTicketUpdate,
) -> SupportTicket:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ticket, key, value)
    ticket.updated_at = datetime.utcnow()
    if data.status == TicketStatus.RESOLVED:
        ticket.resolved_at = datetime.utcnow()
    session.add(ticket)
    session.commit()
    session.refresh(ticket)
    return ticket


# ===== Trip Support Ticket (User → Provider) =====


def create_trip_support_ticket(
    session: Session,
    *,
    user_id: uuid.UUID,
    provider_id: uuid.UUID,
    trip_id: uuid.UUID,
    registration_id: uuid.UUID,
    data: TripSupportTicketCreate,
) -> TripSupportTicket:
    ticket = TripSupportTicket(
        user_id=user_id,
        provider_id=provider_id,
        trip_id=trip_id,
        registration_id=registration_id,
        subject=data.subject,
        description=data.description,
        priority=data.priority,
    )
    session.add(ticket)
    session.commit()
    session.refresh(ticket)
    return ticket


def get_trip_support_ticket(
    session: Session, *, ticket_id: uuid.UUID
) -> Optional[TripSupportTicket]:
    return session.get(TripSupportTicket, ticket_id)


def list_trip_support_tickets_by_user(
    session: Session, *, user_id: uuid.UUID
) -> List[TripSupportTicket]:
    stmt = (
        select(TripSupportTicket)
        .where(TripSupportTicket.user_id == user_id)
        .order_by(TripSupportTicket.created_at.desc())
    )
    return list(session.exec(stmt).all())


def list_trip_support_tickets_by_registration(
    session: Session, *, registration_id: uuid.UUID
) -> List[TripSupportTicket]:
    stmt = (
        select(TripSupportTicket)
        .where(TripSupportTicket.registration_id == registration_id)
        .order_by(TripSupportTicket.created_at.desc())
    )
    return list(session.exec(stmt).all())


def list_trip_support_tickets_by_provider(
    session: Session,
    *,
    provider_id: uuid.UUID,
    status_filter: Optional[TicketStatus] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[TripSupportTicket]:
    stmt = (
        select(TripSupportTicket)
        .where(TripSupportTicket.provider_id == provider_id)
        .order_by(TripSupportTicket.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(TripSupportTicket.status == status_filter)
    stmt = stmt.offset(skip).limit(limit)
    return list(session.exec(stmt).all())


def list_all_trip_support_tickets(
    session: Session,
    *,
    status_filter: Optional[TicketStatus] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[TripSupportTicket]:
    stmt = select(TripSupportTicket).order_by(TripSupportTicket.created_at.desc())
    if status_filter:
        stmt = stmt.where(TripSupportTicket.status == status_filter)
    stmt = stmt.offset(skip).limit(limit)
    return list(session.exec(stmt).all())


def update_trip_support_ticket(
    session: Session,
    *,
    ticket: TripSupportTicket,
    data: TripSupportTicketUpdate,
) -> TripSupportTicket:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ticket, key, value)
    ticket.updated_at = datetime.utcnow()
    if data.status == TicketStatus.RESOLVED:
        ticket.resolved_at = datetime.utcnow()
    session.add(ticket)
    session.commit()
    session.refresh(ticket)
    return ticket


# ===== Open-ticket uniqueness helpers =====

_OPEN_STATUSES = (TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_ON_USER)


def get_open_admin_ticket_for_user(
    session: Session, *, user_id: uuid.UUID
) -> Optional[SupportTicket]:
    """Return the first non-closed/resolved admin ticket for this user, or None."""
    from sqlalchemy import or_
    stmt = select(SupportTicket).where(
        SupportTicket.user_id == user_id,
        or_(*[SupportTicket.status == s for s in _OPEN_STATUSES]),
    )
    return session.exec(stmt).first()


def get_open_trip_ticket_for_user_and_provider(
    session: Session, *, user_id: uuid.UUID, provider_id: uuid.UUID
) -> Optional[TripSupportTicket]:
    """Return the first non-closed/resolved trip ticket the user has with a provider, or None."""
    from sqlalchemy import or_
    stmt = select(TripSupportTicket).where(
        TripSupportTicket.user_id == user_id,
        TripSupportTicket.provider_id == provider_id,
        or_(*[TripSupportTicket.status == s for s in _OPEN_STATUSES]),
    )
    return session.exec(stmt).first()


# ===== Ticket Messages =====


def add_message(
    session: Session,
    *,
    sender_id: uuid.UUID,
    sender_type: SenderType,
    data: TicketMessageCreate,
    support_ticket_id: Optional[uuid.UUID] = None,
    trip_support_ticket_id: Optional[uuid.UUID] = None,
) -> TicketMessage:
    msg = TicketMessage(
        support_ticket_id=support_ticket_id,
        trip_support_ticket_id=trip_support_ticket_id,
        sender_id=sender_id,
        sender_type=sender_type,
        message=data.message,
        attachments=data.attachments,
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg


def get_messages_for_support_ticket(
    session: Session, *, ticket_id: uuid.UUID
) -> List[TicketMessage]:
    stmt = (
        select(TicketMessage)
        .where(TicketMessage.support_ticket_id == ticket_id)
        .order_by(TicketMessage.created_at.asc())
    )
    return list(session.exec(stmt).all())


def get_messages_for_trip_support_ticket(
    session: Session, *, ticket_id: uuid.UUID
) -> List[TicketMessage]:
    stmt = (
        select(TicketMessage)
        .where(TicketMessage.trip_support_ticket_id == ticket_id)
        .order_by(TicketMessage.created_at.asc())
    )
    return list(session.exec(stmt).all())
