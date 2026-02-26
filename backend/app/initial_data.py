import logging

from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.schemas.user import UserCreate
from app.models.source import RequestSource
from app.models.user import UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPER_ADMIN_ROLE_NAME = "Super Admin"


def _ensure_rbac_seed(session: Session) -> None:
    """Always run the idempotent permission seeder so new permissions from code changes are picked up on every server start."""
    from app.core.rbac_seed import seed_permissions
    seed_permissions(session)


def _ensure_super_admin_role(session: Session):
    """
    Create (or fetch) a system-level 'Super Admin' admin role that holds
    every admin permission.  Returns the Role object.
    """
    from app.models.rbac import Role, RoleSource, Permission, RolePermissionLink
    from app.crud import rbac as rbac_crud

    role = session.exec(
        select(Role).where(
            Role.name == SUPER_ADMIN_ROLE_NAME,
            Role.source == RoleSource.ADMIN,
        )
    ).first()

    if not role:
        role = rbac_crud.create_role(
            session,
            name=SUPER_ADMIN_ROLE_NAME,
            source=RoleSource.ADMIN,
            description="Full access to all admin panel actions",
            provider_id=None,
            is_system=True,
        )
        logger.info(f"Created system role: {SUPER_ADMIN_ROLE_NAME}")

    # Attach all admin permissions if not already attached
    all_admin_perms = session.exec(
        select(Permission).where(Permission.source == RoleSource.ADMIN)
    ).all()

    existing_links = {
        link.permission_id
        for link in session.exec(
            select(RolePermissionLink).where(RolePermissionLink.role_id == role.id)
        ).all()
    }

    added = 0
    for perm in all_admin_perms:
        if perm.id not in existing_links:
            rbac_crud.add_permission_to_role(session, role.id, perm.id)
            added += 1

    if added:
        logger.info(f"Attached {added} permissions to '{SUPER_ADMIN_ROLE_NAME}' role.")

    return role


def init_db(session: Session) -> None:
    # 1. Seed RBAC permissions
    _ensure_rbac_seed(session)

    # 2. Ensure the Super Admin role exists with all admin permissions
    super_admin_role = _ensure_super_admin_role(session)

    # 3. Create or fetch the first superuser
    user = crud.user.get_user_by_email_and_source(
        session,
        email=settings.FIRST_SUPERUSER_EMAIL,
        source=RequestSource.ADMIN_PANEL,
    )
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER_EMAIL,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            name=settings.FIRST_SUPERUSER_NAME,
            phone=settings.FIRST_SUPERUSER_PHONE,
            is_superuser=True,
            role=UserRole.SUPER_USER,
        )
        user = crud.user.create_user(session, user_in=user_in, source=RequestSource.ADMIN_PANEL)
        logger.info(f"Superuser created: {user.email}")
    else:
        logger.info(f"Superuser already exists: {user.email}")

    # 4. Assign the Super Admin role to the first superuser
    from app.crud import rbac as rbac_crud
    rbac_crud.assign_role_to_user(session, user.id, super_admin_role.id)
    logger.info(f"Assigned '{SUPER_ADMIN_ROLE_NAME}' role to {user.email}")


def main() -> None:
    logger.info("Creating initial data")
    with Session(engine) as session:
        init_db(session)
    logger.info("Initial data created")


if __name__ == "__main__":
    main()
