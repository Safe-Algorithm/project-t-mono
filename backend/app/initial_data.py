import logging

from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.schemas.user import UserCreate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db(session: Session) -> None:
    # Check if a superuser already exists
    user = crud.user.get_user_by_email(session, email=settings.FIRST_SUPERUSER_EMAIL)
    if not user:
        # Create the superuser if one does not exist
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER_EMAIL,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            name=settings.FIRST_SUPERUSER_NAME,
            phone=settings.FIRST_SUPERUSER_PHONE,
            is_superuser=True,
        )
        user = crud.user.create_user(session, user_in=user_in)
        logger.info(f"Superuser created: {user.email}")
    else:
        logger.info(f"Superuser already exists: {user.email}")


def main() -> None:
    logger.info("Creating initial data")
    with Session(engine) as session:
        init_db(session)
    logger.info("Initial data created")


if __name__ == "__main__":
    main()
