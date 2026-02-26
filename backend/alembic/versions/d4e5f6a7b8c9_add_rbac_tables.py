"""add_rbac_tables

Revision ID: d4e5f6a7b8c9
Revises: c2d3e4f5a6b7
Create Date: 2026-02-26 16:00:00.000000

Adds Permission, PermissionRule, Role, role_permission_link, user_role_link tables.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'permission',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('group_name', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_permission_source', 'permission', ['source'])

    op.create_table(
        'permissionrule',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.Column('http_method', sa.String(length=10), nullable=False),
        sa.Column('path_pattern', sa.String(length=300), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permission.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_permissionrule_permission_id', 'permissionrule', ['permission_id'])

    op.create_table(
        'role',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('provider_id', sa.UUID(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['provider_id'], ['provider.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_role_source', 'role', ['source'])
    op.create_index('ix_role_provider_id', 'role', ['provider_id'])

    op.create_table(
        'role_permission_link',
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permission.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['role.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id'),
    )

    op.create_table(
        'user_role_link',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['role.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'role_id'),
    )


def downgrade() -> None:
    op.drop_table('user_role_link')
    op.drop_table('role_permission_link')
    op.drop_index('ix_role_provider_id', table_name='role')
    op.drop_index('ix_role_source', table_name='role')
    op.drop_table('role')
    op.drop_index('ix_permissionrule_permission_id', table_name='permissionrule')
    op.drop_table('permissionrule')
    op.drop_index('ix_permission_source', table_name='permission')
    op.drop_table('permission')
