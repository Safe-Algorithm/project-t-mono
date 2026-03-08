"""add_meeting_place_name_ar_and_optional_fee_names

Revision ID: c1d2e3f4a5b6
Revises: b2700a1639c1
Create Date: 2026-03-08 05:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b2700a1639c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add meeting_place_name_ar to trip table
    op.add_column('trip', sa.Column('meeting_place_name_ar', sa.String(length=200), nullable=True))

    # Make trip_extra_fees.name_en and name_ar nullable
    op.alter_column('trip_extra_fees', 'name_en', nullable=True)
    op.alter_column('trip_extra_fees', 'name_ar', nullable=True)


def downgrade() -> None:
    op.drop_column('trip', 'meeting_place_name_ar')
    op.alter_column('trip_extra_fees', 'name_en', nullable=False)
    op.alter_column('trip_extra_fees', 'name_ar', nullable=False)
