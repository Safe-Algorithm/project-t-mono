"""
Trip sharing endpoints.

GET /trips/{trip_id}/share      — generate/retrieve a share link
GET /share/{token}              — HTML page with Open Graph tags + backend trip info page
GET /share/{token}/data         — JSON trip data via share token (for mobile deep-links)
"""

import html
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlmodel import Session

import app.crud as crud
from app.crud import trip_share as trip_share_crud
from app.api.deps import get_session, get_language
from app.core.config import settings
from app.schemas.trip_share import TripShareResponse
from app.utils.localization import get_name, get_description

# Two routers: one mounted under /trips, one at root for /share/{token}
trips_router = APIRouter()
share_router = APIRouter()


def _backend_base() -> str:
    """Public backend base URL from settings."""
    return settings.BACKEND_URL.rstrip("/")


def _share_lang_query(lang: str) -> str:
    return urlencode({"lang": "ar" if lang == "ar" else "en"})


def _format_share_date(dt: datetime | None, lang: str) -> str:
    if not dt:
        return ""
    if lang == "ar":
        arabic_months = [
            "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
            "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
        ]
        return f"{dt.day} {arabic_months[dt.month - 1]} {dt.year}"
    return dt.strftime("%b %d, %Y")


def _share_translations(lang: str) -> dict[str, str]:
    if lang == "ar":
        return {
            "default_title": "رحلة",
            "default_description": "اكتشف هذه الرحلة المميزة.",
            "date_label": "📅",
            "spots_label": "👥 {{count}} مقاعد",
            "open_app": "افتح في تطبيق رحلة",
            "get_app": "حمّل التطبيق:",
            "download_app": "حمّل رحلة",
            "html_lang": "ar",
            "dir": "rtl",
        }
    return {
        "default_title": "Trip",
        "default_description": "Discover this amazing trip.",
        "date_label": "📅",
        "spots_label": "👥 {{count}} spots",
        "open_app": "Open in Rihla App",
        "get_app": "Get the app:",
        "download_app": "Download Rihla",
        "html_lang": "en",
        "dir": "ltr",
    }


# ── 1. Generate / retrieve share link ────────────────────────────────────────

@trips_router.get("/{trip_id}/share", response_model=TripShareResponse)
def get_or_create_trip_share(
    trip_id: uuid.UUID,
    lang: str = Depends(get_language),
    session: Session = Depends(get_session),
):
    """
    Return (or create) a shareable link for a trip.
    No authentication required — the link itself is the secret.
    """
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    share = trip_share_crud.get_or_create_share(session=session, trip_id=trip_id)
    share_url = f"{_backend_base()}{settings.API_V1_STR}/share/{share.share_token}?{_share_lang_query(lang)}"

    return TripShareResponse(
        share_token=share.share_token,
        share_url=share_url,
        view_count=share.view_count,
        created_at=share.created_at,
    )


# ── 2. HTML page with Open Graph tags (what WhatsApp/Telegram/etc scrape) ────

