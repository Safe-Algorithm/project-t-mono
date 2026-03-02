"""add_provider_file_groups

Revision ID: e1f2a3b4c5d6
Revises: 413fb790884c
Create Date: 2026-03-02 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = '413fb790884c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create providerfilegroup table
    op.create_table(
        'providerfilegroup',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('name_en', sa.String(length=200), nullable=False),
        sa.Column('name_ar', sa.String(length=200), nullable=False),
        sa.Column('description_en', sa.String(length=500), nullable=True),
        sa.Column('description_ar', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )
    op.create_index('ix_providerfilegroup_key', 'providerfilegroup', ['key'])

    # 2. Add file_group_id FK to filedefinition
    op.add_column('filedefinition',
        sa.Column('file_group_id', sa.Uuid(), nullable=True)
    )
    op.create_index('ix_filedefinition_file_group_id', 'filedefinition', ['file_group_id'])
    op.create_foreign_key(
        'fk_filedefinition_file_group_id',
        'filedefinition', 'providerfilegroup',
        ['file_group_id'], ['id'],
    )

    # 3. Add file_group_id FK to provider
    op.add_column('provider',
        sa.Column('file_group_id', sa.Uuid(), nullable=True)
    )
    op.create_index('ix_provider_file_group_id', 'provider', ['file_group_id'])
    op.create_foreign_key(
        'fk_provider_file_group_id',
        'provider', 'providerfilegroup',
        ['file_group_id'], ['id'],
    )

    # 4. Add file_group_id FK to providerrequest
    op.add_column('providerrequest',
        sa.Column('file_group_id', sa.Uuid(), nullable=True)
    )
    op.create_index('ix_providerrequest_file_group_id', 'providerrequest', ['file_group_id'])
    op.create_foreign_key(
        'fk_providerrequest_file_group_id',
        'providerrequest', 'providerfilegroup',
        ['file_group_id'], ['id'],
    )


def downgrade() -> None:
    # Reverse order
    op.drop_constraint('fk_providerrequest_file_group_id', 'providerrequest', type_='foreignkey')
    op.drop_index('ix_providerrequest_file_group_id', 'providerrequest')
    op.drop_column('providerrequest', 'file_group_id')

    op.drop_constraint('fk_provider_file_group_id', 'provider', type_='foreignkey')
    op.drop_index('ix_provider_file_group_id', 'provider')
    op.drop_column('provider', 'file_group_id')

    op.drop_constraint('fk_filedefinition_file_group_id', 'filedefinition', type_='foreignkey')
    op.drop_index('ix_filedefinition_file_group_id', 'filedefinition')
    op.drop_column('filedefinition', 'file_group_id')

    op.drop_index('ix_providerfilegroup_key', 'providerfilegroup')
    op.drop_table('providerfilegroup')
