"""add user_push_tokens table

Revision ID: a1b2c3d4e5f6
Revises: 2d0f2804bc89
Create Date: 2026-03-19 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '2d0f2804bc89'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_push_tokens',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('token', sqlmodel.AutoString(length=512), nullable=False),
        sa.Column('platform', sqlmodel.AutoString(length=16), nullable=False, server_default='android'),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_push_tokens_user_id', 'user_push_tokens', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_user_push_tokens_user_id', table_name='user_push_tokens')
    op.drop_table('user_push_tokens')
