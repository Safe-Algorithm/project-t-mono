"""add meeting_location check constraint

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-03-03

Ensures that whenever has_meeting_place is TRUE, meeting_location must be non-NULL and non-empty.
"""
from alembic import op

revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_check_constraint(
        'ck_trip_meeting_location_required',
        'trip',
        "has_meeting_place = FALSE OR (meeting_location IS NOT NULL AND meeting_location <> '')",
    )


def downgrade():
    op.drop_constraint('ck_trip_meeting_location_required', 'trip', type_='check')
