# **Pre-Mobile App Implementation Plan**

## **📱 Mobile App Development Readiness Assessment**

This document outlines what needs to be implemented in the backend before starting mobile app development, and provides a comprehensive plan for building the React Native mobile application.

---

## **✅ What's Already Implemented**

The backend is **surprisingly well-prepared** for mobile app development. Here's what's ready:

### **Core Features (Ready)**
- ✅ User authentication (login, register, refresh tokens)
- ✅ Trip listing and details with packages
- ✅ Trip registration with multi-participant support
- ✅ Field validation system (comprehensive)
- ✅ Package-specific required fields
- ✅ Source-based user isolation (MOBILE_APP source ready)
- ✅ Password change and reset endpoints
- ✅ User profile endpoint (`GET /api/v1/me`)

---

## **❌ Missing Features for Mobile App**

### **🔴 Critical (Must Implement Before Mobile App)**

#### **1. Trip Search & Filtering**
**Status**: ✅ **COMPLETED**  
**Priority**: Critical  
**Completed**: January 2026

**What was implemented**:
- ✅ Comprehensive search and filtering in `crud/trip.py`
- ✅ Filter by search query (name/description)
- ✅ Filter by provider name (related field with join)
- ✅ Filter by date ranges (start_date_from, start_date_to)
- ✅ Filter by price ranges (min_price, max_price with package join)
- ✅ Filter by participant counts (min/max)
- ✅ Filter by minimum rating (related field with subquery)
- ✅ Filter by active status
- ✅ Combined filters support
- ✅ Pagination support (skip/limit)
- ✅ DISTINCT handling for JSON columns
- ✅ Database indexes for performance

**API Endpoints**:
- ✅ Provider endpoint: `GET /api/v1/trips` (with all filters)
- ✅ Public endpoint: `GET /api/v1/trips/all` (for mobile app)
- ✅ Admin endpoint: `GET /api/v1/admin/trips` (with provider_id filter)

**UI Implementation**:
- ✅ Admin panel filters with rating slider
- ✅ Provider panel filters with rating slider
- ✅ All filters working correctly

**Tests**:
- ✅ 31 unit tests passing for all filter combinations

---

#### **2. Trip Reviews/Ratings System**
**Status**: ✅ **COMPLETED**  
**Priority**: Critical  
**Completed**: January 2026

**What was implemented**:
- ✅ Complete review CRUD operations (`crud/review.py`)
- ✅ Review schemas with validation (`schemas/review.py`)
- ✅ Full API endpoints (`api/routes/reviews.py`)
- ✅ User validation: must have confirmed registration
- ✅ Trip validation: trip must have ended before review
- ✅ Duplicate prevention: one review per user per trip
- ✅ Average rating calculation with distribution
- ✅ Review update and delete (owner only)
- ✅ 12 comprehensive unit tests passing

**API Endpoints**:
```python
# Create review
POST /api/v1/reviews/trips/{trip_id}
Input: {rating: int (1-5), comment: str (optional)}
Validation: 
  - User must have confirmed registration
  - Trip must have ended
  - User can only review once per trip

# List reviews for a trip
GET /api/v1/reviews/trips/{trip_id}
Output: List of reviews with user names

# Get average rating
GET /api/v1/reviews/trips/{trip_id}/rating
Output: {average_rating: float, total_reviews: int, rating_distribution: dict}

# Update review (owner only)
PUT /api/v1/reviews/{review_id}
Input: {rating: int, comment: str}

# Delete review (owner only)
DELETE /api/v1/reviews/{review_id}

# Get my reviews
GET /api/v1/reviews/my-reviews
Output: List of current user's reviews
```

**Validation Rules**:
1. ✅ User must have confirmed registration for the trip
2. ✅ Trip must have ended (end_date < today)
3. ✅ User can only submit one review per trip
4. ✅ Rating must be between 1-5
5. ✅ Only review owner can update/delete their review

**Tests**:
- ✅ 12 unit tests covering all scenarios
- ✅ Create review with all validations
- ✅ List and filter reviews
- ✅ Calculate average ratings
- ✅ Update and delete reviews
- ✅ Permission checks

---

#### **3. Provider Profile View (Public)**
**Status**: ✅ **COMPLETED**  
**Priority**: Critical  
**Completed**: January 2026

**What was implemented**:
- ✅ Public provider profile schema (`schemas/provider.py`)
- ✅ CRUD operation with statistics (`crud/provider_profile.py`)
- ✅ Public API endpoint (`api/routes/provider_profiles.py`)
- ✅ Calculates total trips count
- ✅ Calculates active trips count
- ✅ Calculates average rating across all provider's trips
- ✅ Counts total reviews
- ✅ 8 comprehensive unit tests passing

**API Endpoint**:
```python
GET /api/v1/provider-profiles/{provider_id}
# Public endpoint - no authentication required

Response: {
  "id": "uuid",
  "company_name": "Adventure Tours",
  "company_metadata": {
    "logo": "https://...",
    "description": "Best tours in Saudi Arabia",
    "website": "https://..."
  },
  "total_trips": 15,
  "active_trips": 12,
  "average_rating": 4.5,
  "total_reviews": 120
}
```

**Features**:
- ✅ Public access (no authentication required)
- ✅ Includes company metadata (logo, description, etc.)
- ✅ Aggregates statistics from all provider's trips
- ✅ Average rating calculated from all trip reviews
- ✅ Distinguishes between total and active trips

**Tests**:
- ✅ 8 unit tests covering all scenarios
- ✅ Profile with and without trips
- ✅ Profile with reviews and ratings
- ✅ Active vs inactive trip counts
- ✅ Provider not found handling
- ✅ Public access verification
- ✅ Correct review aggregation per provider

---

#### **4. Email Verification**
**Status**: ✅ **COMPLETED**  
**Priority**: High  
**Completed**: January 2026

**What was implemented**:
- ✅ Email verification endpoints (`POST /api/v1/send-verification-email`, `POST /api/v1/verify-email`)
- ✅ Password reset flow with emails (`POST /api/v1/forgot-password`, `POST /api/v1/reset-password`)
- ✅ Team invitation emails (`POST /api/v1/team/invite`, `POST /api/v1/team/accept-invitation`)
- ✅ Trip registration confirmation emails (automatic on booking)
- ✅ Secure token generation using `secrets.token_urlsafe(32)`
- ✅ Redis-based token storage with expiry (24h for email, 1h for password, 7d for invitations)
- ✅ Background task processing for async email sending
- ✅ Team invitation email template with styled HTML
- ✅ User activation flow for team invitations
- ✅ Frontend URL configuration for email links
- ✅ 10 email service unit tests passing

**API Endpoints**:
```python
# Email Verification
POST /api/v1/send-verification-email (authenticated)
POST /api/v1/verify-email?token={token}

# Password Reset
POST /api/v1/forgot-password?email={email}
POST /api/v1/reset-password?token={token}&new_password={password}

# Team Invitations
POST /api/v1/team/invite (super provider only)
POST /api/v1/team/accept-invitation?token={token}

# Trip Registration (automatic email)
POST /api/v1/trips/{trip_id}/register (sends confirmation email)
```

**Email Templates**:
1. **Email Verification** - Styled HTML with verification link (24h expiry)
2. **Password Reset** - Styled HTML with reset link (1h expiry)
3. **Team Invitation** - Styled HTML with invitation details (7d expiry)
4. **Booking Confirmation** - Styled HTML with trip details and booking reference

---

#### **5. Phone OTP Verification**
**Status**: ✅ **COMPLETED**  
**Priority**: High  
**Completed**: January 2026

**What was implemented**:
- ✅ Complete OTP verification flow (`app/api/routes/otp.py`)
- ✅ Phone OTP for authenticated users (`POST /api/v1/otp/send-otp`, `POST /api/v1/otp/verify-otp`)
- ✅ Phone OTP for registration (`POST /api/v1/otp/send-otp-registration`, `POST /api/v1/otp/verify-otp-registration`)
- ✅ Email OTP for registration (`POST /api/v1/otp/send-email-otp-registration`, `POST /api/v1/otp/verify-email-otp-registration`)
- ✅ Mobile app registration flow with exclusive email/phone requirement
- ✅ Verification token system for registration completion
- ✅ Redis-based OTP storage with configurable expiry
- ✅ Configurable rate limiting via environment variables
- ✅ User profile update with re-verification for email/phone changes
- ✅ Notification routing based on verified contact methods
- ✅ Taskiq integration for scheduled SMS/email reminders
- ✅ 12 unit tests passing

