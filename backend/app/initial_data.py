import logging

from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.schemas.user import UserCreate
from app.models.source import RequestSource

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db(session: Session) -> None:
    # Check if a superuser already exists for admin panel source
    user = crud.user.get_user_by_email_and_source(
        session, 
        email=settings.FIRST_SUPERUSER_EMAIL, 
        source=RequestSource.ADMIN_PANEL
    )
    if not user:
        # Create the superuser if one does not exist
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER_EMAIL,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            name=settings.FIRST_SUPERUSER_NAME,
            phone=settings.FIRST_SUPERUSER_PHONE,
            is_superuser=True,
        )
        user = crud.user.create_user(session, user_in=user_in, source=RequestSource.ADMIN_PANEL)
        logger.info(f"Superuser created: {user.email} for source: {RequestSource.ADMIN_PANEL.value}")
    else:
        logger.info(f"Superuser already exists: {user.email} for source: {RequestSource.ADMIN_PANEL.value}")


def main() -> None:
    logger.info("Creating initial data")
    with Session(engine) as session:
        init_db(session)
    logger.info("Initial data created")


if __name__ == "__main__":
    main()
