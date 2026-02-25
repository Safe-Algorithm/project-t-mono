"""add_company_cover_url_to_provider

Revision ID: a3f8b2c1d4e5
Revises: 7f9c4e05d00b
Create Date: 2026-02-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f8b2c1d4e5'
down_revision: Union[str, Sequence[str], None] = '7f9c4e05d00b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('provider', sa.Column('company_cover_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('provider', 'company_cover_url')
