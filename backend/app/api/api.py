from fastapi import APIRouter

from app.api.routes import admin, auth, dashboard, providers, team, trips, users, users_by_role

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(providers.router, prefix="/providers", tags=["providers"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(users_by_role.router, prefix="/admin/users", tags=["admin-users"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(trips.router, prefix="/trips", tags=["trips"])
api_router.include_router(team.router, prefix="/team", tags=["team"])
