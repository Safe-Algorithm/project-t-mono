"""add commission_rate_history table

Revision ID: b3c4d5e6f7a8
Revises: a1f2e3d4c5b6
Create Date: 2026-03-31 09:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision = 'b3c4d5e6f7a8'
down_revision = 'a1f2e3d4c5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'commission_rate_history',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('effective_from', sa.DateTime(), nullable=False),
        sa.Column('changed_by_admin_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['provider_id'], ['provider.id']),
        sa.ForeignKeyConstraint(['changed_by_admin_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_commission_rate_history_provider_id', 'commission_rate_history', ['provider_id'])
    op.create_index('ix_commission_rate_history_effective_from', 'commission_rate_history', ['effective_from'])

    # Back-fill: insert one history row per existing provider using their current
    # commission_rate, effective from the Unix epoch so every historical payment
    # finds a rate row when looked up.
    op.execute("""
        INSERT INTO commission_rate_history (id, provider_id, rate, effective_from, changed_by_admin_id, created_at)
        SELECT
            gen_random_uuid(),
            id,
            commission_rate,
            '1970-01-01 00:00:00'::timestamp,
            NULL,
            NOW()
        FROM provider
    """)


def downgrade():
    op.drop_index('ix_commission_rate_history_effective_from', table_name='commission_rate_history')
    op.drop_index('ix_commission_rate_history_provider_id', table_name='commission_rate_history')
    op.drop_table('commission_rate_history')
