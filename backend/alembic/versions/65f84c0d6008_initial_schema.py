"""initial_schema

Revision ID: 65f84c0d6008
Revises: 
Create Date: 2026-03-08 10:44:27.946210

"""
from typing import Sequence, Union

from alembic import op
from sqlmodel import SQLModel

from app.models import *  # noqa: F401,F403
from app.models.links import TripParticipant, TripRating  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = '65f84c0d6008'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    SQLModel.metadata.create_all(bind=bind)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    SQLModel.metadata.drop_all(bind=bind)
