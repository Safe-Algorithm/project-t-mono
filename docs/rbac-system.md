# RBAC System Documentation

## Overview

The RBAC (Role-Based Access Control) system controls what authenticated users can do within the **Provider Panel** and **Admin Panel**. Mobile app users are entirely outside the RBAC system — their endpoints are public or gated by registration/ownership checks only.

---

## Core Concepts

### Permission
A logical action a user can perform (e.g. "Manage Trips", "View Payments"). Each permission is **system-seeded and immutable** — users cannot create or delete permissions.

A permission has:
- `name` — human-readable label
- `group_name` — category for UI grouping (e.g. "Trips", "Team")
- `source` — `admin` or `provider` (namespace)
- `rules` — one or more `PermissionRule` rows

### PermissionRule
A single `(http_method, path_pattern)` pair that maps to real API endpoints using **fnmatch glob patterns**.

Examples:
```
POST  /provider/trips
GET   /provider/trips/*
PUT   /provider/trips/*
DELETE /provider/trips/*
```

One permission can have multiple rules (e.g. "Manage Trips" covers create, read, update, delete).

### Role
A named collection of permissions. Roles are **user-created** (providers or admins create their own roles).

A role has:
- `name` — e.g. "Trip Manager", "Finance Viewer"
- `source` — `admin` or `provider`
- `provider_id` — for provider roles, scopes the role to that provider; `None` for admin roles
- `is_system` — if `True`, the role was created by the system (e.g. "Super Admin") and should not be deleted

### RoleSource enum
```python
class RoleSource(str, Enum):
    ADMIN = "admin"
    PROVIDER = "provider"
```
Kept separate from `RequestSource` because they serve different concerns:
- `RequestSource` — identifies the HTTP client (mobile, admin panel, provider panel)
- `RoleSource` — namespaces roles and permissions by panel

---

## Database Schema

```
permission
  id, name, group_name, source (admin|provider)

permissionrule
  id, permission_id (FK), http_method, path_pattern

role
  id, name, description, source (admin|provider), provider_id (nullable FK), is_system

role_permission_link
  role_id (FK), permission_id (FK)   ← many-to-many

user_role_link
  user_id (FK), role_id (FK), assigned_at
```

---

## User Types & RBAC Applicability

| User type | `source` | `role` | Hits RBAC? | Can access admin routes? | Can access provider routes? |
|---|---|---|---|---|---|
| Mobile user | `MOBILE_APP` | `NORMAL` | Never | No | No |
| Provider `NORMAL` | `PROVIDERS_PANEL` | `NORMAL` | Yes — checks roles | No | Yes, if has permission |
| Provider `SUPER_USER` | `PROVIDERS_PANEL` | `SUPER_USER` | Bypassed | No | Yes, all |
| Admin `NORMAL` | `ADMIN_PANEL` | `NORMAL` | Yes — checks roles | Yes, if has permission | No |
| Admin `SUPER_USER` | `ADMIN_PANEL` | `SUPER_USER` | Bypassed | Yes, all | No |

> **Note:** `UserRole.SUPER_USER` is a separate concept from RBAC roles. It is a flag on the `User` model that grants full access within the user's own panel. It does NOT grant cross-panel access.

---

## Access Control Layers

Every protected route passes through multiple gates in order:

### Provider endpoints (`/provider/*`)

```
1. get_current_active_provider
   └─ checks user.source == PROVIDERS_PANEL  → 403 if wrong source
2. require_provider_permission  (optional, added per-route)
   ├─ if user.role == SUPER_USER → pass immediately
   └─ load user's provider-scoped RBAC roles → match method+path against rules → 403 if no match
3. Route-level ownership check (e.g. trip.provider_id == current_user.provider_id)
```

### Admin endpoints (`/admin/*`)

```
1. get_current_active_admin
   ├─ checks user.source == ADMIN_PANEL      → 403 if wrong source
   └─ checks user.role == SUPER_USER         → 403 if not superuser  (currently all admins must be SUPER_USER to log in)
2. require_admin_permission  (optional, added per-route)
   ├─ if user.role == SUPER_USER → pass immediately
   └─ load user's admin RBAC roles → match method+path against rules → 403 if no match
```

### Mobile endpoints (`/trips/*`, `/bookings/*`, etc.)

```
1. get_current_user  (JWT validation only)
2. Route-level checks (registration exists, booking ownership, etc.)
   — No RBAC dependency is injected
```

---

## Permission Enforcement Dependency

Located in `backend/app/api/rbac_deps.py`.

```python
# Provider routes
@router.post("/trips")
def create_trip(
    current_user: User = Depends(get_current_active_provider),
    _: None = Depends(require_provider_permission),
):
    ...

# Admin routes
@router.get("/admin/users")
def list_users(
    current_user: User = Depends(get_current_active_admin),
    _: None = Depends(require_admin_permission),
):
    ...
```

### Path matching
Patterns use Python `fnmatch` glob rules:
- `*` matches any single path segment
- `/provider/trips/*` matches `/provider/trips/abc-123`
- `/provider/trips/*/packages/*` matches `/provider/trips/abc-123/packages/xyz-456`

The `/api/v1` prefix is stripped before matching.

---

## Permission Seeding

Permissions are defined in `backend/app/core/rbac_seed.py` and seeded once at startup (idempotent).

### Provider permissions (source: `provider`)

