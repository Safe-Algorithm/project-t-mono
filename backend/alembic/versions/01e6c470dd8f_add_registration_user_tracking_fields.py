"""add_registration_user_tracking_fields

Revision ID: 01e6c470dd8f
Revises: f631b54bed49
Create Date: 2025-08-26 03:56:52.415383

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "01e6c470dd8f"
down_revision: Union[str, Sequence[str], None] = "f631b54bed49"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add columns as nullable first
    op.add_column("tripregistrationparticipant", sa.Column("registration_user_id", sqlmodel.sql.sqltypes.GUID(), nullable=True))
    op.add_column("tripregistrationparticipant", sa.Column("is_registration_user", sa.Boolean(), nullable=True))
    
    # Update existing records to set registration_user_id to the user_id from the registration
    # and is_registration_user to False for all existing participants
    op.execute("""
        UPDATE tripregistrationparticipant 
        SET registration_user_id = (
            SELECT user_id 
            FROM tripregistration 
            WHERE tripregistration.id = tripregistrationparticipant.registration_id
        ),
        is_registration_user = false
        WHERE registration_user_id IS NULL
    """)
    
    # Now make the columns non-nullable
    op.alter_column("tripregistrationparticipant", "registration_user_id", nullable=False)
    op.alter_column("tripregistrationparticipant", "is_registration_user", nullable=False)
    
    # Add foreign key constraint
    op.create_foreign_key("fk_tripregistrationparticipant_registration_user_id", "tripregistrationparticipant", "user", ["registration_user_id"], ["id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_tripregistrationparticipant_registration_user_id", "tripregistrationparticipant", type_="foreignkey")
    op.drop_column("tripregistrationparticipant", "is_registration_user")
    op.drop_column("tripregistrationparticipant", "registration_user_id")
