from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.api import api_router
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

# Set all CORS enabled origins from environment variable
# Cannot use "*" with allow_credentials=True, must specify exact origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {"message": "Hello from backend"}


@app.get("/.well-known/assetlinks.json", include_in_schema=False)
def assetlinks():
    """
    Android App Links verification endpoint.
    Android fetches this to verify the app is allowed to handle HTTPS deep links
    from this domain. The SHA-256 fingerprint must match the release keystore.
    Update ANDROID_APP_FINGERPRINT in settings (or .env) with your keystore fingerprint.
    """
    return JSONResponse([
        {
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {
                "namespace": "android_app",
                "package_name": "com.safealgo.rihlaapp",
                "sha256_cert_fingerprints": [settings.ANDROID_APP_FINGERPRINT],
            },
        }
    ])
