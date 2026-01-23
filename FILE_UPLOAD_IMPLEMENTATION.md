# File Upload System Implementation

## Overview
Comprehensive file upload system for provider registration documents, trip images, and user avatars with admin-configurable file definitions.

---

## ✅ Backend Implementation (COMPLETED)

### 1. Database Models

#### **FileDefinition Model** (`app/models/file_definition.py`)
Admin-configurable file requirements with localization support.

**Fields:**
- `id`: UUID primary key
- `key`: Unique identifier (e.g., "zakat_certificate")
- `name_en`, `name_ar`: Localized display names
- `description_en`, `description_ar`: Localized descriptions/hints
- `allowed_extensions`: JSON array (e.g., ["pdf", "jpg", "png"])
- `max_size_mb`: Maximum file size in MB
- `is_required`: Whether file is mandatory
- `is_active`: Whether definition is active
- `display_order`: Order in forms
- `created_at`, `updated_at`: Timestamps

**Example:**
```json
{
  "key": "zakat_certificate",
  "name_en": "Zakat Registration Certificate",
  "name_ar": "شهادة تسجيل الزكاة",
  "description_en": "Your Zakat Registration Certificate that proves you have registered with Zakat, Tax and Customs Authority",
  "description_ar": "شهادة تسجيل الزكاة الخاصة بك والتي تثبت تسجيلك لدى هيئة الزكاة والضريبة والجمارك",
  "allowed_extensions": ["pdf", "jpg", "png"],
  "max_size_mb": 100,
  "is_required": true,
  "is_active": true,
  "display_order": 1
}
```

#### **ProviderFile Model** (`app/models/provider_file.py`)
Stores uploaded files for provider registration.

**Fields:**
- `id`: UUID primary key
- `provider_id`: Foreign key to Provider
- `file_definition_id`: Foreign key to FileDefinition
- `file_url`: URL in Backblaze B2
- `file_name`: Original filename
- `file_size_bytes`: File size in bytes
- `file_extension`: File extension (e.g., "pdf")
- `content_type`: MIME type
- `file_hash`: SHA256 hash for integrity
- `is_verified`: Admin verification status
- `verified_by_id`: Admin who verified (nullable)
- `verified_at`: Verification timestamp (nullable)
- `uploaded_at`: Upload timestamp

---

### 2. API Endpoints

#### **File Definition Management (Admin Only)**

**Create File Definition**
```
POST /api/v1/file-definitions
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "key": "commercial_registration",
  "name_en": "Commercial Registration",
  "name_ar": "السجل التجاري",
  "description_en": "Your company's commercial registration certificate",
  "description_ar": "شهادة السجل التجاري لشركتك",
  "allowed_extensions": ["pdf", "jpg", "png"],
  "max_size_mb": 50,
  "is_required": true,
  "is_active": true,
  "display_order": 2
}
```

**List File Definitions**
```
GET /api/v1/file-definitions?skip=0&limit=100&active_only=false
Authorization: Bearer {admin_token}
```

**Get Single File Definition**
```
GET /api/v1/file-definitions/{file_definition_id}
Authorization: Bearer {admin_token}
```

**Update File Definition**
```
PUT /api/v1/file-definitions/{file_definition_id}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name_en": "Updated Name",
  "max_size_mb": 75,
  "is_active": false
}
```

**Delete File Definition**
```
DELETE /api/v1/file-definitions/{file_definition_id}
Authorization: Bearer {admin_token}
```

#### **Public Endpoint (No Auth Required)**

**Get Provider Registration File Requirements**
```
GET /api/v1/file-definitions/provider-registration

Response:
[
  {
    "id": "uuid",
    "key": "zakat_certificate",
    "name_en": "Zakat Registration Certificate",
    "name_ar": "شهادة تسجيل الزكاة",
    "description_en": "Your Zakat Registration Certificate...",
    "description_ar": "شهادة تسجيل الزكاة الخاصة بك...",
    "allowed_extensions": ["pdf", "jpg", "png"],
    "max_size_mb": 100,
    "is_required": true,
    "is_active": true,
    "display_order": 1,
    "created_at": "2026-01-22T16:00:00",
    "updated_at": "2026-01-22T16:00:00"
  }
]
```

