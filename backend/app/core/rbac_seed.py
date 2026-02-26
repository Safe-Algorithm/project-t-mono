"""
RBAC Permission Seeder.

Run once (idempotent) to populate the permission and permissionrule tables.
Existing entries are matched by (name, source) and updated; missing ones are
inserted.  Deleted entries are left in place (soft-delete via is_active).

Usage (inside the container):
    python -m app.core.rbac_seed
"""
from __future__ import annotations

import logging
from typing import List, Tuple

from sqlmodel import Session, select

from app.core.db import engine
from app.models.rbac import Permission, PermissionRule, RoleSource

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Permission definition format:
#   (name, description, group_name, source, [(http_method, path_pattern), ...])
#
# path_pattern rules:
#   - Use * for a single path segment wildcard  (e.g. /trips/*)
#   - Matching is done with fnmatch at request time
#   - Prefix /trips/ maps to the FastAPI router mounted at /trips (no /api/v1)
# ─────────────────────────────────────────────────────────────────────────────

PROVIDER_PERMISSIONS: List[Tuple] = [
    # ── Trip Management ──────────────────────────────────────────────────────
    (
        "View Trips",
        "View own trips and trip details",
        "Trip Management",
        RoleSource.PROVIDER,
        [
            ("GET", "/trips"),
            ("GET", "/trips/all"),
            ("GET", "/trips/*"),
            ("GET", "/trips/*/packages"),
            ("GET", "/trips/*/packages/*/required-fields"),
            ("GET", "/trips/*/extra-fees"),
        ],
    ),
    (
        "Create Trips",
        "Create new trips",
        "Trip Management",
        RoleSource.PROVIDER,
        [
            ("POST", "/trips"),
        ],
    ),
    (
        "Edit Trips",
        "Update trip details, packages, required fields and extra fees",
        "Trip Management",
        RoleSource.PROVIDER,
        [
            ("PUT", "/trips/*"),
            ("POST", "/trips/*/packages"),
            ("PUT", "/trips/*/packages/*"),
            ("POST", "/trips/*/packages/*/required-fields"),
            ("POST", "/trips/*/packages/*/required-fields-with-validation"),
            ("POST", "/trips/*/extra-fees"),
            ("PUT", "/trips/*/extra-fees/*"),
        ],
    ),
    (
        "Delete Trips",
        "Delete trips, packages and extra fees",
        "Trip Management",
        RoleSource.PROVIDER,
        [
            ("DELETE", "/trips/*"),
            ("DELETE", "/trips/*/packages/*"),
            ("DELETE", "/trips/*/extra-fees/*"),
        ],
    ),
    (
        "Manage Trip Images",
        "Upload and delete trip images",
        "Trip Management",
        RoleSource.PROVIDER,
        [
            ("POST", "/trips/*/upload-images"),
            ("DELETE", "/trips/*/images"),
        ],
    ),
    # ── Registrations ────────────────────────────────────────────────────────
    (
        "View Registrations",
        "View trip registrations and participant details",
        "Registrations",
        RoleSource.PROVIDER,
        [
            ("GET", "/trips/*/registrations"),
            ("GET", "/trips/registrations/*"),
        ],
    ),
    # ── Trip Updates / Notifications ─────────────────────────────────────────
    (
        "Send Trip Updates",
        "Broadcast or send targeted updates to trip registrants",
        "Trip Updates",
        RoleSource.PROVIDER,
        [
            ("POST", "/provider/trips/*/updates"),
            ("POST", "/provider/registrations/*/updates"),
        ],
    ),
    (
        "View Trip Updates",
        "View sent trip updates and read receipts",
        "Trip Updates",
        RoleSource.PROVIDER,
        [
            ("GET", "/provider/trips/*/updates"),
            ("GET", "/provider/updates/*/receipts"),
        ],
    ),
    # ── Support Tickets ───────────────────────────────────────────────────────
    (
        "Manage Support Tickets",
        "View, reply to and update provider support tickets",
        "Support",
        RoleSource.PROVIDER,
        [
            ("GET", "/provider/support/tickets"),
            ("GET", "/provider/support/tickets/*"),
            ("PATCH", "/provider/support/tickets/*"),
            ("POST", "/provider/support/tickets/*/messages"),
        ],
    ),
    # ── File Management ───────────────────────────────────────────────────────
    (
        "Manage Provider Files",
        "Upload, replace and delete provider registration files",
        "Files",
        RoleSource.PROVIDER,
        [
            ("POST", "/files/provider-registration/*"),
            ("PUT", "/files/provider-registration/*"),
            ("DELETE", "/files/provider-registration/*"),
            ("GET", "/files/provider-registration"),
            ("GET", "/files/provider-registration/missing-definitions"),
        ],
    ),
    # ── Team Management ───────────────────────────────────────────────────────
    (
        "Manage Team",
        "Invite, remove and update roles of team members",
        "Team",
        RoleSource.PROVIDER,
        [
            ("POST", "/team/invite"),
            ("GET", "/team/"),
            ("DELETE", "/team/*"),
            ("PUT", "/team/*/role"),
        ],
    ),
    (
        "Manage Team Roles",
        "Create, edit and assign RBAC roles to team members",
        "Team",
        RoleSource.PROVIDER,
        [
            ("GET", "/provider/roles"),
            ("POST", "/provider/roles"),
            ("GET", "/provider/roles/*"),
            ("PATCH", "/provider/roles/*"),
            ("DELETE", "/provider/roles/*"),
            ("POST", "/provider/roles/*/permissions"),
            ("DELETE", "/provider/roles/*/permissions/*"),
            ("POST", "/provider/roles/*/users"),
            ("DELETE", "/provider/roles/*/users/*"),
        ],
    ),
    # ── Provider Profile ──────────────────────────────────────────────────────
    (
        "Edit Provider Profile",
        "Update company profile information",
        "Profile",
        RoleSource.PROVIDER,
        [
            ("PUT", "/providers/*"),
            ("PATCH", "/providers/*"),
        ],
    ),
    # ── Payments / Dashboard ──────────────────────────────────────────────────
    (
        "View Dashboard",
        "View provider dashboard and analytics",
        "Dashboard",
        RoleSource.PROVIDER,
        [
            ("GET", "/dashboard/*"),
            ("GET", "/dashboard"),
        ],
    ),
]

