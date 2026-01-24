"""add_trip_images_and_company_avatar

Revision ID: 6d217e135cd8
Revises: 7fdeb86ee157
Create Date: 2026-01-24 21:13:12.460005

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d217e135cd8'
down_revision: Union[str, Sequence[str], None] = '7fdeb86ee157'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('provider', sa.Column('company_avatar_url', sa.String(), nullable=True))
    op.add_column('trip', sa.Column('images', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('trip', 'images')
    op.drop_column('provider', 'company_avatar_url')
