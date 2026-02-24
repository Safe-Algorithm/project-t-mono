# Image Upload System

## Overview

All image uploads go through a Pillow-based processing pipeline before being stored in Backblaze B2. Processing is offloaded to a thread pool executor so it does not block the FastAPI event loop.

---

## Current State (Implemented)

### Library

- **Pillow** added to `backend/pyproject.toml` as a dependency.
- Processing utility: `backend/app/services/image_processing.py`

### Processing Policies

| Image type | Min resolution | Max stored size | JPEG quality | Notes |
|---|---|---|---|---|
| Trip images | 800×600 px (landscape) or 600×800 px (portrait) | 1920 px long edge | 85 | PNG/WEBP inputs converted to JPEG |
| Avatars (user + provider) | None | 400×400 px (downscale only, never upscaled) | 85 | Mobile app enforces 1:1 crop before upload |
| Review images | None | 1280 px long edge | 80 | |
| Provider rating images | None | 1280 px long edge | 80 | Same processor as review images |

### Public API in `image_processing.py`

```python
def process_trip_image(data: bytes, filename: str) -> ProcessedImage
def process_avatar_image(data: bytes, filename: str) -> ProcessedImage
def process_review_image(data: bytes, filename: str) -> ProcessedImage
```

`ProcessedImage` is a dataclass with `data: bytes`, `content_type: str`, `width: int`, `height: int`.

All three functions raise `ValueError` with a descriptive message on invalid input (corrupt file, too small, etc.).

### Endpoints updated

| Endpoint | Route file | Processor used |
|---|---|---|
| `POST /trips/{trip_id}/upload-images` | `routes/trips.py` | `process_trip_image` |
| `POST /providers/upload-avatar` | `routes/providers.py` | `process_avatar_image` |
| `POST /users/me/avatar` | `routes/users.py` | `process_avatar_image` |
| `POST /reviews/{review_id}/images` | `routes/reviews.py` | `process_review_image` |
| `POST /providers/ratings/{rating_id}/images` | `routes/provider_ratings.py` | `process_review_image` |

### Raw upload size limit

All endpoints accept up to **10 MB** raw input. The file is compressed before storage, so the stored size is significantly smaller.

### Thread pool offloading

All Pillow calls use `loop.run_in_executor(None, process_*_image, ...)` so the async event loop is never blocked:

```python
loop = asyncio.get_event_loop()
processed = await loop.run_in_executor(
    None, process_trip_image, content, file.filename or "image.jpg"
)
```

This protects other requests (search, booking, etc.) from being delayed by image CPU work. It does **not** reduce how long the uploading user waits — they still wait for Pillow to finish.

### Client-side validation (Provider Panel)

`providers-panel/src/components/trips/TripForm.tsx` performs a client-side resolution check before any trip image is sent to the backend:

- Minimum: 800×600 px (landscape) or 600×800 px (portrait)
- Rejected files are shown in a red error banner with per-file messages
- Accepted files proceed to upload normally

This gives providers immediate feedback without a round-trip.

### Tests

All five test files updated to use real Pillow-generated JPEGs (not fake byte strings):

- `test_trips.py` — includes `test_upload_trip_images_too_small` for the min-resolution rejection path
- `test_profile.py`
- `test_providers.py`
- `test_reviews.py`
- `test_provider_ratings.py`

Size-limit tests all use 11 MB files (exceeds the 10 MB limit).

Run inside the Docker container:

```bash
docker exec project-t-mono-backend-1 poetry run pytest \
  app/tests/api/routes/test_trips.py \
  app/tests/api/routes/test_profile.py \
  app/tests/api/routes/test_providers.py \
  app/tests/api/routes/test_reviews.py \
  app/tests/api/routes/test_provider_ratings.py \
  -q
```

---

## Why Thread Pool Is Not Enough — Future Improvement

### The problem

`run_in_executor` protects the event loop but **does not increase throughput**. The uploading user still waits synchronously for:

1. Pillow decode + resize + re-encode (~50–400 ms per image depending on input size)
2. B2 upload (~200–800 ms depending on file size and network)

At even moderate concurrency (e.g. 50 concurrent review image uploads), CPU saturates and wait times grow linearly. With the planned **trip comments with user image uploads** feature, this will be a real bottleneck.