#### **File Upload (Provider Users)**

**Upload Provider Registration File**
```
POST /api/v1/files/provider-registration/{file_definition_id}
Authorization: Bearer {provider_token}
Content-Type: multipart/form-data

file: <binary file data>

Response:
{
  "file_id": "uuid",
  "file_url": "https://backblaze-url/provider_uuid/zakat_certificate_uuid.pdf",
  "file_name": "zakat_certificate.pdf",
  "file_size_bytes": 1048576,
  "message": "File uploaded successfully"
}
```

**Get Provider's Uploaded Files**
```
GET /api/v1/files/provider-registration
Authorization: Bearer {provider_token}

Response:
[
  {
    "id": "uuid",
    "provider_id": "uuid",
    "file_definition_id": "uuid",
    "file_url": "https://...",
    "file_name": "zakat_certificate.pdf",
    "file_size_bytes": 1048576,
    "file_extension": "pdf",
    "content_type": "application/pdf",
    "file_hash": "sha256hash",
    "is_verified": false,
    "verified_by_id": null,
    "verified_at": null,
    "uploaded_at": "2026-01-22T16:30:00"
  }
]
```

**Delete Uploaded File**
```
DELETE /api/v1/files/provider-registration/{file_id}
Authorization: Bearer {provider_token}
```

#### **File Verification (Admin Only)**

**Verify/Unverify Provider File**
```
PUT /api/v1/files/provider-registration/{file_id}/verify
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "is_verified": true
}
```

**Get All Files for a Provider**
```
GET /api/v1/files/provider/{provider_id}/files
Authorization: Bearer {admin_token}
```

---

### 3. File Upload Flow

1. **Provider Registration Page** calls `GET /api/v1/file-definitions/provider-registration` to get required files
2. **Display form fields** dynamically based on returned file definitions
3. **User selects file** and clicks upload
4. **Frontend validates** file extension and size client-side
5. **POST to upload endpoint** with file and file_definition_id
6. **Backend validates**:
   - User has provider
   - File definition exists and is active
   - File extension is allowed
   - File size is within limit
7. **Upload to Backblaze B2** with unique filename
8. **Calculate SHA256 hash** for integrity
9. **Save file record** to database
10. **Return file URL** and metadata

---

### 4. File Validation

**Extension Validation:**
- Normalized to lowercase
- Dot prefix removed
- Checked against `allowed_extensions` array

**Size Validation:**
- Converted to bytes: `max_size_mb * 1024 * 1024`
- Checked against actual file size

**Duplicate Handling:**
- If file already exists for same provider + file_definition:
  - Delete old file from Backblaze B2
  - Delete old database record
  - Upload new file

---

### 5. Database Migration

**Migration:** `5e2be6fd1785_add_file_definition_and_provider_file_tables.py`

**Tables Created:**
- `filedefinition` with unique index on `key`
- `providerfile` with indexes on `provider_id` and `file_definition_id`

**Applied:** ✅ Successfully

---

## 📋 Next Steps (Frontend)

### 1. Admin Panel - File Definition Management

**Create Settings Page** (`/admin-panel/src/pages/settings/file-definitions.tsx`)

**Features:**
- List all file definitions
- Create new file definition
- Edit existing file definition
- Delete file definition
- Toggle active status
- Reorder display order (drag & drop)

**UI Components:**
- Table with sortable columns
- Create/Edit modal with form
- Localization fields (EN/AR tabs)
- Extension multi-select
- Size slider (1-500 MB)
- Active toggle switch

### 2. Provider Registration Page - File Upload

**Update Registration Form** (`/providers-panel/src/pages/register.tsx`)

**Features:**
- Fetch file requirements on page load
- Display file upload fields dynamically
- Show localized names and descriptions
- Client-side validation (extension, size)
- Upload progress indicator
- Preview uploaded files
- Delete uploaded files
- Show verification status

**UI Components:**
- File input with drag & drop
- File preview cards
- Upload progress bar
- Verification badge
- Delete button

---

## 🔧 Configuration

### Environment Variables
No new environment variables needed. Uses existing:
- `BACKBLAZE_KEY_ID`
- `BACKBLAZE_APPLICATION_KEY`
- `BACKBLAZE_BUCKET_NAME`

