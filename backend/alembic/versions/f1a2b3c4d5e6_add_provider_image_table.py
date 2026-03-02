"""add provider_image table

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-03-02 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'provider_image',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('b2_file_id', sqlmodel.AutoString(length=200), nullable=False),
        sa.Column('b2_file_name', sqlmodel.AutoString(length=500), nullable=False),
        sa.Column('url', sqlmodel.AutoString(length=1000), nullable=False),
        sa.Column('original_filename', sqlmodel.AutoString(length=255), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['provider_id'], ['provider.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_provider_image_provider_id', 'provider_image', ['provider_id'])


def downgrade() -> None:
    op.drop_index('ix_provider_image_provider_id', table_name='provider_image')
    op.drop_table('provider_image')