**API Endpoints**:
```python
# Authenticated user OTP (for profile updates)
POST /api/v1/otp/send-otp
POST /api/v1/otp/verify-otp

# Registration OTP (no authentication required)
POST /api/v1/otp/send-otp-registration
POST /api/v1/otp/verify-otp-registration
POST /api/v1/otp/send-email-otp-registration
POST /api/v1/otp/verify-email-otp-registration

# User profile update with re-verification
PATCH /api/v1/users/me?phone_verification_token={token}
PATCH /api/v1/users/me?email_verification_token={token}
```

**Features**:
- ✅ 6-digit OTP generation
- ✅ Configurable OTP expiry (default: 5 minutes)
- ✅ Configurable verification token expiry (default: 10 minutes)
- ✅ Configurable rate limiting (default: 3 attempts per hour)
- ✅ E.164 phone format validation
- ✅ Automatic rate limit clearing on successful verification
- ✅ Mobile app users can register with either email OR phone (exclusive)
- ✅ Admin/provider users require both email AND phone
- ✅ Notification routing: SMS, email, or both based on verification status
- ✅ Scheduled reminders via Taskiq (trip reminders, review reminders, payment reminders)

**Configuration**:
All rate limits configurable via environment variables in `.env`:
- `OTP_MAX_ATTEMPTS` - Max OTP requests per time window
- `OTP_TIME_WINDOW_SECONDS` - Rate limit time window
- `OTP_EXPIRY_SECONDS` - OTP code validity period
- `OTP_VERIFICATION_TOKEN_EXPIRY_SECONDS` - Token validity after OTP verification

---

#### **6. Payment Integration (Moyasar)**
**Status**: ✅ **COMPLETED**  
**Priority**: Critical (for revenue)  
**Completed**: January 2026

**What was implemented**:
- ✅ Complete Moyasar payment service replacing Checkout.com
- ✅ Payment model with full tracking (status, method, refunds, fees)
- ✅ Payment audit log system for security and compliance
- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ Support for all payment methods: Mada, Visa, Mastercard, Apple Pay, STC Pay
- ✅ Complete API endpoints with user authorization
- ✅ Database migrations applied
- ✅ 8 comprehensive unit tests passing
- ✅ Full documentation in `PAYMENT_SETUP_INSTRUCTIONS.md`

**API Endpoints implemented**:
```python
# Create payment for trip registration
POST /api/v1/payments/create
Input: {registration_id: UUID, payment_method: str}
Output: {payment_id: str, redirect_url: str, amount: Decimal}

# Payment callback (after payment completion)
GET /api/v1/payments/callback?id={moyasar_payment_id}
# Verifies payment status with Moyasar, updates registration

# Handle webhooks
POST /api/v1/payments/webhook
# Handles payment.paid, payment.failed, payment.refunded events
# Verifies webhook signature with HMAC-SHA256

# Get payment details
GET /api/v1/payments/{payment_id}

# List payments for registration
GET /api/v1/payments/registration/{registration_id}

# Refund payment
POST /api/v1/payments/{payment_id}/refund
Input: {amount?: Decimal, description?: str}
```

**Security & Auditing**:
- ✅ Payment audit log table tracking all payment events
- ✅ User actions logged with IP address and user agent
- ✅ API calls to Moyasar logged with request/response data
- ✅ Webhook verification with signature validation
- ✅ Complete audit trail for compliance and debugging

**Database Tables**:
- ✅ `payments` - Full payment tracking
- ✅ `payment_audit_logs` - Complete audit trail

**Documentation**:
- ✅ `PAYMENT_SETUP_INSTRUCTIONS.md` includes:
  - Setup guide for test and production
  - Local development workflow (callback-based, no webhooks needed)
  - Test cards and complete testing flow
  - Troubleshooting guide
  - Security checklist

**Tests**:
- ✅ 8 unit tests for Moyasar service
- ✅ API route tests for all endpoints
- Webhook signature verification required
- Support for 3D Secure (SCA)
- Test mode available

**Configuration Required**:
- Moyasar API key (publishable and secret)
- Webhook secret key
- Callback URLs for success/failure
- Currency: SAR (Saudi Riyal)

---

#### **7. File Upload & Verification System**
**Status**: ✅ **COMPLETED**  
**Priority**: High  
**Completed**: January 2026

**✅ Infrastructure Completed**:
- ✅ Backblaze B2 storage service (`app/services/storage.py`)
- ✅ File upload with automatic content-type detection
- ✅ File deletion and info retrieval
- ✅ SHA1 hash calculation for integrity
- ✅ Unique file naming with timestamps
- ✅ Backblaze file ID storage for proper deletion
- ✅ Provider file verification system with three-status enum
- ✅ Admin file review workflow with rejection reasons
- ✅ Synchronous file replacement for rejected files
- ✅ File extension validation on replacement
- ✅ Comprehensive unit tests passing

**✅ Provider File Verification System**:
- ✅ Three-status enum: `processing`, `accepted`, `rejected`
- ✅ Database model with `file_verification_status` and `rejection_reason` fields
- ✅ Admin endpoints to accept/reject files with required rejection reason
- ✅ Provider profile page shows file status and rejection reasons
- ✅ Synchronous file replacement endpoint (PUT) for rejected files only
- ✅ File extension validation and display on replacement UI
- ✅ Backblaze file deletion when files are replaced
- ✅ Provider request approval blocked until all files accepted
- ✅ Admin UI with rejection reason modal
- ✅ Provider UI displays rejection reasons in red alert boxes

**API Endpoints**:
```python
# Provider file upload (background task)
POST /api/v1/files/provider-registration/{file_definition_id}
Input: multipart/form-data (file)
Output: {file_id: str, message: str}

# Provider file replacement (synchronous, rejected files only)
PUT /api/v1/files/provider-registration/{file_definition_id}
Input: multipart/form-data (file)
Validation: File must be in 'rejected' status
Output: {file_id: str, file_url: str, message: str}

# Admin file status update
PATCH /api/v1/files/admin/provider-files/{file_id}/status
Input: {file_verification_status: str, rejection_reason?: str}
Validation: rejection_reason required when status is 'rejected'
Output: Updated file object

# Get provider files
GET /api/v1/files/provider/{provider_id}/files
Output: List of files with status and rejection reasons
```

**Database Schema**:
- `file_verification_status` enum: processing, accepted, rejected
- `rejection_reason` VARCHAR(500): Admin's reason for rejection
- `backblaze_file_id` VARCHAR(255): For proper file deletion
- `reviewed_by_id` UUID: Admin who reviewed the file
- `reviewed_at` TIMESTAMP: When file was reviewed

**Business Rules**:
1. ✅ Files default to 'processing' status on upload
2. ✅ Only rejected files can be replaced by providers
3. ✅ Provider requests cannot be approved unless all files are 'accepted'
4. ✅ Rejection reason is required when rejecting files
5. ✅ Old files are deleted from Backblaze when replaced
6. ✅ File extension validation enforced on replacement

**What's still needed for trip images/avatars**:
```python
# Upload trip image
POST /api/v1/trips/{trip_id}/images
Input: multipart/form-data (image file)
Output: {image_url: str, file_id: str}

# Upload user avatar
POST /api/v1/users/avatar
Input: multipart/form-data (image file)
Output: {avatar_url: str, file_id: str}
```

---

### **🟡 Important (Should Implement)**

#### **8. User Profile Management**
**Status**: ✅ **COMPLETED**  
**Priority**: Medium  
**Completed**: January 2026

