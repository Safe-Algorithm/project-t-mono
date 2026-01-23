"""add_backblaze_file_id_to_provider_file

Revision ID: a9165c2aa20f
Revises: dbedbbc4da97
Create Date: 2026-01-23 01:04:19.606529

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9165c2aa20f'
down_revision: Union[str, Sequence[str], None] = 'dbedbbc4da97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('providerfile', sa.Column('backblaze_file_id', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('providerfile', 'backblaze_file_id')
