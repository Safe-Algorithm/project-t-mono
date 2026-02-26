"""add_unique_paid_payment_per_registration

Revision ID: b1c2d3e4f5a6
Revises: a3f8b2c1d4e5
Create Date: 2026-02-25 12:00:00.000000

Adds a partial unique index on payments(registration_id) WHERE status = 'paid'.
This provides a database-level hard guarantee that only one PAID payment can
exist per registration, preventing double-charges from race conditions that
slip past the application-level check.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a3f8b2c1d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX uq_one_paid_payment_per_registration
        ON payments (registration_id)
        WHERE status = 'PAID'::paymentstatus
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_one_paid_payment_per_registration")
