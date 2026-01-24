"""add_avatar_file_name_to_user

Revision ID: 6b39828bfb8d
Revises: bc520c3e6ef9
Create Date: 2026-01-24 17:28:30.972738

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b39828bfb8d'
down_revision: Union[str, Sequence[str], None] = 'bc520c3e6ef9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user', sa.Column('avatar_file_name', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user', 'avatar_file_name')
