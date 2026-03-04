"""add trip_share table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-04
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'trip_share',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('trip_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('share_token', sa.String(length=64), nullable=False),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_viewed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['trip_id'], ['trip.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('trip_id'),
        sa.UniqueConstraint('share_token'),
    )
    op.create_index('ix_trip_share_trip_id', 'trip_share', ['trip_id'])
    op.create_index('ix_trip_share_share_token', 'trip_share', ['share_token'])


def downgrade():
    op.drop_index('ix_trip_share_share_token', table_name='trip_share')
    op.drop_index('ix_trip_share_trip_id', table_name='trip_share')
    op.drop_table('trip_share')
