"""add_trip_type_enum_to_trip

Revision ID: 413fb790884c
Revises: d4e5f6a7b8c9
Create Date: 2026-03-02 03:15:58.732548

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '413fb790884c'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE triptype AS ENUM ('guided', 'self_arranged')")
    op.add_column('trip', sa.Column('trip_type', sa.Enum('guided', 'self_arranged', name='triptype'), server_default='guided', nullable=False))


def downgrade() -> None:
    op.drop_column('trip', 'trip_type')
    op.execute("DROP TYPE IF EXISTS triptype")
