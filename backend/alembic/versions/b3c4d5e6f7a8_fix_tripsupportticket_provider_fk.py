"""fix tripsupportticket provider_id fk from user to provider

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-21 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision: str = "b3c4d5e6f7a8"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old FK constraint pointing to user.id
    op.drop_constraint(
        "tripsupportticket_provider_id_fkey",
        "tripsupportticket",
        type_="foreignkey",
    )
    # Add new FK constraint pointing to provider.id
    op.create_foreign_key(
        "tripsupportticket_provider_id_fkey",
        "tripsupportticket",
        "provider",
        ["provider_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "tripsupportticket_provider_id_fkey",
        "tripsupportticket",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "tripsupportticket_provider_id_fkey",
        "tripsupportticket",
        "user",
        ["provider_id"],
        ["id"],
    )
