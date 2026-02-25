import logging
from sqlmodel import Session, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
import uuid
from app.models.user import User, UserRole
from app.models.source import RequestSource
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password

def get_user_by_email(session: Session, *, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email)).first()

def get_user_by_email_and_source(session: Session, *, email: str, source: RequestSource) -> User | None:
    return session.exec(select(User).where(User.email == email, User.source == source)).first()

def get_user_by_phone_and_source(session: Session, *, phone: str, source: RequestSource) -> User | None:
    return session.exec(select(User).where(User.phone == phone, User.source == source)).first()

def get_user_by_id(session: Session, *, user_id: uuid.UUID) -> User | None:
    return session.get(User, user_id)

def get_users(session: Session, *, skip: int = 0, limit: int = 100, source: RequestSource | None = None) -> list[User]:
    statement = select(User)
    if source:
        statement = statement.where(User.source == source)
    statement = statement.offset(skip).limit(limit)
    return session.exec(statement).all()

def get_users_by_provider_id(
    session: Session, *, provider_id: uuid.UUID
) -> list[User]:
    return session.exec(select(User).where(User.provider_id == provider_id)).all()

def get_users_by_role(session: Session, *, role: UserRole, skip: int = 0, limit: int = 100) -> list[User]:
    statement = select(User).where(User.role == role).offset(skip).limit(limit)
    return session.exec(statement).all()

def get_admin_users(session: Session, *, skip: int = 0, limit: int = 100) -> list[User]:
    # Admin users are super_user role with ADMIN_PANEL source
    statement = select(User).where(
        User.role == UserRole.SUPER_USER,
        User.source == RequestSource.ADMIN_PANEL
    ).offset(skip).limit(limit)
    return session.exec(statement).all()

def get_provider_users(session: Session, *, skip: int = 0, limit: int = 100) -> list[User]:
    statement = select(User).where(User.source == RequestSource.PROVIDERS_PANEL).offset(skip).limit(limit)
    return session.exec(statement).all()

def get_normal_users(session: Session, *, skip: int = 0, limit: int = 100) -> list[User]:
    statement = select(User).where(User.role == UserRole.NORMAL).offset(skip).limit(limit)
    return session.exec(statement).all()

def delete_user(session: Session, *, db_user: User) -> None:
    session.delete(db_user)
    session.commit()

def update_user_role(session: Session, *, db_user: User, role: UserRole) -> User:
    db_user.role = role
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

def create_user(session: Session, *, user_in: UserCreate, source: RequestSource = RequestSource.MOBILE_APP) -> User:
    logger.info(f"Creating user with email: {user_in.email}")
    logger.info("Hashing password.")
    hashed_password = get_password_hash(user_in.password)
    logger.info("Password hashed successfully.")
    db_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        name=user_in.name,
        phone=user_in.phone,
        is_superuser=user_in.is_superuser,
        role=user_in.role,
        provider_id=user_in.provider_id,
        source=source,
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

def update_user_role_and_provider(
    session: Session, *, db_user: User, role: UserRole, provider_id: uuid.UUID
) -> User:
    db_user.role = role
    db_user.provider_id = provider_id
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user