**✅ Implementation Complete**:
- ✅ Profile update endpoint (PATCH /api/v1/users/me)
- ✅ Avatar upload endpoint (POST /api/v1/users/me/avatar)
- ✅ Email/phone verification requirement for changes
- ✅ Password change functionality
- ✅ Avatar storage in Backblaze with automatic old avatar deletion
- ✅ Profile UI in admin panel
- ✅ Profile UI in provider panel
- ✅ Comprehensive unit tests (12 tests passing)

**API Endpoints**:
```python
# Get current user profile
GET /api/v1/users/me
Output: User object with avatar_url

# Update profile
PATCH /api/v1/users/me
Input: {name?: str, password?: str}
Note: Email/phone changes require verification tokens
Output: Updated user object

# Upload avatar
POST /api/v1/users/me/avatar
Input: multipart/form-data (image file)
Validation: Max 5MB, allowed types: jpg, jpeg, png, gif, webp
Output: Updated user object with new avatar_url
```

**Database Schema**:
- `avatar_url` VARCHAR(500): URL to user's profile picture in Backblaze

**Features**:
- ✅ Profile picture upload with validation (file type, size)
- ✅ Automatic deletion of old avatar when uploading new one
- ✅ Name update without verification
- ✅ Password change with confirmation
- ✅ Email/phone change protection (requires verification)
- ✅ Works for all user sources (mobile_app, admin_panel, providers_panel)
- ✅ Profile tab in both admin and provider panels

**UI Components**:
- Admin Panel: `/profile` page with avatar upload, profile editing, password change
- Provider Panel: 
  - `/user-profile` page for personal user settings (avatar, name, password)
  - `/profile/edit` page for company profile (unchanged - manages company data)
  - Navigation has both "Company Profile" and "User Profile" links

---

#### **9. User Registration History**
**Status**: ✅ Implemented  
**Priority**: Medium  
**Estimated Time**: 1 day

**Implemented**:
```python
GET /api/v1/users/me/registrations

# Query params:
# - skip: int = 0
# - limit: int = 100

# Returns:
# - Current user's trip registrations
# - Includes participant information
# - Includes trip details + provider company_name
# - Ordered by registration_date DESC (newest first)
```

**Notes**:
- Status filtering is not implemented yet (can be added later if needed).

**Unit Tests**:
- Added: `backend/app/tests/api/routes/test_registration_history.py`
- Covers: empty history, ordering (newest first), user isolation, pagination

---

#### **10. Trip Cancellation**
**Status**: ❌ Not implemented  
**Priority**: Medium  
**Estimated Time**: 2-3 days

**What's needed**:
```python
@router.post("/registrations/{registration_id}/cancel")
def cancel_registration(
    registration_id: UUID,
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session)
):
    # Validate registration belongs to user
    # Check if >2 days before trip start
    # Process refund if eligible
    # Update registration status to cancelled
    # Notify provider
```

**Business Logic**:
- No cancellation within 2 days of trip start
- Full refund if cancelled earlier
- Update registration status
- Trigger refund via payment gateway
- Send confirmation email

---

#### **11. Push Notifications**
**Status**: ❌ Not implemented  
**Priority**: Medium  
**Estimated Time**: 3-4 days

**What's needed**:
- Store device tokens
- Send notifications for:
  - Registration confirmation
  - Payment success
  - Trip reminders (1 day before)
  - Trip updates from provider
  - Review reminders (after trip)

**Implementation**:
- Integrate Firebase Cloud Messaging (FCM)
- Store device tokens per user
- Create notification service
- Schedule trip reminders
- Handle notification preferences

---

#### **12. Favorites/Likes/Bookmarks**
**Status**: ✅ **COMPLETED**  
**Priority**: Low  
**Completed**: January 2026

**What was implemented**:
Three separate systems for different user intentions:

1. **Favorites** - General favorites system
2. **Likes** - Indicate a trip was good (social signal)
3. **Bookmarks** - Save for later viewing (personal organization)

**API Endpoints**:
```python
# FAVORITES
POST /api/v1/trips/{trip_id}/favorite
DELETE /api/v1/trips/{trip_id}/favorite
GET /api/v1/favorites

# LIKES
POST /api/v1/trips/{trip_id}/like
DELETE /api/v1/trips/{trip_id}/like
GET /api/v1/likes

# BOOKMARKS
POST /api/v1/trips/{trip_id}/bookmark
DELETE /api/v1/trips/{trip_id}/bookmark
GET /api/v1/bookmarks
```

**Features**:
- ✅ Separate database tables: `trip_favorites`, `trip_likes`, `trip_bookmarks`
- ✅ UUID primary keys following project conventions
- ✅ Unique constraints to prevent duplicates
- ✅ Cascade delete when trips are deleted
- ✅ Ordered by most recently added (desc)
- ✅ Pagination support (skip/limit)
- ✅ User isolation (users only see their own)
- ✅ Users can like AND bookmark the same trip
- ✅ Independent systems - likes don't affect bookmarks

**Tests**:
- ✅ 26 comprehensive unit tests passing
- ✅ Covers all CRUD operations
- ✅ Tests independence of likes and bookmarks
- ✅ Tests user isolation
- ✅ Tests authentication requirements
- ✅ Tests duplicate prevention
- ✅ Tests pagination

---

#### **13. Additional Trip Fields (Amenities, Refundability, Extra Fees)**
**Status**: ✅ **COMPLETED**  
**Priority**: High  
**Completed**: January 2026

**What was implemented**:
- ✅ TripAmenity enum with 8 amenity types (stored as JSON array)
- ✅ Trip refundability flag
- ✅ Meeting place information (location and time)
- ✅ TripExtraFee model with bilingual support
- ✅ Complete CRUD operations for extra fees
- ✅ API endpoints for extra fees management
- ✅ Database migration applied
- ✅ Updated Trip schemas with new fields:

**A. Extra Fees System**:
- Trips may have additional costs not included in package price
- Examples: Resort entry fees, pool access, equipment rental
- Provider can add multiple extra fees per trip
- Each fee has: name, description, amount (SAR)

**B. Refundability**:
- Boolean flag indicating if trip allows refunds
- If `is_refundable = false`: User cannot request refund after payment
- If `is_refundable = true`: User can request refund (refund logic implemented separately)

**C. Trip Amenities**:
- Multi-select list of what's included in trip cost
- Examples: Flight tickets, bus transportation, tour guide, tours, hotel accommodation, meals, travel insurance, visa assistance
- Displayed as checkboxes in provider panel
- Shown as badges/icons in mobile app

**D. Meeting Place**:
- Optional meeting location for trip departure
- If enabled: location address and meeting time required
- Users need to know where and when to meet for trip

**Database Models**:
```python
# Extra Fees (separate table)
class TripExtraFee(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    name_en: str = Field(max_length=100)
    name_ar: str = Field(max_length=100)
    description_en: Optional[str] = Field(max_length=500)
    description_ar: Optional[str] = Field(max_length=500)
    amount: Decimal = Field(max_digits=10, decimal_places=2)
    currency: str = Field(default="SAR", max_length=3)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    trip: "Trip" = Relationship(back_populates="extra_fees")

# Trip model additions
class Trip(SQLModel, table=True):
    # ... existing fields ...
    
    # Refundability
    is_refundable: bool = Field(default=True)
    
    # Amenities (JSON array)
    amenities: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    # Values: ["flight_tickets", "bus", "tour_guide", "tours", "hotel", 
    #          "meals", "insurance", "visa_assistance"]
    
    # Meeting Place
    has_meeting_place: bool = Field(default=False)
    meeting_location: Optional[str] = Field(default=None, max_length=500)
    meeting_time: Optional[datetime] = Field(default=None)
    
    # Relationships
    extra_fees: List["TripExtraFee"] = Relationship(
        back_populates="trip", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
```

**API Endpoints**:
```python
# Extra Fees Management
POST /api/v1/trips/{trip_id}/extra-fees
GET /api/v1/trips/{trip_id}/extra-fees
PUT /api/v1/trips/{trip_id}/extra-fees/{fee_id}
DELETE /api/v1/trips/{trip_id}/extra-fees/{fee_id}

# Trip Update (include new fields)
PATCH /api/v1/trips/{trip_id}
Input: {
    is_refundable?: bool,
    amenities?: List[str],
    has_meeting_place?: bool,
    meeting_location?: str,
    meeting_time?: datetime
}
```