### Planned async pipeline

The correct architecture is:

```
1. Client uploads raw image bytes
2. Backend validates type + size (cheap checks only — no Pillow yet)
3. Backend stores raw bytes to B2 under raw/ prefix
4. Backend creates ImageUploadJob row (status=pending) in DB
5. Backend enqueues TaskIQ task with job_id
6. API responds 202 Accepted immediately with { job_id, status: "pending" }
7. TaskIQ worker picks up job:
     a. Sets job status → processing
     b. Downloads raw bytes from B2
     c. Runs Pillow processing (validate + resize + compress)
     d. Uploads processed bytes to B2 under final/ prefix
     e. Updates ImageUploadJob: status=done, final_url=...
     f. Appends final_url to parent entity (review.images, trip.images, etc.)
     g. Deletes raw file from B2  ← only after DB is confirmed updated
8. Client polls GET /image-jobs/{job_id} with exponential backoff until done
```

**Critical ordering in step 7:** the raw file must not be deleted until step (f) is committed to the DB. If B2 upload (d) or DB update (f) fails, the raw file must survive so the job can be retried.

### Raw file lifecycle

| Scenario | What happens to the raw file |
|---|---|
| Worker completes successfully | Deleted from B2 immediately after DB commit in step 7g |
| Pillow processing raises `ValueError` (e.g. corrupt image) | Not deleted — job marked `failed`, raw kept for inspection. Error stored in `error_msg`. No retry (corrupt input will never succeed). |
| B2 processed upload fails (network / B2 error) | Not deleted — job retried (see below). Raw stays until a retry succeeds. |
| DB update fails after B2 upload | Not deleted — job retried. Worker will re-upload (idempotent if `final_url` already set — skip B2 upload, go straight to DB). |
| Worker process crashes mid-job | Raw stays. Orphan recovery task re-enqueues the job (see below). |
| Job is `failed` and no retry remains | Raw kept in B2 under `raw/` indefinitely for manual replay or inspection. An admin endpoint or a configurable TTL cleanup job can purge these eventually. |

### Retry strategy

Use TaskIQ's built-in retry mechanism with exponential backoff:

```python
@broker.task(retry_on_error=True, max_retries=3)
async def process_image_job(job_id: str):
    ...
```

Retry schedule (example):

| Attempt | Delay before retry |
|---|---|
| 1st failure | 10 s |
| 2nd failure | 60 s |
| 3rd failure | 300 s |
| After 3rd failure | Job status → `failed`, no more retries |

**Do not retry on `ValueError`** (bad image data — user error, retriable would be pointless). Catch `ValueError` separately, immediately set `status=failed` with the message, and raise a non-retriable exception to stop TaskIQ from re-enqueuing.

```python
try:
    processed = process_trip_image(raw_bytes, filename)
except ValueError as exc:
    job.status = "failed"
    job.error_msg = str(exc)
    session.commit()
    return  # do NOT raise — prevents TaskIQ retry

# All other exceptions (B2 timeout, DB error) → raise → TaskIQ retries
```

### Orphan recovery (stuck jobs)

A worker crash between steps 7a–7f leaves a job stuck in `processing` forever. A scheduled TaskIQ periodic task handles this:

```python
@broker.task
async def recover_stuck_image_jobs():
    """
    Re-enqueue jobs stuck in pending/processing for more than STUCK_THRESHOLD.
    Run every 5 minutes via TaskIQ scheduler.
    """
    STUCK_THRESHOLD = timedelta(minutes=10)
    cutoff = datetime.now(timezone.utc) - STUCK_THRESHOLD
    stuck_jobs = session.exec(
        select(ImageUploadJob)
        .where(ImageUploadJob.status.in_(["pending", "processing"]))
        .where(ImageUploadJob.updated_at < cutoff)
    ).all()
    for job in stuck_jobs:
        job.status = "pending"   # reset so worker picks it up cleanly
        job.attempt_count += 1
        session.add(job)
        await process_image_job.kiq(job_id=str(job.id))
    session.commit()
```

