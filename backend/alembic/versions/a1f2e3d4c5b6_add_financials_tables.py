"""Add financials tables: earning_lines, provider_payouts; add commission_rate to provider.

Revision ID: a1f2e3d4c5b6
Revises: 65f84c0d6008
Create Date: 2026-03-27 06:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers
revision = 'a1f2e3d4c5b6'
down_revision = '65f84c0d6008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── provider_payouts ──────────────────────────────────────────────────────
    op.create_table(
        'provider_payouts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('provider_id', sa.Uuid(), nullable=False),
        sa.Column('total_gross', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('total_platform_cut', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('total_provider_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('booking_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('note', sa.String(length=1000), nullable=True),
        sa.Column('bank_transfer_reference', sa.String(length=200), nullable=True),
        sa.Column('receipt_file_url', sa.String(length=500), nullable=True),
        sa.Column('paid_by_admin_id', sa.Uuid(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['paid_by_admin_id'], ['user.id']),
        sa.ForeignKeyConstraint(['provider_id'], ['provider.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_provider_payouts_provider_id', 'provider_payouts', ['provider_id'])
    op.create_index('ix_provider_payouts_paid_by_admin_id', 'provider_payouts', ['paid_by_admin_id'])

    # ── earning_lines ─────────────────────────────────────────────────────────
    op.create_table(
        'earning_lines',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('registration_id', sa.Uuid(), nullable=False),
        sa.Column('provider_id', sa.Uuid(), nullable=False),
        sa.Column('trip_id', sa.Uuid(), nullable=False),
        sa.Column('gross_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('platform_cut_pct', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('platform_cut_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('provider_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('payout_id', sa.Uuid(), nullable=True),
        sa.Column('became_owed_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['provider_id'], ['provider.id']),
        sa.ForeignKeyConstraint(['trip_id'], ['trip.id']),
        sa.ForeignKeyConstraint(['registration_id'], ['tripregistration.id']),
        sa.ForeignKeyConstraint(['payout_id'], ['provider_payouts.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('registration_id', name='uq_earning_lines_registration_id'),
    )
    op.create_index('ix_earning_lines_provider_id', 'earning_lines', ['provider_id'])
    op.create_index('ix_earning_lines_trip_id', 'earning_lines', ['trip_id'])
    op.create_index('ix_earning_lines_payout_id', 'earning_lines', ['payout_id'])
    op.create_index('ix_earning_lines_registration_id', 'earning_lines', ['registration_id'])

    # ── commission_rate on provider ───────────────────────────────────────────
    op.add_column(
        'provider',
        sa.Column(
            'commission_rate',
            sa.Numeric(precision=5, scale=2),
            nullable=False,
            server_default='10.00',
        ),
    )


def downgrade() -> None:
    op.drop_column('provider', 'commission_rate')
    op.drop_index('ix_earning_lines_registration_id', table_name='earning_lines')
    op.drop_index('ix_earning_lines_payout_id', table_name='earning_lines')
    op.drop_index('ix_earning_lines_trip_id', table_name='earning_lines')
    op.drop_index('ix_earning_lines_provider_id', table_name='earning_lines')
    op.drop_table('earning_lines')
    op.drop_index('ix_provider_payouts_paid_by_admin_id', table_name='provider_payouts')
    op.drop_index('ix_provider_payouts_provider_id', table_name='provider_payouts')
    op.drop_table('provider_payouts')