**Amenities Enum**:
```python
class TripAmenity(str, Enum):
    FLIGHT_TICKETS = "flight_tickets"
    BUS = "bus"
    TOUR_GUIDE = "tour_guide"
    TOURS = "tours"
    HOTEL = "hotel"
    MEALS = "meals"
    INSURANCE = "insurance"
    VISA_ASSISTANCE = "visa_assistance"
```

**Frontend UI**:
- Provider Panel: Checkboxes for amenities, toggle for refundability, form for extra fees
- Mobile App: Display amenities as icons/badges, show extra fees in trip details, show meeting place info

**Migration**:
- Add new columns to `trip` table
- Create `trip_extra_fees` table
- Update trip schemas to include new fields

---

#### **14. Provider Rating System**
**Status**: ✅ **COMPLETED**  
**Priority**: High  
**Completed**: February 2026

**What's needed**:
Allow users to rate and review providers (companies) in addition to trips. This helps users make informed decisions about which providers to book with.

**Current State**:
- ✅ Trip ratings exist (`TripRating` model in `links.py`)
- ❌ Provider ratings don't exist yet

**Database Models**:
```python
# New model to add
class ProviderRating(SQLModel, table=True):
    """User ratings and reviews for providers"""
    __tablename__ = "provider_ratings"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    provider_id: uuid.UUID = Field(foreign_key="provider.id", index=True)
    
    # Rating (1-5 stars)
    rating: int = Field(ge=1, le=5)
    
    # Optional review text
    comment: Optional[str] = Field(default=None, max_length=1000)
    
    # Optional review images
    images: Optional[List[str]] = Field(default=None, sa_column=Column(MutableList.as_mutable(JSON)))
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    user: "User" = Relationship(back_populates="provider_ratings")
    provider: "Provider" = Relationship(back_populates="ratings")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("user_id", "provider_id", name="unique_user_provider_rating"),
    )

# Update Provider model
class Provider(SQLModel, table=True):
    # ... existing fields ...
    
    # Add relationship
    ratings: List["ProviderRating"] = Relationship(
        back_populates="provider",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

# Update User model
class User(SQLModel, table=True):
    # ... existing fields ...
    
    # Add relationship
    provider_ratings: List["ProviderRating"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
```

**API Endpoints**:
```python
# Create provider rating
POST /api/v1/providers/{provider_id}/ratings
Input: {rating: int (1-5), comment: str (optional), images: List[str] (optional)}
Validation:
  - User must be authenticated
  - User must have completed at least one trip with this provider
  - User can only rate provider once (can update existing rating)

# List ratings for a provider
GET /api/v1/providers/{provider_id}/ratings
Query params: skip, limit (pagination)
Output: List of ratings with user names (paginated)

# Get provider average rating
GET /api/v1/providers/{provider_id}/rating
Output: {
    average_rating: float,
    total_ratings: int,
    rating_distribution: {
        "5": int,
        "4": int,
        "3": int,
        "2": int,
        "1": int
    }
}

# Update own rating (user only)
PUT /api/v1/providers/ratings/{rating_id}
Input: {rating: int, comment: str, images: List[str]}

# Delete own rating (user only)
DELETE /api/v1/providers/ratings/{rating_id}

# Get user's rating for a provider
GET /api/v1/providers/{provider_id}/ratings/me
Output: User's rating if exists, 404 if not
```

**Business Rules**:
1. User must have completed at least one trip with provider to rate them
2. One rating per user per provider (can update/delete their own)
3. Rating must be 1-5 stars
4. Comment is optional but recommended
5. Images are optional (up to 5 images)
6. Provider cannot rate themselves
7. Admin can delete any rating (moderation)

**CRUD Operations** (`crud/provider_rating.py`):
```python
def create_provider_rating(session, user_id, provider_id, rating_in)
def get_provider_rating(session, rating_id)
def get_provider_ratings(session, provider_id, skip, limit)
def get_user_provider_rating(session, user_id, provider_id)
def update_provider_rating(session, db_rating, rating_in)
def delete_provider_rating(session, db_rating)
def get_provider_average_rating(session, provider_id)
def has_user_completed_trip_with_provider(session, user_id, provider_id)
```

**Validation Logic**:
- Check if user has completed trip with provider before allowing rating
- Prevent duplicate ratings (enforce unique constraint)
- Validate rating is between 1-5
- Validate comment length if provided

**Frontend Integration**:
- **Mobile App**: 
  - Show provider rating on trip cards
  - Provider detail page with rating breakdown
  - Rate provider after trip completion
  - View all provider reviews
  
- **Provider Panel**:
  - View own ratings and reviews
  - Respond to reviews (future feature)
  - Rating analytics dashboard
  
- **Admin Panel**:
  - View all provider ratings
  - Moderate/delete inappropriate reviews
  - Rating statistics per provider

**Migration**:
- Create `provider_ratings` table
- Add relationships to `Provider` and `User` models
- Add indexes on `user_id`, `provider_id`, and `created_at`

**Testing**:
- Unit tests for CRUD operations
- API endpoint tests
- Validation tests (trip completion check)
- Duplicate rating prevention test
- Average rating calculation test

---

#### **15. Full Localization (Arabic/English)**
**Status**: ✅ **COMPLETED**  
**Priority**: Critical  
**Completed**: February 2026

**What was implemented**:
Complete bilingual support for Arabic and English across backend and frontend, including database, API, and UI.

**✅ Backend Implementation**:

**Database Migration**:
- ✅ Migration: `e9fa94929987_update_bilingual_fields_trip_package_provider`
- ✅ Applied successfully with data migration
- ✅ Existing data copied to both `_en` and `_ar` fields

**Models Updated**:
```python
# Trip Model
class Trip(SQLModel, table=True):
    name_en: str = Field(max_length=200)
    name_ar: str = Field(max_length=200)
    description_en: str
    description_ar: str
    # ... other fields ...

# TripPackage Model
class TripPackage(SQLModel, table=True):
    name_en: str = Field(max_length=150)
    name_ar: str = Field(max_length=150)
    description_en: str
    description_ar: str
    # ... other fields ...

# Provider Model
class Provider(SQLModel, table=True):
    bio_en: Optional[str]
    bio_ar: Optional[str]
    # ... other fields ...

# TripExtraFee Model (already bilingual)
class TripExtraFee(SQLModel, table=True):
    name_en: str
    name_ar: str
    description_en: Optional[str]
    description_ar: Optional[str]
    # ... other fields ...
```

**✅ Backend Infrastructure**:

**Language Utilities** (`app/core/language.py`):
- ✅ `get_localized_field()` - Returns appropriate field based on language
- ✅ `localize_dict()` - Localizes entire dictionaries
- ✅ `get_language_from_header()` - Parses Accept-Language header

**API Dependencies** (`app/api/deps.py`):
- ✅ `get_language()` - Extracts language from query param or header
- ✅ Supports both `?lang=ar` and `Accept-Language: ar-SA` header

**API Localization** (`app/api/localization.py`):
- ✅ Helper functions to localize trip and package responses
- ✅ Can return localized or bilingual responses

**Schemas Updated**:
- ✅ `app/schemas/trip.py` - Bilingual fields
- ✅ `app/schemas/trip_package.py` - Bilingual fields
- ✅ `app/schemas/provider.py` - Bilingual bio fields

**API Routes Updated**:
- ✅ `app/api/routes/trips.py` - All endpoints return bilingual data
- ✅ `app/api/routes/admin.py` - All endpoints return bilingual data
- ✅ `app/api/routes/public_trips.py` - Public endpoints return bilingual data

**✅ Frontend Implementation**:

**Admin Panel**:
- ✅ Installed: `react-i18next`, `i18next`, `i18next-browser-languagedetector`
- ✅ Configuration: `admin-panel/src/i18n.ts`
- ✅ Language switcher: `admin-panel/src/components/LanguageSwitcher.tsx`
- ✅ Layout integration: Navigation items translated
- ✅ RTL support: Automatic direction switching
- ✅ Persistence: localStorage (`i18nextLng`)

