"""Add trip enhancements clean

Revision ID: 59e7a69e545b
Revises: g7h8i9j0k1l2
Create Date: 2025-08-22 04:55:49.078651

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '59e7a69e545b'
down_revision: Union[str, Sequence[str], None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    
    # Create enum types using raw SQL with IF NOT EXISTS
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE tripfieldtype AS ENUM (
                'id_iqama_number', 'passport_number', 'name', 'phone', 'email', 
                'address', 'city', 'country', 'date_of_birth', 'gender', 
                'disability', 'medical_conditions', 'allergies'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE gendertype AS ENUM (
                'male', 'female', 'other', 'prefer_not_to_say'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE disabilitytype AS ENUM (
                'none', 'mobility', 'visual', 'hearing', 'cognitive', 'other'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create trip_package table
    op.create_table('trippackage',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['trip_id'], ['trip.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create trip_required_field table
    op.create_table('triprequiredfield',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('field_type', postgresql.ENUM('id_iqama_number', 'passport_number', 'name', 'phone', 'email', 'address', 'city', 'country', 'date_of_birth', 'gender', 'disability', 'medical_conditions', 'allergies', name='tripfieldtype', create_type=False), nullable=False),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['trip_id'], ['trip.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create trip_registration table
    op.create_table('tripregistration',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('package_id', sa.UUID(), nullable=True),
        sa.Column('total_participants', sa.Integer(), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['package_id'], ['trippackage.id'], ),
        sa.ForeignKeyConstraint(['trip_id'], ['trip.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create trip_registration_participant table
    op.create_table('tripregistrationparticipant',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('registration_id', sa.UUID(), nullable=False),
        sa.Column('id_iqama_number', sa.String(length=50), nullable=True),
        sa.Column('passport_number', sa.String(length=50), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('gender', postgresql.ENUM('male', 'female', 'other', 'prefer_not_to_say', name='gendertype', create_type=False), nullable=True),
        sa.Column('disability', postgresql.ENUM('none', 'mobility', 'visual', 'hearing', 'cognitive', 'other', name='disabilitytype', create_type=False), nullable=True),
        sa.Column('medical_conditions', sa.String(), nullable=True),
        sa.Column('allergies', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['registration_id'], ['tripregistration.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('tripregistrationparticipant')
    op.drop_table('tripregistration')
    op.drop_table('triprequiredfield')
    op.drop_table('trippackage')
    
    # Drop enum types
    op.execute('DROP TYPE IF EXISTS disabilitytype')
    op.execute('DROP TYPE IF EXISTS gendertype')
    op.execute('DROP TYPE IF EXISTS tripfieldtype')
