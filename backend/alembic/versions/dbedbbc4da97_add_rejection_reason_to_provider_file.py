"""add_rejection_reason_to_provider_file

Revision ID: dbedbbc4da97
Revises: 48212653c574
Create Date: 2026-01-23 01:01:17.656581

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dbedbbc4da97'
down_revision: Union[str, Sequence[str], None] = '48212653c574'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('providerfile', sa.Column('rejection_reason', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('providerfile', 'rejection_reason')