**Provider Panel**:
- ✅ Installed: `react-i18next`, `i18next`, `i18next-browser-languagedetector`
- ✅ Configuration: `providers-panel/src/i18n.ts` with 60+ translation keys
- ✅ Language switcher: `providers-panel/src/components/LanguageSwitcher.tsx`
- ✅ Layout integration: All navigation items translated
- ✅ Forms: TripForm fully localized with all labels, buttons, messages
- ✅ Detail pages: TripDetailPage fully localized
- ✅ RTL support: Arabic inputs with `dir="rtl"`
- ✅ Persistence: localStorage (`i18nextLng`)

**Translation Coverage**:
- ✅ Navigation: Dashboard, Trips, Profile, Settings, Logout
- ✅ Trip forms: All labels, placeholders, buttons
- ✅ Package forms: All fields and actions
- ✅ Status messages: Active, Inactive, Loading, Error
- ✅ Actions: Create, Update, Edit, Remove, Back
- ✅ Validation messages: Required fields, errors

**API Response Strategy**:
✅ **Implemented**: Return both languages (Option 1)
```python
{
    "name_en": "Desert Safari Adventure",
    "name_ar": "مغامرة سفاري الصحراء",
    "description_en": "...",
    "description_ar": "..."
}
```

**RTL Support**:
- ✅ CSS: `direction: rtl` applied automatically for Arabic
- ✅ React: `useTranslation` hook with language detection
- ✅ Document direction: `document.dir` set based on language
- ✅ Arabic inputs: `dir="rtl"` attribute on Arabic fields

**Documentation**:
- ✅ `LOCALIZATION_COMPLETE.md` - Complete implementation guide
- ✅ `LOCALIZATION_UI_COMPLETE.md` - Comprehensive UI localization details
- ✅ `LOCALIZATION_IMPLEMENTATION.md` - Technical implementation summary

**Tests**:
- ✅ Backend: All API routes updated and working
- ✅ Frontend: Both panels build successfully
- ✅ Language switching: Works in both admin and provider panels
- ✅ RTL: Properly applied for Arabic

**What's Ready for Mobile App**:
- ✅ All backend APIs return bilingual data
- ✅ Mobile app can use same i18n approach (react-i18next)
- ✅ Translation keys can be reused from provider panel
- ✅ RTL support pattern established

---

#### **16. Destinations System**
**Status**: ❌ Not implemented  
**Priority**: Critical  
**Estimated Time**: 4-5 days

**What's needed**:
Hierarchical destination system with countries, cities, and places.

**Database Models**:
```python
class DestinationType(str, Enum):
    COUNTRY = "country"
    CITY = "city"

class Destination(SQLModel, table=True):
    __tablename__ = "destinations"
    __table_args__ = (
        UniqueConstraint("parent_id", "slug", name="unique_parent_slug"),
        UniqueConstraint("full_slug", name="unique_full_slug"),
    )
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    type: DestinationType = Field(sa_column=Column(SQLEnum(DestinationType)))
    parent_id: Optional[uuid.UUID] = Field(default=None, foreign_key="destinations.id")
    
    country_code: str = Field(max_length=2)  # ISO-3166 (SA, TR, AE, etc.)
    slug: str = Field(max_length=100)  # riyadh, istanbul, dubai
    full_slug: str = Field(max_length=200)  # saudi-arabia/riyadh
    
    name_en: str = Field(max_length=120)
    name_ar: str = Field(max_length=120)
    
    timezone: str = Field(max_length=50)  # Asia/Riyadh, Europe/Istanbul
    currency_code: str = Field(max_length=3)  # SAR, TRY, AED
    
    google_place_id: Optional[str] = Field(default=None, max_length=120)
    is_active: bool = Field(default=False)  # Inactive by default, admin activates
    
    display_order: int = Field(default=0)  # For sorting
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    parent: Optional["Destination"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Destination.id"}
    )
    children: List["Destination"] = Relationship(back_populates="parent")
    places: List["Place"] = Relationship(back_populates="destination")
    trip_destinations: List["TripDestination"] = Relationship(back_populates="destination")


class PlaceType(str, Enum):
    AREA = "area"
    DISTRICT = "district"
    ATTRACTION = "attraction"
    RESORT = "resort"
    THEME_PARK = "theme_park"
    LANDMARK = "landmark"
    EXPERIENCE = "experience"

class Place(SQLModel, table=True):
    __tablename__ = "places"
    __table_args__ = (
        UniqueConstraint("destination_id", "slug", name="unique_destination_place_slug"),
    )
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    destination_id: uuid.UUID = Field(foreign_key="destinations.id")
    
    type: PlaceType = Field(sa_column=Column(SQLEnum(PlaceType)))
    slug: str = Field(max_length=120)
    
    name_en: str = Field(max_length=150)
    name_ar: str = Field(max_length=150)
    
    latitude: Optional[Decimal] = Field(default=None, max_digits=9, decimal_places=6)
    longitude: Optional[Decimal] = Field(default=None, max_digits=9, decimal_places=6)
    
    google_place_id: Optional[str] = Field(default=None, max_length=120)
    is_active: bool = Field(default=True)
    
    display_order: int = Field(default=0)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    destination: "Destination" = Relationship(back_populates="places")


class TripDestination(SQLModel, table=True):
    """Many-to-many relationship between trips and destinations"""
    __tablename__ = "trip_destinations"
    __table_args__ = (
        UniqueConstraint("trip_id", "destination_id", name="unique_trip_destination"),
    )
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    destination_id: uuid.UUID = Field(foreign_key="destinations.id")
    
    # Optional: Link to specific place within destination
    place_id: Optional[uuid.UUID] = Field(default=None, foreign_key="places.id")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    trip: "Trip" = Relationship(back_populates="trip_destinations")
    destination: "Destination" = Relationship(back_populates="trip_destinations")
    place: Optional["Place"] = Relationship()
```

**API Endpoints**:
```python
# Admin - Destination Management
POST /api/v1/admin/destinations                    # Create country or city
GET /api/v1/admin/destinations                     # List all (with hierarchy)
GET /api/v1/admin/destinations/{id}                # Get single destination
PATCH /api/v1/admin/destinations/{id}              # Update destination
DELETE /api/v1/admin/destinations/{id}             # Delete destination
PATCH /api/v1/admin/destinations/{id}/activate     # Activate destination

# Admin - Place Management
POST /api/v1/admin/destinations/{dest_id}/places   # Create place
GET /api/v1/admin/destinations/{dest_id}/places    # List places for destination
PATCH /api/v1/admin/places/{id}                    # Update place
DELETE /api/v1/admin/places/{id}                   # Delete place

# Public - Get Active Destinations (for trip creation)
GET /api/v1/destinations                           # Get active destinations tree
GET /api/v1/destinations/{id}/places               # Get places for destination

# Provider - Trip Destinations
POST /api/v1/trips/{trip_id}/destinations          # Add destination to trip
DELETE /api/v1/trips/{trip_id}/destinations/{id}   # Remove destination from trip
GET /api/v1/trips/{trip_id}/destinations           # List trip destinations
```

**Validation Rules**:
1. Provider must add at least 1 destination per trip
2. Must include full hierarchy: country + city (minimum)
3. Place is optional
4. Cannot add duplicate destinations to same trip
5. Can add multiple destinations (multi-destination trips)

**Seed Script**:
```python
# Script: backend/scripts/seed_destinations.py

"""
Seed worldwide destinations (countries and major cities)
Data sources:
- REST Countries API: https://restcountries.com/v3.1/all
- GeoNames: http://download.geonames.org/export/dump/

Process:
1. Fetch all countries with ISO codes, timezones, currencies
2. For each country, fetch major cities (population > 100k)
3. Insert into database with is_active=False
4. Admin can activate destinations as needed

Estimated data:
- ~200 countries
- ~10,000+ major cities
"""

import requests
from app.models import Destination, DestinationType
from app.core.db import get_session

def seed_destinations():
    # Fetch countries
    countries_response = requests.get("https://restcountries.com/v3.1/all")
    countries = countries_response.json()
    
    for country in countries:
        # Create country destination
        country_dest = Destination(
            type=DestinationType.COUNTRY,
            country_code=country["cca2"],  # ISO code
            slug=slugify(country["name"]["common"]),
            full_slug=slugify(country["name"]["common"]),
            name_en=country["name"]["common"],
            name_ar=country["translations"].get("ara", {}).get("common", ""),
            timezone=country["timezones"][0],
            currency_code=list(country["currencies"].keys())[0],
            is_active=False
        )
        session.add(country_dest)
        session.flush()
        
        # Fetch and add major cities for this country
        # (Implementation details for city data fetching)
    
    session.commit()
```