ADMIN_PERMISSIONS: List[Tuple] = [
    # ── Provider Requests ─────────────────────────────────────────────────────
    (
        "Manage Provider Requests",
        "Review, approve and deny provider registration requests",
        "Providers",
        RoleSource.ADMIN,
        [
            ("GET", "/admin/provider-requests"),
            ("PUT", "/admin/provider-requests/*/approve"),
            ("PUT", "/admin/provider-requests/*/deny"),
        ],
    ),
    (
        "View Providers",
        "View provider list and details",
        "Providers",
        RoleSource.ADMIN,
        [
            ("GET", "/admin/providers"),
            ("GET", "/admin/providers/*"),
            ("GET", "/admin/providers/*/users"),
            ("GET", "/admin/providers/*/trips"),
        ],
    ),
    # ── User Management ───────────────────────────────────────────────────────
    (
        "View Users",
        "View user list and user details",
        "Users",
        RoleSource.ADMIN,
        [
            ("GET", "/admin/users"),
            ("GET", "/admin/users/*"),
        ],
    ),
    (
        "Manage Admin Team",
        "Invite and manage admin team members",
        "Users",
        RoleSource.ADMIN,
        [
            ("POST", "/admin/invite-admin"),
            ("GET", "/admin/users/by-role"),
        ],
    ),
    (
        "Manage Admin Roles",
        "Create, edit and assign RBAC roles to admin users",
        "Users",
        RoleSource.ADMIN,
        [
            ("GET", "/admin/roles"),
            ("POST", "/admin/roles"),
            ("GET", "/admin/roles/*"),
            ("PATCH", "/admin/roles/*"),
            ("DELETE", "/admin/roles/*"),
            ("POST", "/admin/roles/*/permissions"),
            ("DELETE", "/admin/roles/*/permissions/*"),
            ("POST", "/admin/roles/*/users"),
            ("DELETE", "/admin/roles/*/users/*"),
        ],
    ),
    # ── Trip Management ───────────────────────────────────────────────────────
    (
        "View All Trips",
        "View all trips across providers",
        "Trips",
        RoleSource.ADMIN,
        [
            ("GET", "/admin/trips"),
            ("GET", "/admin/trips/*"),
            ("GET", "/admin/trips/*/registrations"),
        ],
    ),
    # ── Support Tickets ───────────────────────────────────────────────────────
    (
        "Manage Admin Support Tickets",
        "View, reply to and manage all admin support tickets",
        "Support",
        RoleSource.ADMIN,
        [
            ("GET", "/admin/support/tickets"),
            ("GET", "/admin/support/tickets/*"),
            ("PATCH", "/admin/support/tickets/*"),
            ("POST", "/admin/support/tickets/*/messages"),
            ("GET", "/admin/support/trip-tickets"),
            ("GET", "/admin/support/trip-tickets/*"),
        ],
    ),
    # ── Trip Updates ──────────────────────────────────────────────────────────
    (
        "View All Trip Updates",
        "View trip updates and read receipts across all providers",
        "Trip Updates",
        RoleSource.ADMIN,
        [
            ("GET", "/admin/trip-updates"),
            ("GET", "/admin/trips/*/updates"),
            ("GET", "/admin/trips"),
            ("GET", "/admin/trips/*"),
            ("GET", "/admin/trips/*/registrations"),
        ],
    ),
    # ── File Definitions ─────────────────────────────────────────────────────
    (
        "Manage File Definitions",
        "Create, update and delete file definitions",
        "Settings",
        RoleSource.ADMIN,
        [
            ("POST", "/admin/settings/file-definitions"),
            ("GET", "/admin/settings/file-definitions"),
            ("GET", "/admin/settings/file-definitions/*"),
            ("PUT", "/admin/settings/file-definitions/*"),
            ("DELETE", "/admin/settings/file-definitions/*"),
        ],
    ),
    (
        "Manage Provider Files",
        "Review and update verification status of provider files",
        "Settings",
        RoleSource.ADMIN,
        [
            ("PATCH", "/files/admin/provider-files/*/status"),
            ("GET", "/files/provider/*/files"),
        ],
    ),
]

