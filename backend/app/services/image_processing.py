"""
Image processing utilities — validation, compression, and resizing before storage upload.

Policies
--------
Trip images:
  - Min resolution : 800 × 600 px  (landscape) or 600 × 800 px (portrait)
  - Max long edge  : 1920 px  (downscaled if larger, preserving aspect ratio)
  - Output quality : 85 (JPEG/WEBP)
  - Output format  : JPEG (PNG inputs are converted to JPEG to save space)

Avatar / profile images:
  - No minimum resolution check  (cropped-square inputs are fine at 200 px+)
  - Resized to fit   : 400 × 400 px  (downscaled only, never upscaled)
  - Output quality   : 85
  - Output format    : JPEG

Review / rating images:
  - No minimum resolution
  - Max long edge  : 1280 px
  - Output quality : 80
  - Output format  : JPEG

Provider cover images:
  - Min resolution : 1200 × 400 px  (landscape only — cover images are always wide)
  - Max long edge  : 3840 px  (downscaled if larger, preserving aspect ratio)
  - Output quality : 85
  - Output format  : JPEG
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Tuple

from PIL import Image, UnidentifiedImageError


# ── constants ─────────────────────────────────────────────────────────────────

TRIP_IMAGE_MIN_WIDTH  = 800
TRIP_IMAGE_MIN_HEIGHT = 600
TRIP_IMAGE_MAX_LONG   = 1920
TRIP_IMAGE_QUALITY    = 85

AVATAR_MAX_SIZE       = 400   # square
AVATAR_QUALITY        = 85

REVIEW_IMAGE_MAX_LONG = 1280
REVIEW_IMAGE_QUALITY  = 80

COVER_IMAGE_MIN_WIDTH  = 1200
COVER_IMAGE_MIN_HEIGHT = 400
COVER_IMAGE_MAX_LONG   = 3840
COVER_IMAGE_QUALITY    = 85


# ── helpers ───────────────────────────────────────────────────────────────────

@dataclass
class ProcessedImage:
    data: bytes
    content_type: str
    width: int
    height: int


def _open_image(data: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()            # detect truncated / corrupt files
        img = Image.open(io.BytesIO(data))   # re-open after verify (verify consumes stream)
        img.load()
        return img
    except (UnidentifiedImageError, Exception) as exc:
        raise ValueError(f"Cannot read image file: {exc}") from exc


def _to_rgb(img: Image.Image) -> Image.Image:
    """Convert RGBA/P/LA etc. to RGB so we can save as JPEG."""
    if img.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        return background
    if img.mode != "RGB":
        return img.convert("RGB")
    return img


def _downscale_to_max_long_edge(img: Image.Image, max_long: int) -> Image.Image:
    w, h = img.size
    long_edge = max(w, h)
    if long_edge <= max_long:
        return img
    scale = max_long / long_edge
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return img.resize((new_w, new_h), Image.LANCZOS)


def _encode_jpeg(img: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


# ── public API ────────────────────────────────────────────────────────────────

def process_trip_image(data: bytes, filename: str) -> ProcessedImage:
    """
    Validate minimum resolution, then compress/downscale trip image.

    Raises ValueError with a descriptive message if the image is too small.
    Returns ProcessedImage with compressed JPEG bytes.
    """
    img = _open_image(data)
    w, h = img.size

    # Min resolution: both orientations accepted
    landscape_ok = w >= TRIP_IMAGE_MIN_WIDTH  and h >= TRIP_IMAGE_MIN_HEIGHT
    portrait_ok  = w >= TRIP_IMAGE_MIN_HEIGHT and h >= TRIP_IMAGE_MIN_WIDTH
    if not (landscape_ok or portrait_ok):
        raise ValueError(
            f"Image '{filename}' is too small ({w}×{h} px). "
            f"Minimum resolution is {TRIP_IMAGE_MIN_WIDTH}×{TRIP_IMAGE_MIN_HEIGHT} px."
        )

    img = _to_rgb(img)
    img = _downscale_to_max_long_edge(img, TRIP_IMAGE_MAX_LONG)
    compressed = _encode_jpeg(img, TRIP_IMAGE_QUALITY)

    out_w, out_h = img.size
    return ProcessedImage(
        data=compressed,
        content_type="image/jpeg",
        width=out_w,
        height=out_h,
    )


def process_avatar_image(data: bytes, filename: str) -> ProcessedImage:
    """
    Resize avatar to fit within AVATAR_MAX_SIZE × AVATAR_MAX_SIZE and compress.
    No minimum resolution check — the mobile app already enforces a 1:1 crop.
    """
    img = _open_image(data)
    img = _to_rgb(img)

    w, h = img.size
    if w > AVATAR_MAX_SIZE or h > AVATAR_MAX_SIZE:
        img.thumbnail((AVATAR_MAX_SIZE, AVATAR_MAX_SIZE), Image.LANCZOS)

    compressed = _encode_jpeg(img, AVATAR_QUALITY)
    out_w, out_h = img.size
    return ProcessedImage(
        data=compressed,
        content_type="image/jpeg",
        width=out_w,
        height=out_h,
    )


def process_review_image(data: bytes, filename: str) -> ProcessedImage:
    """Downscale review / rating image and compress."""
    img = _open_image(data)
    img = _to_rgb(img)
    img = _downscale_to_max_long_edge(img, REVIEW_IMAGE_MAX_LONG)
    compressed = _encode_jpeg(img, REVIEW_IMAGE_QUALITY)
    out_w, out_h = img.size
    return ProcessedImage(
        data=compressed,
        content_type="image/jpeg",
        width=out_w,
        height=out_h,
    )


def process_cover_image(data: bytes, filename: str) -> ProcessedImage:
    """
    Validate minimum resolution for cover images, then compress/downscale.

    Minimum size is 1200×400 px (landscape only — covers are always wide banners).
    Raises ValueError with a descriptive message if the image is too small or portrait.
    Returns ProcessedImage with compressed JPEG bytes.
    """
    img = _open_image(data)
    w, h = img.size

    if w < COVER_IMAGE_MIN_WIDTH or h < COVER_IMAGE_MIN_HEIGHT:
        raise ValueError(
            f"Cover image '{filename}' is too small ({w}×{h} px). "
            f"Minimum resolution is {COVER_IMAGE_MIN_WIDTH}×{COVER_IMAGE_MIN_HEIGHT} px "
            f"(landscape / banner format required)."
        )

    img = _to_rgb(img)
    img = _downscale_to_max_long_edge(img, COVER_IMAGE_MAX_LONG)
    compressed = _encode_jpeg(img, COVER_IMAGE_QUALITY)

    out_w, out_h = img.size
    return ProcessedImage(
        data=compressed,
        content_type="image/jpeg",
        width=out_w,
        height=out_h,
    )