**Provider UI for Adding Destinations**:
```
┌─────────────────────────────────────────┐
│ Select Destinations *                   │
│ ┌─────────────────────────────────────┐ │
│ │ Search destination...            🔍 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Selected Destinations:                  │
│ ┌─────────────────────────────────────┐ │
│ │ 🇸🇦 Saudi Arabia → Riyadh        ✕ │ │
│ │    └ 📍 Diriyah (optional)          │ │
│ │                                     │ │
│ │ 🇹🇷 Turkey → Istanbul             ✕ │ │
│ │    └ 📍 Sultanahmet (optional)      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Available Destinations:                 │
│ ┌─────────────────────────────────────┐ │
│ │ 🇸🇦 Saudi Arabia                    │ │
│ │   └ Riyadh                          │ │
│ │      └ Diriyah                      │ │
│ │      └ Six Flags Qiddiya            │ │
│ │   └ Jeddah                          │ │
│ │      └ Historic Jeddah              │ │
│ │ 🇹🇷 Turkey                          │ │
│ │   └ Istanbul                        │ │
│ │      └ Sultanahmet                  │ │
│ │      └ Taksim                       │ │
│ │ 🇦🇪 UAE                             │ │
│ │   └ Dubai                           │ │
│ │      └ Burj Khalifa                 │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Admin Panel CRUD**:
- List view with hierarchy (tree structure)
- Add country form (name_en, name_ar, country_code, timezone, currency)
- Add city form (select parent country, name_en, name_ar)
- Add place form (select destination, type, name_en, name_ar, coordinates)
- Activate/deactivate toggle
- Bulk activate countries/cities
- Search and filter

**Indexes**:
```sql
CREATE INDEX idx_destinations_country_code ON destinations(country_code);
CREATE INDEX idx_destinations_type ON destinations(type);
CREATE INDEX idx_destinations_is_active ON destinations(is_active);
CREATE INDEX idx_places_destination_id ON places(destination_id);
CREATE INDEX idx_places_type ON places(type);
CREATE INDEX idx_trip_destinations_trip_id ON trip_destinations(trip_id);
```

---

### **⚪ Nice to Have**

#### **16. Trip Sharing with Social Preview**
**Status**: ❌ Not implemented  
**Priority**: High  
**Estimated Time**: 2-3 days

**What's needed**:
- Generate shareable trip links with unique tokens
- Public trip view endpoint (no authentication required)
- Open Graph meta tags for social media image previews
- WhatsApp/social apps show first trip image as preview
- Track share analytics (views, conversions)

**API Endpoints**:
```python
GET /api/v1/trips/{trip_id}/share        # Generate share link
GET /api/v1/public/trips/{share_token}   # Public trip view
```

**Database**:
- `TripShare` model: share_token, trip_id, view_count, created_at

---

#### **17. Discounts System**
**Status**: ❌ Not implemented  
**Priority**: High  
**Estimated Time**: 3-4 days

**What's needed**:
Two discount types:

**A. Promo Code Discounts**:
- Provider creates codes (e.g., "WELCOME" for 15% off)
- User enters code during registration
- Validates code and applies discount
- Track usage limits and expiration

**B. Group Size Discounts**:
- Automatic discount when registering X+ participants
- Provider sets: "5+ people = 10% off"
- Applied automatically at checkout

**API Endpoints**:
```python
POST /api/v1/trips/{trip_id}/discounts              # Create discount
GET /api/v1/trips/{trip_id}/discounts               # List discounts
POST /api/v1/trips/{trip_id}/validate-discount      # Validate promo code
POST /api/v1/registrations/calculate-price          # Calculate with discounts
```

**Database**:
- `TripDiscount` model: discount_type, code, percentage, min_participants, valid_from, valid_until, max_uses

---

#### **18. User Wallet/Balance System**
**Status**: ❌ Not implemented  
**Priority**: Medium  
**Estimated Time**: 3-4 days

**What's needed**:
- User wallet with balance in SAR
- Payment options: Card only, Wallet only, or Split payment
- Transaction history tracking
- Admin can manually adjust balance
- Future: Referral rewards, promotional credits

**API Endpoints**:
```python
GET /api/v1/wallet                              # Get balance
GET /api/v1/wallet/transactions                 # Transaction history
POST /api/v1/wallet/deposit                     # Add funds
POST /api/v1/registrations (modified)           # Support wallet payment
POST /api/v1/admin/wallet/{user_id}/adjust      # Admin adjustment
```

**Database**:
- `UserWallet` model: user_id, balance, currency
- `WalletTransaction` model: wallet_id, type, amount, description, reference_id

---

#### **19. Customer Support Ticketing System**
**Status**: ❌ Not implemented  
**Priority**: High  
**Estimated Time**: 4-5 days

**What's needed**:
Two separate ticketing systems:

**A. User → Admin Support**:
- Users report issues to admin
- Admin views/manages tickets in admin panel
- Categories: Technical, Billing, General
- Priority levels: Low, Medium, High, Urgent

**B. User → Provider Support (Trip-Specific)**:
- Users raise tickets for specific trip registrations
- Provider handles tickets in provider panel
- Only available after user registers for trip

**API Endpoints**:
```python
# User → Admin
POST /api/v1/support/tickets                    # Create admin ticket
GET /api/v1/support/tickets                     # List my tickets
POST /api/v1/support/tickets/{id}/messages      # Reply

# User → Provider
POST /api/v1/trips/{trip_id}/support            # Create provider ticket
GET /api/v1/registrations/{reg_id}/support      # List trip tickets

# Admin Panel
GET /api/v1/admin/support/tickets               # View all admin tickets

# Provider Panel
GET /api/v1/provider/support/tickets            # View tickets for my trips
```

**Database**:
- `SupportTicket` model: user_id, subject, description, status, priority, category
- `TripSupportTicket` model: registration_id, user_id, provider_id, trip_id, subject, status
- `TicketMessage` model: ticket_id, sender_id, sender_type, message, attachments

---

#### **20. QR Code Check-In System**
**Status**: ❌ Not implemented  
**Priority**: Medium  
**Estimated Time**: 2-3 days

**What's needed**:
- Optional check-in system (provider can enable per trip)
- Generate unique QR code for each registration participant
- Provider scans QR codes via provider panel
- Manual check-in option (without QR scan)
- Real-time check-in statistics

**API Endpoints**:
```python
POST /api/v1/trips/{trip_id}/enable-checkin              # Enable check-in
GET /api/v1/registrations/{reg_id}/qr-codes              # Get QR codes
POST /api/v1/provider/checkin/scan                       # Scan QR code
POST /api/v1/provider/checkin/manual/{participant_id}    # Manual check-in
GET /api/v1/provider/trips/{trip_id}/checkin-status      # View all check-ins
```

**Database**:
- `Trip` model: add `enable_checkin` boolean field
- `TripRegistrationParticipant` model: add `qr_code_token`, `checked_in`, `checked_in_at`, `checked_in_by`, `check_in_method`

**QR Code**:
- Contains: `{registration_id}:{participant_id}:{unique_token}`
- Generated using Python `qrcode` library

---

#### **21. Trip Updates/Notifications**
**Status**: ❌ Not implemented  
**Priority**: High  
**Estimated Time**: 2-3 days

**What's needed**:
- Provider sends updates to registered users
- Text message with optional file attachments (PDFs, images)
- Send to all registered users OR specific user
- Examples: "Flight tickets ready", "Itinerary updated", "Important notice"
- Read receipts tracking

**API Endpoints**:
```python
# Provider sends updates
POST /api/v1/provider/trips/{trip_id}/updates           # Send to all users
POST /api/v1/provider/registrations/{reg_id}/updates    # Send to specific user

