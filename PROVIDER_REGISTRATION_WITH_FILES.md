# Provider Registration with File Uploads

## Overview
The provider registration flow now includes file upload functionality that validates required documents during the registration process.

## Architecture

### Frontend Flow (Providers Panel)

1. **Page Load** (`/register`)
   - Fetches required file definitions from public endpoint: `GET /api/v1/file-definitions/provider-registration`
   - No authentication required for this endpoint
   - Returns list of active file definitions with:
     - Name (English & Arabic)
     - Description (English & Arabic)
     - Allowed extensions
     - Max file size
     - Required flag
     - Display order

2. **File Selection**
   - User selects files locally using `FileSelector` component
   - Client-side validation:
     - File extension must match allowed extensions
     - File size must not exceed max_size_mb
   - Files are stored in component state (not uploaded yet)

3. **Form Submission**
   - **Step 1**: Validate all required files are selected
   - **Step 2**: Submit registration data (user + provider info)
     - Endpoint: `POST /api/v1/providers/register`
     - Creates user, provider, and provider request
   - **Step 3**: Login with new credentials
     - Endpoint: `POST /api/v1/login/access-token`
     - Gets access token for file uploads
   - **Step 4**: Upload all selected files
     - Endpoint: `POST /api/v1/files/provider-registration/{file_definition_id}`
     - Uploads each file with authentication
   - **Step 5**: Redirect to login page

### Backend Endpoints

#### Public Endpoints (No Auth)
- `GET /api/v1/file-definitions/provider-registration`
  - Returns active file definitions for provider registration
  - Used by registration page to know what files to request

- `POST /api/v1/providers/register`
  - Creates user, provider, and provider request
  - Does not handle file uploads directly

#### Authenticated Endpoints
- `POST /api/v1/files/provider-registration/{file_definition_id}`
  - Uploads file for specific file definition
  - Validates:
    - User has provider_id
    - File definition exists and is active
    - File extension is allowed
    - File size is within limit
  - Replaces existing file if provider already uploaded one for this definition
  - Stores file in Backblaze B2

- `GET /api/v1/files/provider-registration`
  - Lists all files uploaded by current provider

- `DELETE /api/v1/files/provider-registration/{file_id}`
  - Deletes uploaded file

#### Admin Endpoints
- `POST /admin/settings/file-definitions` - Create file definition
- `GET /admin/settings/file-definitions` - List file definitions
- `GET /admin/settings/file-definitions/{id}` - Get file definition
- `PUT /admin/settings/file-definitions/{id}` - Update file definition
- `DELETE /admin/settings/file-definitions/{id}` - Delete file definition
- `PUT /files/provider-registration/{file_id}/verify` - Verify uploaded file

## Components

### Frontend Components

#### `FileSelector.tsx`
- Displays file upload UI for a single file definition
- Features:
  - Drag and drop support
  - Click to select file
  - Client-side validation (extension, size)
  - File preview with size display
  - Remove file functionality
  - Shows allowed extensions and max size
  - Marks required fields with asterisk

#### `register.tsx`
- Main registration page
- Fetches file requirements on load
- Displays file selectors for each required file
- Validates all required files are selected before submission
- Handles complete registration flow including file uploads

### Backend Models

#### `FileDefinition`
- Defines what files are required for provider registration
- Fields:
  - `key` - Unique identifier (e.g., "commercial_license")
  - `name_en`, `name_ar` - Display names
  - `description_en`, `description_ar` - Descriptions
  - `allowed_extensions` - List of allowed file extensions
  - `max_size_mb` - Maximum file size in megabytes
  - `is_required` - Whether file is mandatory
  - `is_active` - Whether file definition is currently active
  - `display_order` - Order to display in UI

#### `ProviderFile`
- Stores uploaded files for providers
- Fields:
  - `provider_id` - Link to provider
  - `file_definition_id` - Link to file definition
  - `file_url` - URL in Backblaze B2
  - `file_name` - Original filename
  - `file_size_bytes` - File size
  - `file_extension` - File extension
  - `content_type` - MIME type
  - `file_hash` - SHA256 hash for integrity
  - `is_verified` - Admin verification status
  - `verified_by_id` - Admin who verified
  - `verified_at` - Verification timestamp
  - `uploaded_at` - Upload timestamp

## Validation

### Client-Side Validation
1. File extension must be in allowed list
2. File size must not exceed maximum
3. All required files must be selected before submission

### Server-Side Validation
1. File definition must exist and be active
2. File extension must be in allowed list
3. File size must not exceed maximum
4. User must have a provider_id
5. File is uploaded to Backblaze B2
6. File metadata is stored in database

## Admin Workflow

1. **Configure File Definitions**
   - Admin goes to Settings → File Definitions
   - Creates file definitions for required documents
   - Sets allowed extensions, max size, required flag
   - Activates file definitions

2. **Review Provider Applications**
   - Admin reviews provider requests
   - Views uploaded files
   - Verifies files are legitimate
   - Approves or denies provider request

## Database Schema

```sql
-- File definitions (admin configurable)
CREATE TABLE filedefinition (
    id UUID PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_ar TEXT,
    allowed_extensions JSON NOT NULL,
    max_size_mb INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Uploaded files
CREATE TABLE providerfile (
    id UUID PRIMARY KEY,
    provider_id UUID REFERENCES provider(id),
    file_definition_id UUID REFERENCES filedefinition(id),
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by_id UUID REFERENCES user(id),
    verified_at TIMESTAMP,
    uploaded_at TIMESTAMP DEFAULT NOW()
);
```

## Example File Definitions

```json
[
  {
    "key": "commercial_license",
    "name_en": "Commercial License",
    "name_ar": "الرخصة التجارية",
    "description_en": "Valid commercial license for your company",
    "description_ar": "رخصة تجارية سارية لشركتك",
    "allowed_extensions": ["pdf", "jpg", "png"],
    "max_size_mb": 10,
    "is_required": true,
    "is_active": true,
    "display_order": 1
  },
  {
    "key": "tax_certificate",
    "name_en": "Tax Registration Certificate",
    "name_ar": "شهادة التسجيل الضريبي",
    "description_en": "Tax registration certificate from tax authority",
    "description_ar": "شهادة التسجيل الضريبي من الهيئة الضريبية",
    "allowed_extensions": ["pdf"],
    "max_size_mb": 5,
    "is_required": true,
    "is_active": true,
    "display_order": 2
  }
]
```

## Testing

### Unit Tests Created
- `test_file_definitions.py` - 8 tests for file definition CRUD
- `test_file_uploads.py` - 8 tests for file upload functionality

All 16 tests passing ✅

### Test Coverage
- Create/Read/Update/Delete file definitions
- List with filtering (active only)
- Public endpoint access (no auth)
- Authorization checks (admin only for CRUD)
- File upload with validation
- Extension and size validation
- File replacement
- Admin verification
- Provider requirement checks

## Security Considerations

1. **Public Endpoint** - Only returns active file definitions, no sensitive data
2. **File Upload** - Requires authentication, validates user has provider
3. **File Validation** - Server-side validation of extension and size
4. **Admin Only** - File definition CRUD restricted to superusers
5. **File Verification** - Admin must verify uploaded files before approval

## Future Enhancements

1. **Batch Upload** - Upload all files in single request
2. **Progress Tracking** - Show upload progress for each file
3. **File Preview** - Preview uploaded files in admin panel
4. **Automatic Verification** - AI-based document verification
5. **Expiry Tracking** - Track document expiry dates
6. **Version History** - Keep history of replaced files