| Group | Permission | Rules |
|---|---|---|
| Trips | Manage Trips | POST/GET/PUT/DELETE /provider/trips, /provider/trips/* |
| Trips | Manage Trip Packages | POST/GET/PUT/DELETE /provider/trips/*/packages/* |
| Trips | Manage Extra Fees | POST/GET/PUT/DELETE /provider/trips/*/extra-fees/* |
| Trips | Send Trip Updates | POST /provider/trips/*/updates, POST /provider/registrations/*/updates |
| Registrations | View Registrations | GET /provider/registrations, GET /provider/registrations/* |
| Team | Manage Team | GET/POST/DELETE /provider/team/* |
| Roles | Manage Roles | GET/POST/PUT/DELETE /provider/roles/* |

### Admin permissions (source: `admin`)

| Group | Permission | Rules |
|---|---|---|
| Users | Manage Users | GET/POST/PUT/DELETE /admin/users/* |
| Providers | Manage Providers | GET/POST/PUT/DELETE /admin/providers/* |
| Trips | Manage Trips | GET/PUT/DELETE /admin/trips/* |
| Finance | View Payments | GET /admin/payments/* |
| Roles | Manage Roles | GET/POST/PUT/DELETE /admin/roles/* |

---

## Initial Data Setup

`backend/app/initial_data.py` runs at container startup and:

1. **Seeds RBAC permissions** — calls `rbac_seed.seed_permissions()` if the `permission` table is empty
2. **Creates "Super Admin" role** — a system admin role (`is_system=True`) with all admin permissions attached
3. **Creates the first superuser** — from `FIRST_SUPERUSER_EMAIL` env var, with `role=SUPER_USER`
4. **Assigns "Super Admin" role** to the first superuser

All steps are idempotent — safe to run multiple times.

---

## API Endpoints

### Provider Roles (`/api/v1/provider/roles`)

| Method | Path | Description |
|---|---|---|
| GET | `/provider/roles/permissions` | List all provider permissions |
| GET | `/provider/roles` | List roles for current provider |
| POST | `/provider/roles` | Create a new role |
| GET | `/provider/roles/{id}` | Get role with permissions |
| PATCH | `/provider/roles/{id}` | Update role name/description |
| DELETE | `/provider/roles/{id}` | Delete role |
| POST | `/provider/roles/{id}/permissions` | Add permissions to role (body: `{permission_ids: [...]}`) |
| DELETE | `/provider/roles/{id}/permissions/{perm_id}` | Remove permission from role |
| POST | `/provider/roles/{id}/users` | Assign users to role (body: `{role_ids: [user_id, ...]}`) |
| DELETE | `/provider/roles/{id}/users/{user_id}` | Remove user from role |
| GET | `/provider/roles/users/{user_id}/roles` | Get all roles for a team member |

### Admin Roles (`/api/v1/admin/roles`)

Same pattern under `/admin/roles/`.

---

## Frontend

### Provider Panel
- **Page:** `providers-panel/src/pages/roles.tsx`
- **Service:** `providers-panel/src/services/rolesService.ts`
- **Nav link:** visible only to `UserRole.SUPER_USER` providers (in `Layout.tsx`)

### Admin Panel
- **Page:** `admin-panel/src/pages/roles.tsx`
- **Service:** `admin-panel/src/services/rolesService.ts`
- **Nav link:** added to `NAV_ITEMS_CONFIG` in `admin-panel/src/components/Layout.tsx`

Both pages support:
- Create / edit / delete roles
- Assign permissions via checkbox groups (grouped by `group_name`)
- Assign / remove team members from roles

---

## Key Files

| File | Purpose |
|---|---|
| `backend/app/models/rbac.py` | SQLModel models: Permission, PermissionRule, Role, RolePermissionLink, UserRoleLink |
| `backend/app/core/rbac_seed.py` | Idempotent permission seeder |
| `backend/app/crud/rbac.py` | CRUD: roles, permissions, links, enforcement helper |
| `backend/app/schemas/rbac.py` | Pydantic schemas for all RBAC entities |
| `backend/app/api/rbac_deps.py` | FastAPI deps: `require_provider_permission`, `require_admin_permission` |
| `backend/app/api/routes/provider_roles.py` | Provider RBAC API routes |
| `backend/app/api/routes/admin_roles.py` | Admin RBAC API routes |
| `backend/app/initial_data.py` | Startup seeder + Super Admin role setup |
| `backend/alembic/versions/d4e5f6a7b8c9_add_rbac_tables.py` | Migration for 5 RBAC tables |
| `backend/app/tests/api/routes/test_rbac.py` | 20 RBAC tests |

---

## Adding a New Permission

1. Add an entry to `PROVIDER_PERMISSIONS` or `ADMIN_PERMISSIONS` in `backend/app/core/rbac_seed.py`
2. Run the seeder: `docker exec project-t-mono-backend-1 python -m app.core.rbac_seed`
3. Add `Depends(require_provider_permission)` or `Depends(require_admin_permission)` to the relevant route(s)

> Permissions are system-owned — never expose a "create permission" API endpoint to users.

---

## Adding RBAC to a New Route

```python
from app.api.rbac_deps import require_provider_permission

@router.post("/some-new-action")
def my_endpoint(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
    _: None = Depends(require_provider_permission),
):
    ...
```

Ensure the route's method + path is covered by a `PermissionRule` in the seed file, otherwise all `NORMAL` users will get 403.