Add `attempt_count: int = 0` to the model. If `attempt_count` exceeds a hard cap (e.g. 5), mark as `failed` rather than re-enqueue — this prevents infinite loops on consistently broken jobs.

### `ImageUploadJob` model — updated

Adds `attempt_count` and `raw_b2_file_id` (needed to call B2 delete, which requires both file ID and file name):

```python
class ImageUploadJobStatus(str, Enum):
    pending    = "pending"
    processing = "processing"
    done       = "done"
    failed     = "failed"

class ImageUploadJob(SQLModel, table=True):
    id: uuid.UUID               = Field(default_factory=uuid.uuid4, primary_key=True)
    status: ImageUploadJobStatus = Field(default=ImageUploadJobStatus.pending)
    entity_type: str            # "trip", "review", "provider_rating", "trip_comment"
    entity_id: uuid.UUID
    raw_b2_key: str             # B2 file name/path — used as the download path
    raw_b2_file_id: str         # B2 fileId — required for b2_delete_file_version
    final_url: Optional[str]   = None
    error_msg: Optional[str]   = None
    attempt_count: int          = Field(default=0)
    created_at: datetime        = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime        = Field(default_factory=lambda: datetime.now(timezone.utc))
```

### Scope of async pipeline

| Endpoint | Strategy | Reason |
|---|---|---|
| Trip images | **Async** | Providers upload 5–10 at once, 4K images; async gives better UX and scalability |
| Review images | **Async** | High volume user-facing; main motivation |
| Provider rating images | **Async** | Same pattern as reviews |
| Trip comment images *(future)* | **Async** | Will slot in automatically once infrastructure exists |
| User avatar | **Keep sync** | Single small image, <100 ms, user needs instant feedback for profile preview |
| Provider company avatar | **Keep sync** | Same as user avatar |

### Backend work required

#### 1. `ImageUploadJob` model

See model definition in the **Raw file lifecycle** section above (includes `attempt_count` and `raw_b2_file_id`).

New file: `backend/app/models/image_upload_job.py`. Register in `backend/app/models/__init__.py`.

#### 2. Alembic migration

New table `imageuplodjob`. Run with the usual `alembic upgrade head` inside the container.

#### 3. Upload endpoint changes (trips, reviews, provider ratings)

Replace the current synchronous flow with:

```python
# 1. Validate type + raw size only
# 2. Store raw to B2
raw_info = await storage_service.upload_file(raw_bytes, filename, folder="raw/reviews")
# 3. Create job
job = ImageUploadJob(entity_type="review", entity_id=review_id, raw_b2_key=raw_info["fileName"])
session.add(job); session.commit()
# 4. Enqueue TaskIQ task
await process_image_job.kiq(job_id=str(job.id))
# 5. Return 202
return JSONResponse(status_code=202, content={"job_id": str(job.id), "status": "pending"})
```

#### 4. TaskIQ task (new file: `backend/app/tasks/image_tasks.py`)

```python
MAX_MANUAL_RETRIES = 5  # hard cap for orphan recovery

@broker.task(retry_on_error=True, max_retries=3)
async def process_image_job(job_id: str):
    job = session.get(ImageUploadJob, job_id)
    if not job or job.status == "done":
        return  # already done (duplicate delivery)

    job.status = "processing"
    job.updated_at = datetime.now(timezone.utc)
    session.commit()

    # Download raw
    raw_bytes = await storage_service.download_file(job.raw_b2_key)

    # Process — ValueError means bad input, do NOT retry
    processor = _get_processor(job.entity_type)  # returns process_trip_image etc.
    try:
        processed = processor(raw_bytes, "image.jpg")
    except ValueError as exc:
        job.status = "failed"
        job.error_msg = str(exc)
        job.updated_at = datetime.now(timezone.utc)
        session.commit()
        return  # stops TaskIQ from retrying

    # Upload processed — all errors below are retriable (raise → TaskIQ retries)
    upload_result = await storage_service.upload_file(
        processed.data, f"{uuid4()}.jpg",
        content_type=processed.content_type,
        folder=f"processed/{job.entity_type}s"
    )
    final_url = upload_result["downloadUrl"]

    # Update parent entity
    _append_image_to_entity(session, job.entity_type, job.entity_id, final_url)

    # Mark job done
    job.status = "done"
    job.final_url = final_url
    job.updated_at = datetime.now(timezone.utc)
    session.commit()

    # Delete raw — only after DB is confirmed committed
    await storage_service.delete_file(
        file_id=job.raw_b2_file_id,
        file_name=job.raw_b2_key
    )


@broker.task
async def recover_stuck_image_jobs():
    """Scheduled every 5 minutes. Re-enqueues jobs stuck in pending/processing."""
    STUCK_THRESHOLD = timedelta(minutes=10)
    cutoff = datetime.now(timezone.utc) - STUCK_THRESHOLD
    stuck = session.exec(
        select(ImageUploadJob)
        .where(ImageUploadJob.status.in_(["pending", "processing"]))
        .where(ImageUploadJob.updated_at < cutoff)
    ).all()
    for job in stuck:
        if job.attempt_count >= MAX_MANUAL_RETRIES:
            job.status = "failed"
            job.error_msg = "Exceeded max recovery attempts"
        else:
            job.status = "pending"
            job.attempt_count += 1
            await process_image_job.kiq(job_id=str(job.id))
        job.updated_at = datetime.now(timezone.utc)
        session.add(job)
    session.commit()
```

