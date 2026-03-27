"""initial_schema

Revision ID: 65f84c0d6008
Revises: 
Create Date: 2026-03-08 10:44:27.946210

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
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
    # SQLModel.metadata.drop_all() fails on circular FK cycles (e.g. user<->provider<->providerrequest).
    # Instead, fetch all public tables and drop them with CASCADE to handle any FK order.
    bind = op.get_bind()
    bind.execute(sa.text("SET session_replication_role = replica"))
    tables = bind.execute(
        sa.text("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'alembic_version'")
    ).fetchall()
    for (table,) in tables:
        bind.execute(sa.text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
    bind.execute(sa.text("SET session_replication_role = DEFAULT"))
