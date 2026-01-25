"""update_provider_file_verification_status_to_enum

Revision ID: h1i2j3k4l5m6
Revises: g7h8i9j0k1l2
Create Date: 2026-01-23 00:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'h1i2j3k4l5m6'
down_revision: Union[str, Sequence[str], None] = '5e2be6fd1785'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create the enum type
    file_verification_status_enum = postgresql.ENUM(
        'processing', 'accepted', 'rejected',
        name='fileverificationstatus',
        create_type=True
    )
    file_verification_status_enum.create(op.get_bind(), checkfirst=True)
    
    # Add new column with enum type
    op.add_column('providerfile', 
        sa.Column('file_verification_status', 
                  postgresql.ENUM('processing', 'accepted', 'rejected', 
                                  name='fileverificationstatus', 
                                  create_type=False),
                  nullable=False,
                  server_default='processing')
    )
    
    # Rename verified_by_id to reviewed_by_id
    op.alter_column('providerfile', 'verified_by_id',
                    new_column_name='reviewed_by_id')
    
    # Rename verified_at to reviewed_at
    op.alter_column('providerfile', 'verified_at',
                    new_column_name='reviewed_at')
    
    # Migrate data: if is_verified is True, set status to 'accepted', otherwise 'processing'
    op.execute("""
        UPDATE providerfile 
        SET file_verification_status = CASE 
            WHEN is_verified = true THEN 'accepted'::fileverificationstatus
            ELSE 'processing'::fileverificationstatus
        END
    """)
    
    # Drop the old is_verified column
    op.drop_column('providerfile', 'is_verified')


def downgrade() -> None:
    """Downgrade schema."""
    # Add back is_verified column
    op.add_column('providerfile',
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false')
    )
    
    # Migrate data back: if status is 'accepted', set is_verified to True
    op.execute("""
        UPDATE providerfile 
        SET is_verified = CASE 
            WHEN file_verification_status = 'accepted'::fileverificationstatus THEN true
            ELSE false
        END
    """)
    
    # Rename columns back
    op.alter_column('providerfile', 'reviewed_by_id',
                    new_column_name='verified_by_id')
    op.alter_column('providerfile', 'reviewed_at',
                    new_column_name='verified_at')
    
    # Drop the enum column
    op.drop_column('providerfile', 'file_verification_status')
    
    # Drop the enum type
    file_verification_status_enum = postgresql.ENUM(
        'processing', 'accepted', 'rejected',
        name='fileverificationstatus'
    )
    file_verification_status_enum.drop(op.get_bind(), checkfirst=True)
