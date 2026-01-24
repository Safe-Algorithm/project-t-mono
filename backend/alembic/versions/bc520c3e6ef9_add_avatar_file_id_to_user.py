"""add_avatar_file_id_to_user

Revision ID: bc520c3e6ef9
Revises: 32ef2caa242d
Create Date: 2026-01-24 01:05:11.617076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc520c3e6ef9'
down_revision: Union[str, Sequence[str], None] = '32ef2caa242d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user', sa.Column('avatar_file_id', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user', 'avatar_file_id')
