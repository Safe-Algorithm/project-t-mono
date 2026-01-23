"""merge_heads

Revision ID: 48212653c574
Revises: 5e2be6fd1785, h1i2j3k4l5m6
Create Date: 2026-01-23 00:39:12.342421

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '48212653c574'
down_revision: Union[str, Sequence[str], None] = ('5e2be6fd1785', 'h1i2j3k4l5m6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
