"""add trip content_hash column

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-03-08 08:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('trip', sa.Column('content_hash', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_trip_content_hash'), 'trip', ['content_hash'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_trip_content_hash'), table_name='trip')
    op.drop_column('trip', 'content_hash')
