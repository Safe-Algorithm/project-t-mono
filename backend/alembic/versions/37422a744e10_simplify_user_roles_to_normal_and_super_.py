"""simplify_user_roles_to_normal_and_super_user

Revision ID: 37422a744e10
Revises: 01e6c470dd8f
Create Date: 2025-08-26 06:10:42.800816

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '37422a744e10'
down_revision: Union[str, Sequence[str], None] = '01e6c470dd8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Step 1: Create new enum type with only the new values
    new_userrole = postgresql.ENUM('NORMAL', 'SUPER_USER', name='userrole_new', create_type=True)
    new_userrole.create(op.get_bind())
    
    # Step 2: Add temporary column with new enum type
    op.add_column('user', sa.Column('role_new', new_userrole, nullable=True))
    
    # Step 3: Migrate existing role data to new values
    # Map old roles to new simplified roles:
    # - ADMIN, SUPER_ADMIN, PROVIDER, SUPER_PROVIDER -> SUPER_USER
    # - NORMAL -> NORMAL (unchanged)
    op.execute("""
        UPDATE "user" 
        SET role_new = CASE 
            WHEN role IN ('ADMIN', 'SUPER_ADMIN', 'PROVIDER', 'SUPER_PROVIDER') THEN 'SUPER_USER'::userrole_new
            WHEN role = 'NORMAL' THEN 'NORMAL'::userrole_new
            ELSE 'NORMAL'::userrole_new
        END
    """)
    
    # Step 4: Make new column non-nullable with default
    op.alter_column('user', 'role_new', nullable=False, server_default='NORMAL')
    
    # Step 5: Drop old column and enum
    op.drop_column('user', 'role')
    op.execute('DROP TYPE userrole')
    
    # Step 6: Rename new column to original name
    op.alter_column('user', 'role_new', new_column_name='role')
    
    # Step 7: Rename new enum type to original name
    op.execute('ALTER TYPE userrole_new RENAME TO userrole')


def downgrade() -> None:
    """Downgrade schema."""
    # Step 1: Create old enum type with all original values
    old_userrole = postgresql.ENUM('ADMIN', 'SUPER_ADMIN', 'PROVIDER', 'SUPER_PROVIDER', 'NORMAL', name='userrole_old', create_type=True)
    old_userrole.create(op.get_bind())
    
    # Step 2: Add temporary column with old enum type
    op.add_column('user', sa.Column('role_old', old_userrole, nullable=True))
    
    # Step 3: Map new roles back to old roles (default mapping)
    # Note: We can't perfectly restore the original roles, so we use defaults
    op.execute("""
        UPDATE "user" 
        SET role_old = CASE 
            WHEN role = 'NORMAL' THEN 'NORMAL'::userrole_old
            WHEN role = 'SUPER_USER' THEN 'SUPER_ADMIN'::userrole_old
        END
    """)
    
    # Step 4: Make old column non-nullable
    op.alter_column('user', 'role_old', nullable=False, server_default='NORMAL')
    
    # Step 5: Drop new column and enum
    op.drop_column('user', 'role')
    op.execute('DROP TYPE userrole')
    
    # Step 6: Rename old column back to original name
    op.alter_column('user', 'role_old', new_column_name='role')
    
    # Step 7: Rename old enum type back to original name
    op.execute('ALTER TYPE userrole_old RENAME TO userrole')
