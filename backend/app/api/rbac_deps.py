"""
RBAC permission enforcement dependencies.

Usage in a route:
    @router.post("/some-action")
    def my_route(
        current_user: User = Depends(get_current_active_provider),
        _: None = Depends(require_provider_permission),
    ): ...

The dependency reads the incoming request path + method, loads the current
user's roles (scoped to their provider_id), and checks whether any of those
roles' permission rules allow the request.

Super-providers (UserRole.SUPER_USER from PROVIDERS_PANEL) bypass the check
entirely — they own the workspace and implicitly have all permissions.

Similarly, admins with UserRole.SUPER_USER from ADMIN_PANEL bypass admin
permission checks.
"""
from __future__ import annotations

import fnmatch
import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request
from sqlmodel import Session

from app.api.deps import get_current_active_provider, get_current_active_admin, get_session
from app.crud import rbac as rbac_crud
from app.models.rbac import RoleSource
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


def _path_matches(pattern: str, path: str) -> bool:
    """
    Match a request path against a stored pattern using fnmatch glob rules.
    Both pattern and path should NOT include the /api/v1 prefix.
    Trailing slashes are stripped before comparison.
    """
    return fnmatch.fnmatch(path.rstrip("/"), pattern.rstrip("/"))


def _strip_api_prefix(path: str) -> str:
    """Remove /api/v1 prefix so patterns can be written without it."""
    for prefix in ("/api/v1", "/api"):
        if path.startswith(prefix):
            return path[len(prefix):]
    return path


def require_provider_permission(
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
) -> None:
    """
    Enforce RBAC for provider-panel endpoints.
    SUPER_USER providers bypass this check (they own the workspace).
    """
    if current_user.role == UserRole.SUPER_USER:
        return

    method = request.method.upper()
    path = _strip_api_prefix(request.url.path)

    rules = rbac_crud.get_all_rules_for_user(
        session=session,
        user_id=current_user.id,
        source=RoleSource.PROVIDER,
        provider_id=current_user.provider_id,
    )

    for rule in rules:
        if rule.http_method.upper() == method and _path_matches(rule.path_pattern, path):
            return

    logger.warning(
        f"RBAC denied: user={current_user.id} method={method} path={path}"
    )
    raise HTTPException(
        status_code=403,
        detail="You do not have permission to perform this action.",
    )


def require_admin_permission(
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
) -> None:
    """
    Enforce RBAC for admin-panel endpoints.
    SUPER_USER admins bypass this check.
    """
    if current_user.role == UserRole.SUPER_USER:
        return

    method = request.method.upper()
    path = _strip_api_prefix(request.url.path)

    rules = rbac_crud.get_all_rules_for_user(
        session=session,
        user_id=current_user.id,
        source=RoleSource.ADMIN,
        provider_id=None,
    )

    for rule in rules:
        if rule.http_method.upper() == method and _path_matches(rule.path_pattern, path):
            return

    logger.warning(
        f"RBAC denied (admin): user={current_user.id} method={method} path={path}"
    )
    raise HTTPException(
        status_code=403,
        detail="You do not have permission to perform this action.",
    )