### Backblaze B2 Structure
```
bucket/
  provider_{uuid}/
    zakat_certificate_{uuid}.pdf
    commercial_registration_{uuid}.jpg
    ...
```

---

## 🧪 Testing

### Manual Testing Steps

1. **Create File Definition (Admin)**
   ```bash
   curl -X POST http://localhost:8000/api/v1/file-definitions \
     -H "Authorization: Bearer {admin_token}" \
     -H "Content-Type: application/json" \
     -d '{
       "key": "test_document",
       "name_en": "Test Document",
       "name_ar": "وثيقة اختبار",
       "description_en": "Test description",
       "description_ar": "وصف الاختبار",
       "allowed_extensions": ["pdf"],
       "max_size_mb": 10,
       "is_required": true,
       "is_active": true,
       "display_order": 1
     }'
   ```

2. **Get File Requirements (Public)**
   ```bash
   curl http://localhost:8000/api/v1/file-definitions/provider-registration
   ```

3. **Upload File (Provider)**
   ```bash
   curl -X POST http://localhost:8000/api/v1/files/provider-registration/{file_definition_id} \
     -H "Authorization: Bearer {provider_token}" \
     -F "file=@test.pdf"
   ```

4. **Verify File (Admin)**
   ```bash
   curl -X PUT http://localhost:8000/api/v1/files/provider-registration/{file_id}/verify \
     -H "Authorization: Bearer {admin_token}" \
     -H "Content-Type: application/json" \
     -d '{"is_verified": true}'
   ```

---

## 📊 Database Schema

```sql
-- File Definition Table
CREATE TABLE filedefinition (
    id UUID PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    name_ar VARCHAR(200) NOT NULL,
    description_en VARCHAR(500) NOT NULL,
    description_ar VARCHAR(500) NOT NULL,
    allowed_extensions JSON,
    max_size_mb INTEGER NOT NULL,
    is_required BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Provider File Table
CREATE TABLE providerfile (
    id UUID PRIMARY KEY,
    provider_id UUID NOT NULL REFERENCES provider(id),
    file_definition_id UUID NOT NULL REFERENCES filedefinition(id),
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64),
    is_verified BOOLEAN NOT NULL,
    verified_by_id UUID REFERENCES user(id),
    verified_at TIMESTAMP,
    uploaded_at TIMESTAMP NOT NULL
);

CREATE INDEX ix_providerfile_provider_id ON providerfile(provider_id);
CREATE INDEX ix_providerfile_file_definition_id ON providerfile(file_definition_id);
```

---

## 🎯 Future Enhancements

### Trip Images Upload
- Similar endpoint: `POST /api/v1/files/trip/{trip_id}/images`
- Multiple images per trip
- Image optimization/resizing
- Set primary image

### User Avatars Upload
- Endpoint: `POST /api/v1/files/user/avatar`
- Single image per user
- Automatic cropping to square
- Thumbnail generation

### File Categories
- Extend FileDefinition with `category` field
- Categories: "provider_registration", "trip_images", "user_avatars"
- Filter by category in endpoints

---

## 📝 Notes

- **Security**: Files are stored in Backblaze B2 with unique UUIDs to prevent guessing
- **Integrity**: SHA256 hash stored for each file to detect tampering
- **Cleanup**: Old files are automatically deleted when replaced
- **Localization**: All user-facing text supports English and Arabic
- **Validation**: Both client-side and server-side validation for better UX and security
- **Admin Control**: Admins can configure all file requirements without code changes

---

## ✅ Completed
- [x] Database models with localization
- [x] CRUD operations for file definitions
- [x] Admin API endpoints for managing file definitions
- [x] Public endpoint for retrieving file requirements
- [x] File upload endpoint with validation
- [x] File deletion endpoint
- [x] Admin verification endpoint
- [x] Database migration applied
- [x] Integration with Backblaze B2 storage service

## 🚧 Pending
- [ ] Admin panel UI for file definition management
- [ ] Provider registration page file upload UI
- [ ] Trip images upload endpoints
- [ ] User avatar upload endpoints
- [ ] Unit tests for file upload functionality
- [ ] Integration tests for complete flow
