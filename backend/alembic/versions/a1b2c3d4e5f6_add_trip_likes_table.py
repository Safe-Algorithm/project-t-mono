"""add_trip_likes_table

Revision ID: a1b2c3d4e5f6
Revises: 9c22d4f5e7g8
Create Date: 2026-01-26

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9c22d4f5e7g8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'trip_likes',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('trip_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['trip.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'trip_id', name='unique_user_trip_like')
    )
    op.create_index(op.f('ix_trip_likes_trip_id'), 'trip_likes', ['trip_id'], unique=False)
    op.create_index(op.f('ix_trip_likes_user_id'), 'trip_likes', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_trip_likes_user_id'), table_name='trip_likes')
    op.drop_index(op.f('ix_trip_likes_trip_id'), table_name='trip_likes')
    op.drop_table('trip_likes')
