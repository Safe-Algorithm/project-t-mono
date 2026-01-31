"""merge_migration_heads

Revision ID: 9d0acebf018f
Revises: 8b58db787345, b2c3d4e5f6g7
Create Date: 2026-01-31 15:47:48.368619

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d0acebf018f'
down_revision: Union[str, Sequence[str], None] = ('8b58db787345', 'b2c3d4e5f6g7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
