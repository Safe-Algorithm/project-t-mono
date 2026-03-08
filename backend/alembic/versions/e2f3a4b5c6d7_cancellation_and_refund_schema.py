"""Cancellation and refund schema changes

Revision ID: e2f3a4b5c6d7
Revises: d5e6f7a8b9c0
Create Date: 2026-03-08

Changes:
- Make registration_deadline NOT NULL on trip table (backfill with start_date)
- Add cancelled_at, cancellation_reason, cancelled_by to tripregistration
- Create refundrecord table for full audit trail
"""
from alembic import op
import sqlalchemy as sa
from typing import Union

revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Backfill registration_deadline with start_date where NULL, then make NOT NULL
    op.execute("UPDATE trip SET registration_deadline = start_date WHERE registration_deadline IS NULL")
    op.alter_column('trip', 'registration_deadline', nullable=False)

    # 2. Add cancellation audit fields to tripregistration
    op.add_column('tripregistration', sa.Column('cancelled_at', sa.DateTime(), nullable=True))
    op.add_column('tripregistration', sa.Column('cancellation_reason', sa.String(500), nullable=True))
    op.add_column('tripregistration', sa.Column('cancelled_by', sa.String(50), nullable=True))

    # 3. Create refundrecord table
    op.create_table(
        'refundrecord',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('registration_id', sa.Uuid(), nullable=False),
        sa.Column('payment_id', sa.Uuid(), nullable=True),
        sa.Column('moyasar_payment_id', sa.String(100), nullable=True),
        sa.Column('cancelled_by', sa.String(50), nullable=False),
        sa.Column('actor_user_id', sa.Uuid(), nullable=True),
        sa.Column('refund_percentage', sa.Integer(), nullable=False),
        sa.Column('refund_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('original_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('refund_rule', sa.String(100), nullable=False),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('moyasar_refund_response', sa.String(1000), nullable=True),
        sa.Column('refund_succeeded', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['registration_id'], ['tripregistration.id']),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id']),
        sa.ForeignKeyConstraint(['actor_user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_refundrecord_registration_id', 'refundrecord', ['registration_id'])
    op.create_index('ix_refundrecord_actor_user_id', 'refundrecord', ['actor_user_id'])
    op.create_index('ix_refundrecord_payment_id', 'refundrecord', ['payment_id'])


def downgrade():
    op.drop_index('ix_refundrecord_payment_id', 'refundrecord')
    op.drop_index('ix_refundrecord_actor_user_id', 'refundrecord')
    op.drop_index('ix_refundrecord_registration_id', 'refundrecord')
    op.drop_table('refundrecord')
    op.drop_column('tripregistration', 'cancelled_by')
    op.drop_column('tripregistration', 'cancellation_reason')
    op.drop_column('tripregistration', 'cancelled_at')
    op.alter_column('trip', 'registration_deadline', nullable=True)
