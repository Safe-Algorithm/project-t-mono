from fastapi import APIRouter

from app.api.routes import admin, auth, dashboard, favorites, file_definitions, files, otp, providers, provider_profiles, public_trips, reviews, team, trips, users, users_by_role

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(otp.router, prefix="/otp", tags=["otp"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(providers.router, prefix="/providers", tags=["providers"])
api_router.include_router(provider_profiles.router, prefix="/provider-profiles", tags=["provider-profiles"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(users_by_role.router, prefix="/admin/users", tags=["admin-users"])
api_router.include_router(file_definitions.router, prefix="/file-definitions", tags=["file-definitions"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(public_trips.router, prefix="/public-trips", tags=["public-trips"])
api_router.include_router(trips.router, prefix="/trips", tags=["trips"])
api_router.include_router(team.router, prefix="/team", tags=["team"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
api_router.include_router(favorites.router, tags=["favorites"])