ALL_PERMISSIONS = PROVIDER_PERMISSIONS + ADMIN_PERMISSIONS


def seed_permissions(session: Session) -> None:
    inserted = 0
    updated = 0

    for name, description, group_name, source, rules in ALL_PERMISSIONS:
        existing = session.exec(
            select(Permission).where(
                Permission.name == name,
                Permission.source == source,
            )
        ).first()

        if existing:
            existing.description = description
            existing.group_name = group_name
            existing.is_active = True
            session.add(existing)
            perm = existing
            updated += 1
        else:
            perm = Permission(
                name=name,
                description=description,
                group_name=group_name,
                source=source,
                is_active=True,
            )
            session.add(perm)
            session.flush()
            inserted += 1

        # Sync rules: delete old, insert new
        old_rules = session.exec(
            select(PermissionRule).where(PermissionRule.permission_id == perm.id)
        ).all()
        for r in old_rules:
            session.delete(r)
        session.flush()

        for method, pattern in rules:
            session.add(
                PermissionRule(
                    permission_id=perm.id,
                    http_method=method.upper(),
                    path_pattern=pattern,
                )
            )

    session.commit()
    logger.info(f"RBAC seed complete: {inserted} inserted, {updated} updated.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    with Session(engine) as session:
        seed_permissions(session)
