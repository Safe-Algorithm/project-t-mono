"""add_meeting_place_name_to_trip

Revision ID: b2700a1639c1
Revises: b2c3d4e5f6a7
Create Date: 2026-03-06 00:43:17.027255

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2700a1639c1'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trip', sa.Column('meeting_place_name', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('trip', 'meeting_place_name')
