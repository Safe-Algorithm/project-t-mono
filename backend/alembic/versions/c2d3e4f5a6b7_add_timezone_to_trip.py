"""add_timezone_to_trip

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-02-26 03:00:00.000000

Adds a `timezone` column (IANA string) to the `trip` table.
Existing trips default to 'Asia/Riyadh' (the primary market).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'trip',
        sa.Column('timezone', sa.String(length=64), nullable=False, server_default='Asia/Riyadh')
    )


def downgrade() -> None:
    op.drop_column('trip', 'timezone')