@share_router.get("/{token}", response_class=HTMLResponse, include_in_schema=False)
def trip_share_preview(
    token: str,
    lang: str = Depends(get_language),
    session: Session = Depends(get_session),
):
    """
    Public HTML page with Open Graph + Twitter Card meta tags.

    Social bots (WhatsApp, Telegram, iMessage, Twitter) scrape this URL and
    render a rich preview card using the OG tags.

    Real users are redirected into the mobile app via the deep-link scheme.
    If the app is not installed, they stay on this same backend page which
    shows basic trip info — no separate frontend needed.
    """
    share = trip_share_crud.get_share_by_token(session=session, token=token)
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    trip = crud.trip.get_trip(session=session, trip_id=share.trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip_share_crud.increment_view(session=session, share=share)

    copy = _share_translations(lang)
    title = html.escape(get_name(trip, lang) or copy["default_title"])
    description = html.escape(get_description(trip, lang) or copy["default_description"])

    image_url = trip.images[0] if trip.images else ""

    canonical_url = f"{_backend_base()}{settings.API_V1_STR}/share/{token}?{_share_lang_query(lang)}"
    app_deep_link = f"{settings.APP_DEEP_LINK_SCHEME}://trip/{trip.id}"

    og_image_tag = f'<meta property="og:image" content="{html.escape(image_url)}" />' if image_url else ""
    twitter_image_tag = f'<meta name="twitter:image" content="{html.escape(image_url)}" />' if image_url else ""

    cover_style = f'background-image:url("{html.escape(image_url)}");' if image_url else "background:#0EA5E9;"

    ios_app_banner = ""
    if settings.IOS_APP_STORE_ID:
        ios_app_banner = f'<meta name="apple-itunes-app" content="app-id={html.escape(settings.IOS_APP_STORE_ID)}, app-argument={app_deep_link}" />'

    start_date = _format_share_date(trip.start_date, lang)
    end_date = _format_share_date(trip.end_date, lang)
    spots_label = html.escape(copy["spots_label"].replace("{{count}}", str(trip.max_participants)))

    page = f"""<!DOCTYPE html>
<html lang="{copy["html_lang"]}" dir="{copy["dir"]}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>

  <!-- Open Graph (WhatsApp, Telegram, Facebook, LinkedIn) -->
  <meta property="og:type"         content="website" />
  <meta property="og:title"        content="{title}" />
  <meta property="og:description"  content="{description}" />
  <meta property="og:url"          content="{canonical_url}" />
  {og_image_tag}
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="{title}" />
  <meta name="twitter:description" content="{description}" />
  {twitter_image_tag}

  {ios_app_banner}

  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;color:#1e293b}}
    .cover{{width:100%;height:240px;{cover_style}background-size:cover;background-position:center;background-color:#0EA5E9}}
    .card{{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);margin-top:-40px;position:relative}}
    .body{{padding:24px}}
    h1{{font-size:1.4rem;font-weight:700;margin-bottom:8px}}
    .desc{{color:#64748b;font-size:.95rem;line-height:1.5;margin-bottom:16px}}
    .meta{{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}}
    .badge{{background:#F1F5F9;border-radius:8px;padding:6px 12px;font-size:.85rem;color:#475569}}
    .cta{{display:block;width:100%;padding:14px;background:#0EA5E9;color:#fff;font-size:1rem;font-weight:600;border:none;border-radius:12px;cursor:pointer;text-align:center;text-decoration:none}}
    .cta:hover{{background:#0284C7}}
    .hint{{text-align:center;color:#94a3b8;font-size:.8rem;margin-top:12px}}
    .page{{padding:24px 16px 40px}}
  </style>
</head>
<body>
  <div class="cover"></div>
  <div class="page">
    <div class="card">
      <div class="body">
        <h1>{title}</h1>
        <p class="desc">{description}</p>
        <div class="meta">
          {f'<span class="badge">{copy["date_label"]} {start_date} – {end_date}</span>' if start_date else ""}
          {'<span class="badge">' + spots_label + '</span>'}
        </div>
        <a class="cta" href="{app_deep_link}" id="openApp">{copy["open_app"]}</a>
        <p class="hint" id="storeHint" style="display:none">
          {copy["get_app"]}
          <a id="storeLink" href="#" style="color:#0EA5E9">{copy["download_app"]}</a>
        </p>
      </div>
    </div>
  </div>
  <script>
    var deepLink   = "{app_deep_link}";
    var iosUrl     = "{html.escape(settings.IOS_APP_STORE_URL)}";
    var androidUrl = "{html.escape(settings.ANDROID_PLAY_STORE_URL)}";

    var ua = navigator.userAgent || "";
    var isIOS     = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var isAndroid = /Android/.test(ua);
    var storeUrl  = isIOS ? iosUrl : (isAndroid ? androidUrl : null);

    // Try to open the app
    window.location.href = deepLink;

    // After 1.5 s, if the page is still visible the app wasn't installed
    setTimeout(function() {{
      if (storeUrl) {{
        window.location.href = storeUrl;
      }} else {{
        // Desktop or unknown — show the hint with the relevant link
        var hint = document.getElementById("storeHint");
        var link = document.getElementById("storeLink");
        if (hint && link) {{
          link.href = iosUrl;  // default to iOS for desktop
          hint.style.display = "block";
        }}
      }}
    }}, 1500);
  </script>
</body>
</html>"""

    return HTMLResponse(content=page, status_code=200)


# ── 3. JSON trip data via token (mobile deep-link resolution) ─────────────────

@share_router.get("/{token}/data")
def trip_share_data(
    token: str,
    session: Session = Depends(get_session),
):
    """
    Return trip JSON via share token — no auth required.
    Used by the mobile app to resolve a shared deep-link into full trip data.
    """
    from app.api.routes.public_trips import build_trip_read

    share = trip_share_crud.get_share_by_token(session=session, token=token)
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")

    trip = crud.trip.get_trip(session=session, trip_id=share.trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip_share_crud.increment_view(session=session, share=share)
    return build_trip_read(trip, session)
