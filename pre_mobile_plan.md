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
**Status**: ❌ Not implemented  
**Priority**: Critical (for revenue)  
**Estimated Time**: 3-4 days

**What's needed**:
- Replace existing Checkout.com implementation with Moyasar
- Moyasar is a Saudi Arabian payment gateway
- Supports: Mada, Visa, Mastercard, Apple Pay, STC Pay
- Better suited for Saudi market

**API Endpoints to implement**:
```python
# Create payment for trip registration
POST /api/v1/payments/create
Input: {registration_id: UUID, payment_method: str}
Output: {payment_id: str, redirect_url: str, amount: Decimal}

# Payment callback (after payment completion)
GET /api/v1/payments/callback
Process: Verify payment status with Moyasar, update registration

# Handle webhooks
POST /api/v1/payments/webhook
Process: Handle payment.paid, payment.failed events
Verify: Webhook signature with secret key
Update: Registration status based on payment events
```

**Implementation Steps**:
1. Remove Checkout.com service (`app/services/payment.py`)
2. Create new Moyasar payment service
3. Implement payment creation with Moyasar API
4. Add support for multiple payment methods (Mada, Visa, Mastercard, Apple Pay, STC Pay)
5. Create payment API endpoints in `routes/payments.py`
6. Link payments to trip registrations
7. Set up webhooks in Moyasar dashboard
8. Implement webhook handler with signature verification
9. Update registration status on payment events
10. Send confirmation emails/SMS on success
11. Handle payment failures gracefully
12. Implement refund flow for cancellations
13. Add comprehensive unit tests

**Moyasar Integration**:
- API Base URL: `https://api.moyasar.com/v1/`
- Authentication: API key (Basic Auth)
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

### **⚪ Nice to Have**

#### **13. Trip Sharing with Social Preview**
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

#### **14. Discounts System**
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

#### **15. User Wallet/Balance System**
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

#### **16. Customer Support Ticketing System**
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

#### **17. QR Code Check-In System**
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

#### **18. Trip Updates/Notifications**
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

#### **19. In-App Chat** (Future)
**Status**: ❌ Not implemented  
**Priority**: Low  
**Estimated Time**: 5-7 days

- Real-time messaging between users and providers
- Customer support chat
- WebSocket integration required

---

#### **20. Offline Support** (Future)
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