#### 5. Polling endpoint (new route in a shared or existing router)

```
GET /image-jobs/{job_id}

Response:
{
  "job_id": "...",
  "status": "pending" | "processing" | "done" | "failed",
  "final_url": "https://..." | null,
  "error_msg": null | "..."
}
```

Auth: the requesting user must own the entity the job belongs to.

### Frontend work required

#### Mobile app (`rihla-app`)

After calling the review image upload endpoint and receiving `202 { job_id }`:

```typescript
async function pollJobUntilDone(jobId: string): Promise<string> {
  let delay = 500; // ms
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(delay);
    const job = await api.get(`/image-jobs/${jobId}`);
    if (job.status === "done")    return job.final_url;
    if (job.status === "failed")  throw new Error(job.error_msg);
    delay = Math.min(delay * 2, 8000); // cap at 8s
  }
  throw new Error("Image processing timed out");
}
```

Show a loading placeholder (e.g. a grey shimmer card) while the job is pending, swap for the real image once `final_url` arrives.

#### Provider panel (`providers-panel`)

Same polling pattern for trip image uploads. Show upload progress per file.

### Testing

- Update `test_reviews.py` and `test_trips.py`: upload now returns 202 with `job_id`
- Add `test_image_job_polling`: mock TaskIQ, manually transition job to `done`, assert polling endpoint returns `final_url`
- Add `test_image_job_failed_bad_image`: send corrupt bytes, assert job → `failed`, `error_msg` set, no TaskIQ retry
- Add `test_image_job_failed_b2_error`: mock B2 upload to raise, assert job stays retriable (status not `failed` after 1st attempt)
- Add `test_recover_stuck_jobs`: create a `processing` job with `updated_at` 15 minutes ago, run recovery task, assert job re-enqueued
- Add `test_recover_stuck_jobs_hard_cap`: same but `attempt_count=5`, assert job marked `failed` not re-enqueued
- Keep existing resolution rejection tests (cheap validation still happens synchronously before raw storage)

---

## File Map

```
backend/
  app/
    services/
      image_processing.py       ← Pillow processing (current, complete)
      storage.py                ← Backblaze B2 upload/delete
    models/
      image_upload_job.py       ← FUTURE: job tracking model
    tasks/
      image_tasks.py            ← FUTURE: TaskIQ worker task
    api/
      routes/
        trips.py                ← upload-images endpoint (current: sync+threadpool)
        reviews.py              ← upload images endpoint (current: sync+threadpool)
        provider_ratings.py     ← upload images endpoint (current: sync+threadpool)
        users.py                ← avatar endpoint (sync, keep as-is)
        providers.py            ← avatar endpoint (sync, keep as-is)
    tests/
      api/routes/
        test_trips.py
        test_profile.py
        test_providers.py
        test_reviews.py
        test_provider_ratings.py

providers-panel/
  src/
    components/trips/
      TripForm.tsx              ← client-side resolution check (current, complete)
```
