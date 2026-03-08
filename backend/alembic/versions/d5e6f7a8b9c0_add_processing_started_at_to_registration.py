"""Add processing_started_at column to tripregistration

Revision ID: d5e6f7a8b9c0
Revises: c1d2e3f4a5b6
Create Date: 2026-03-08

Adds processing_started_at to TripRegistration to track when a provider
flagged a self-arranged booking as 'processing'.
"""
from alembic import op
import sqlalchemy as sa
from typing import Union

revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'tripregistration',
        sa.Column('processing_started_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_column('tripregistration', 'processing_started_at')
