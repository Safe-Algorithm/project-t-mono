"""Add TripPackageRequiredField table

Revision ID: f631b54bed49
Revises: 6a21a3e89116
Create Date: 2025-08-23 01:02:22.876969

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = 'f631b54bed49'
down_revision: Union[str, Sequence[str], None] = '6a21a3e89116'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create table using raw SQL to avoid enum recreation
    op.execute("""
        CREATE TABLE trippackagerequiredfield (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            package_id UUID NOT NULL REFERENCES trippackage(id),
            field_type tripfieldtype,
            is_required BOOLEAN NOT NULL DEFAULT true
        )
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('trippackagerequiredfield')
