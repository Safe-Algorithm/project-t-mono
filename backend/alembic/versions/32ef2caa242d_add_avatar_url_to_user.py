"""add_avatar_url_to_user

Revision ID: 32ef2caa242d
Revises: a9165c2aa20f
Create Date: 2026-01-24 00:21:17.664181

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '32ef2caa242d'
down_revision: Union[str, Sequence[str], None] = 'a9165c2aa20f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user', sa.Column('avatar_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user', 'avatar_url')
