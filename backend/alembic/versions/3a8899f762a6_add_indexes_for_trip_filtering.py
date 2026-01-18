"""add_indexes_for_trip_filtering

Revision ID: 3a8899f762a6
Revises: 11c278849b87
Create Date: 2026-01-18 19:18:04.874272

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a8899f762a6'
down_revision: Union[str, Sequence[str], None] = '11c278849b87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add indexes for trip filtering performance
    op.create_index('idx_trip_provider_active', 'trip', ['provider_id', 'is_active'])
    op.create_index('idx_trip_start_date', 'trip', ['start_date'])
    op.create_index('idx_trip_end_date', 'trip', ['end_date'])
    op.create_index('idx_trip_max_participants', 'trip', ['max_participants'])
    op.create_index('idx_trip_name', 'trip', ['name'], postgresql_ops={'name': 'text_pattern_ops'})
    op.create_index('idx_trippackage_price', 'trippackage', ['price'])
    op.create_index('idx_trippackage_trip_active', 'trippackage', ['trip_id', 'is_active'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index('idx_trippackage_trip_active', table_name='trippackage')
    op.drop_index('idx_trippackage_price', table_name='trippackage')
    op.drop_index('idx_trip_name', table_name='trip')
    op.drop_index('idx_trip_max_participants', table_name='trip')
    op.drop_index('idx_trip_end_date', table_name='trip')
    op.drop_index('idx_trip_start_date', table_name='trip')
    op.drop_index('idx_trip_provider_active', table_name='trip')