# User views updates
GET /api/v1/trips/{trip_id}/updates                     # Get my trip updates
POST /api/v1/updates/{id}/mark-read                     # Mark as read
```

**Database**:
- `TripUpdate` model: trip_id, provider_id, registration_id (nullable), title, message, attachments, is_important
- `TripUpdateReceipt` model: update_id, user_id, read_at

**Features**:
- File upload support for PDFs/images
- Push notifications integration (when implemented)
- Important flag for urgent updates

---

#### **22. In-App Chat** (Future)
**Status**: ❌ Not implemented  
**Priority**: Low  
**Estimated Time**: 5-7 days

- Real-time messaging between users and providers
- Customer support chat
- WebSocket integration required

---

#### **23. Offline Support** (Future)
**Status**: ❌ Not implemented  
**Priority**: Low  
**Estimated Time**: 3-4 days

- Cache trip data for offline viewing
- Queue actions when offline
- Sync when connection restored

---

## **📱 React Native Mobile App - Implementation Plan**

### **Can I Build It? ✅ Absolutely Yes!**

I can implement a full-featured, production-quality React Native mobile app with excellent UX, proper architecture, and all the features tourists need.

---

## **🛠️ Recommended Tech Stack**

### **Core Framework**
```json
{
  "framework": "React Native (Expo)",
  "version": "SDK 50+",
  "language": "TypeScript",
  "reason": "Faster development, easier deployment, OTA updates"
}
```

### **Navigation**
```json
{
  "library": "React Navigation v6",
  "features": [
    "Stack navigation",
    "Tab navigation",
    "Deep linking",
    "Authentication flow"
  ]
}
```

### **State Management**
```json
{
  "data_fetching": "React Query (TanStack Query)",
  "global_state": "Zustand",
  "reason": "React Query handles server state, Zustand for UI state"
}
```

### **UI Components**
```json
{
  "library": "React Native Paper",
  "alternatives": ["NativeBase", "React Native Elements"],
  "icons": "React Native Vector Icons",
  "animations": "React Native Reanimated"
}
```

### **Forms & Validation**
```json
{
  "forms": "React Hook Form",
  "validation": "Zod",
  "reason": "Type-safe validation matching backend schemas"
}
```

### **API & Networking**
```json
{
  "http_client": "Axios",
  "features": [
    "Request/response interceptors",
    "Automatic token refresh",
    "Error handling",
    "Request cancellation"
  ]
}
```

### **Storage**
```json
{
  "secure_storage": "Expo SecureStore (for tokens)",
  "general_storage": "MMKV (fast key-value storage)",
  "cache": "React Query cache"
}
```

### **Maps & Location**
```json
{
  "maps": "React Native Maps",
  "location": "Expo Location",
  "geocoding": "Google Maps Geocoding API"
}
```

### **Payments**
```json
{
  "gateway": "Moyasar SDK",
  "payment_methods": ["Mada", "Visa", "Mastercard", "Apple Pay", "STC Pay"],
  "integration": "Moyasar React Native SDK or WebView",
  "currency": "SAR"
}
```

### **Push Notifications**
```json
{
  "service": "Expo Notifications",
  "backend": "Firebase Cloud Messaging",
  "features": ["Local notifications", "Remote notifications", "Scheduled notifications"]
}
```

### **Images & Media**
```json
{
  "image_loading": "React Native Fast Image",
  "image_picker": "Expo Image Picker",
  "camera": "Expo Camera"
}
```

### **Testing**
```json
{
  "unit_tests": "Jest",
  "component_tests": "React Native Testing Library",
  "e2e_tests": "Detox",
  "type_checking": "TypeScript strict mode"
}
```

---

## **🏗️ Mobile App Architecture**

### **Project Structure**
```
mobile-app/
├── src/
│   ├── api/                    # API client & services
│   │   ├── client.ts          # Axios instance with interceptors
│   │   ├── auth.service.ts    # Authentication APIs
│   │   ├── trips.service.ts   # Trip APIs
│   │   ├── users.service.ts   # User APIs
│   │   └── types.ts           # API types
│   │
│   ├── components/             # Reusable components
│   │   ├── common/            # Buttons, inputs, cards
│   │   ├── trips/             # Trip-specific components
│   │   ├── forms/             # Form components
│   │   └── layout/            # Layout components
│   │
│   ├── screens/                # App screens
│   │   ├── auth/              # Login, register, verify
│   │   ├── trips/             # Browse, details, booking
│   │   ├── profile/           # User profile, settings
│   │   ├── bookings/          # Registration history
│   │   └── providers/         # Provider profiles
│   │
│   ├── navigation/             # Navigation config
│   │   ├── AppNavigator.tsx   # Root navigator
│   │   ├── AuthNavigator.tsx  # Auth flow
│   │   └── MainNavigator.tsx  # Main app flow
│   │
│   ├── hooks/                  # Custom hooks
│   │   ├── useAuth.ts         # Authentication hook
│   │   ├── useTrips.ts        # Trips data hook
│   │   ├── useBooking.ts      # Booking flow hook
│   │   └── useNotifications.ts
│   │
│   ├── store/                  # Global state (Zustand)
│   │   ├── authStore.ts       # Auth state
│   │   ├── uiStore.ts         # UI state (theme, language)
│   │   └── bookingStore.ts    # Booking flow state
│   │
│   ├── utils/                  # Helpers
│   │   ├── validation.ts      # Field validation helpers
│   │   ├── formatting.ts      # Date, currency formatting
│   │   ├── storage.ts         # Storage helpers
│   │   └── constants.ts       # App constants
│   │
│   ├── types/                  # TypeScript types
│   │   ├── models.ts          # Data models
│   │   ├── navigation.ts      # Navigation types
│   │   └── api.ts             # API types
│   │
│   └── theme/                  # Design system
│       ├── colors.ts          # Color palette
│       ├── typography.ts      # Font styles
│       ├── spacing.ts         # Spacing scale
│       └── theme.ts           # Theme config
│
├── assets/                     # Static assets
│   ├── images/
│   ├── fonts/
│   └── icons/
│
├── app.json                    # Expo config
├── package.json
├── tsconfig.json
└── babel.config.js
```

---

## **📋 Implementation Roadmap**

### **Phase 1: Backend Completion (1-2 weeks)**

**Week 1: Critical Features**
- [ ] Day 1-2: Trip search & filtering
- [ ] Day 3-4: Reviews/ratings system
- [ ] Day 5: Provider public profile endpoint

**Week 2: Authentication & Payments**
- [ ] Day 1-2: Email verification flow
- [ ] Day 3-4: Phone OTP verification
- [ ] Day 5-7: Payment integration (Moyasar)

**Additional Tasks**
- [ ] File upload (S3 integration) - 2-3 days
- [ ] User registration history - 1 day
- [ ] Trip cancellation logic - 2 days

**Total Backend Work**: ~10-12 days

---

### **Phase 2: Mobile App Foundation (1 week)**

**Day 1-2: Project Setup**
- [ ] Initialize Expo project with TypeScript
- [ ] Configure ESLint, Prettier
- [ ] Setup folder structure
- [ ] Install core dependencies
- [ ] Configure navigation structure

**Day 3-4: Design System & Theme**
- [ ] Create color palette
- [ ] Define typography scale
- [ ] Setup spacing system
- [ ] Create base components (Button, Input, Card)
- [ ] Implement dark mode support

**Day 5-7: API Client & Auth**
- [ ] Setup Axios client with interceptors
- [ ] Implement token storage (SecureStore)
- [ ] Create auth service layer
- [ ] Implement automatic token refresh
- [ ] Setup React Query configuration
- [ ] Create auth state management (Zustand)

---

### **Phase 3: Authentication Flow (1 week)**

**Day 1-2: Login & Registration**
- [ ] Login screen UI
- [ ] Registration screen UI
- [ ] Form validation with Zod
- [ ] API integration
- [ ] Error handling

**Day 3-4: Verification Flows**
- [ ] Email verification screen
- [ ] Phone OTP screen
- [ ] Resend OTP functionality
- [ ] Success/error states

**Day 5-7: Password Management**
- [ ] Forgot password flow
- [ ] Reset password screen
- [ ] Change password screen
- [ ] Validation and error handling

---

### **Phase 4: Core Features (2-3 weeks)**

**Week 1: Trip Browsing**
- [ ] Day 1-2: Trip list screen
  - Infinite scroll with React Query
  - Pull to refresh
  - Loading states
  - Empty states
- [ ] Day 3-4: Search & filters
  - Search bar
  - Filter modal (location, date, price)
  - Apply filters to API
- [ ] Day 5-7: Trip details screen
  - Image gallery
  - Package cards
  - Required fields display
  - Provider info
  - Reviews section

**Week 2: Booking Flow**
- [ ] Day 1-2: Package selection
  - Package comparison
  - Price display with currency
  - Select package per participant
- [ ] Day 3-5: Participant forms
  - Dynamic form generation based on required fields
  - Field validation (client + server)
  - Multi-participant support
  - Add/remove participants
- [ ] Day 6-7: Booking summary
  - Review participants
  - Total amount calculation
  - Terms & conditions

**Week 3: Payment & Completion**
- [ ] Day 1-3: Payment integration
  - Moyasar SDK integration
  - Payment screen with multiple payment methods
  - 3D Secure (SCA) support
  - Apple Pay integration
  - Payment confirmation
- [ ] Day 4-5: Booking confirmation
  - Success screen
  - Booking details
  - Download receipt (PDF)
- [ ] Day 6-7: Registration history
  - List user bookings
  - Filter by status
  - Booking details view
  - Cancel booking

---

### **Phase 5: User Profile & Settings (1 week)**

**Day 1-3: Profile Management**
- [ ] Profile screen UI
- [ ] Edit profile form
- [ ] Avatar upload
- [ ] Update API integration

**Day 4-5: Settings**
- [ ] Settings screen
- [ ] Notification preferences
- [ ] Language selection
- [ ] Theme toggle (light/dark)
- [ ] Logout functionality

**Day 6-7: Account Management**
- [ ] Change password
- [ ] Email/phone verification status
- [ ] Delete account option

---

### **Phase 6: Enhanced Features (1-2 weeks)**

**Week 1: Provider & Reviews**
- [ ] Day 1-2: Provider profile screen
  - Company info
  - Trip list
  - Average rating
- [ ] Day 3-4: Reviews & ratings
  - Write review screen
  - Rating component
  - Review list
  - Photo upload for reviews

**Week 2: Additional Features**
- [ ] Day 1-2: Push notifications
  - Setup FCM
  - Handle notifications
  - Notification preferences
- [ ] Day 3-4: Favorites
  - Add/remove favorites
  - Favorites list
  - Sync with backend
- [ ] Day 5-7: Offline support
  - Cache trip data
  - Offline indicator
  - Queue actions

---

### **Phase 7: Polish & Testing (1 week)**

**Day 1-2: UI/UX Refinement**
- [ ] Animations and transitions
- [ ] Loading states
- [ ] Error boundaries
- [ ] Accessibility (screen readers, labels)

**Day 3-4: Performance Optimization**
- [ ] Image optimization
- [ ] List virtualization
- [ ] Code splitting
- [ ] Bundle size optimization

**Day 5-7: Testing**
- [ ] Unit tests for utilities
- [ ] Component tests
- [ ] Integration tests
- [ ] E2E tests (critical flows)

---

### **Phase 8: Deployment Preparation (3-5 days)**

**Day 1-2: App Store Setup**
- [ ] Create app icons (iOS & Android)
- [ ] Create splash screens
- [ ] Write app descriptions
- [ ] Prepare screenshots
- [ ] Privacy policy & terms

**Day 3-4: Build & Submit**
- [ ] Configure app.json for production
- [ ] Build iOS app (EAS Build)
- [ ] Build Android app (EAS Build)
- [ ] Submit to App Store
- [ ] Submit to Google Play

**Day 5: Post-Launch**
- [ ] Setup analytics (Amplitude/Mixpanel)
- [ ] Setup crash reporting (Sentry)
- [ ] Monitor initial reviews
- [ ] Prepare for updates

---

## **📊 Timeline Summary**

| Phase | Duration | Description |
|-------|----------|-------------|
| **Backend Completion** | 1-2 weeks | Critical features for mobile app |
| **App Foundation** | 1 week | Setup, design system, API client |
| **Authentication** | 1 week | Login, register, verification |
| **Core Features** | 2-3 weeks | Browse, search, booking, payment |
| **Profile & Settings** | 1 week | User management |
| **Enhanced Features** | 1-2 weeks | Reviews, notifications, favorites |
| **Polish & Testing** | 1 week | UI refinement, testing |
| **Deployment** | 3-5 days | App store submission |
| **TOTAL** | **8-11 weeks** | Complete mobile app |

---

## **💡 Recommended Approach**

### **Option A: Complete Backend First (Recommended)**
**Timeline**: 1-2 weeks backend + 6-8 weeks mobile = **7-10 weeks total**

**Pros**:
- Mobile app has all features from day 1
- Can test full flow end-to-end
- Better user experience
- No "Coming Soon" placeholders

**Cons**:
- Longer time to market
- Can't get early user feedback

**Priority Order**:
1. Payment integration (critical for revenue)
2. Email/Phone verification (security & trust)
3. Trip search (core UX)
4. Reviews system (social proof)
5. File uploads (visual appeal)
6. User registration history
7. Trip cancellation

---

### **Option B: Start Mobile with Existing Backend**
**Timeline**: Start immediately, add features incrementally

**Pros**:
- Faster time to market
- Can iterate based on feedback
- Backend features added as needed

**Cons**:
- Some features will be "Coming Soon"
- May need frequent app updates
- Incomplete user experience initially

**MVP Features** (can launch without):
- Reviews (can add later)
- Favorites (nice to have)
- Push notifications (can add later)
- Offline support (enhancement)

---

### **Option C: Parallel Development (Fastest)**
**Timeline**: 6-8 weeks total

**Approach**:
- I implement backend features (1-2 weeks)
- You review/test backend as I build
- I start mobile app while backend is in review
- Backend features integrated as they're ready

**Pros**:
- Fastest overall timeline
- Continuous progress
- Early feedback on both ends

**Cons**:
- Requires coordination
- May need mobile app updates as backend evolves

---

## **🎯 My Recommendation**

**I recommend Option A: Complete Backend First**

**Reasoning**:
1. **Better UX**: Users get complete experience from launch
2. **Fewer updates**: No need for frequent app store submissions
3. **Easier testing**: Full integration testing possible
4. **Professional launch**: No "Coming Soon" features

**Timeline**: ~10 weeks total
- Weeks 1-2: Backend completion
- Weeks 3-10: Mobile app development
- Week 11: Beta testing & refinement
- Week 12: App store submission

---

## **✅ Next Steps**

### **Immediate Actions**
1. **Decide on approach** (A, B, or C)
2. **Prioritize backend features** if going with Option A
3. **Setup mobile project** if going with Option B/C
4. **Create detailed task breakdown** for chosen approach

### **Questions to Answer**
- [ ] Which option do you prefer? (A, B, or C)
- [ ] Do you want to launch with MVP or full features?
- [ ] What's your target launch date?
- [ ] Do you have design mockups or should I create the UI?
- [ ] Any specific branding guidelines (colors, fonts)?

---

## **🚀 I'm Ready to Build!**

I can deliver a **production-quality React Native app** with:

✅ **Excellent UX** - Smooth animations, intuitive navigation  
✅ **Type Safety** - Full TypeScript coverage  
✅ **Robust Error Handling** - Graceful failures, helpful messages  
✅ **Offline Support** - Cache data, queue actions  
✅ **Performance** - Optimized lists, fast loading  
✅ **Accessibility** - Screen reader support, proper labels  
✅ **Testing** - Unit, integration, and E2E tests  
✅ **Analytics** - Track user behavior and crashes  

**Let me know which option you'd like to proceed with, and I'll start implementation immediately!** 🎉
