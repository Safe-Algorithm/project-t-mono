"""add_triprating_images

Revision ID: 8b21c3f4d5e6
Revises: 6d217e135cd8
Create Date: 2026-01-26

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b21c3f4d5e6'
down_revision: Union[str, Sequence[str], None] = '6d217e135cd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('triprating', sa.Column('images', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('triprating', 'images')
