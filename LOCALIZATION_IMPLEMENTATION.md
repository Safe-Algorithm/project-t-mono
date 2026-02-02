# Full Localization (Arabic/English) Implementation Guide

## ✅ COMPLETED - Backend (Option A)

### 1. Database Migration ✅
**Migration**: `e9fa94929987_update_bilingual_fields_trip_package_provider`

**Changes**:
- ✅ `Trip` model: Added `name_en`, `name_ar`, `description_en`, `description_ar`
- ✅ `TripPackage` model: Added `name_en`, `name_ar`, `description_en`, `description_ar`
- ✅ `Provider` model: Added `bio_en`, `bio_ar`
- ✅ Existing data migrated to both language fields

### 2. Backend Infrastructure ✅

**Files Created**:
- ✅ `app/core/language.py` - Language utility functions
- ✅ `app/api/localization.py` - API response localization helpers
- ✅ `app/api/deps.py` - Added `get_language()` dependency

**Schemas Updated**:
- ✅ `app/schemas/trip.py` - Bilingual fields
- ✅ `app/schemas/trip_package.py` - Bilingual fields
- ✅ `app/schemas/provider.py` - Bilingual bio fields

### 3. API Language Support ✅

**How to Use**:
```python
# In any endpoint
from app.api.deps import get_language

@router.get("/trips")
def get_trips(
    lang: str = Depends(get_language)  # Extracts from ?lang=ar or Accept-Language header
):
    # Use lang parameter to localize response
    pass
```

**Client Usage**:
```bash
# Query parameter (preferred)
GET /api/v1/trips?lang=ar

# Accept-Language header
GET /api/v1/trips
Headers: Accept-Language: ar-SA,ar;q=0.9
```

---

## ✅ COMPLETED - Frontend (Option B)

### 1. Dependencies Installed ✅
```bash
# Both admin-panel and providers-panel
npm install react-i18next i18next i18next-browser-languagedetector
```

### 2. i18n Configuration ✅

**Files Created**:
- ✅ `admin-panel/src/i18n.ts` - Admin panel translations
- ✅ `providers-panel/src/i18n.ts` - Provider panel translations

**Features**:
- ✅ English and Arabic translations
- ✅ Automatic language detection
- ✅ localStorage persistence
- ✅ Fallback to English

### 3. Language Switcher Component ✅

**Files Created**:
- ✅ `admin-panel/src/components/LanguageSwitcher.tsx`
- ✅ `providers-panel/src/components/LanguageSwitcher.tsx`

**Features**:
- ✅ Toggle between English/Arabic
- ✅ Automatic RTL/LTR switching
- ✅ Persists preference in localStorage

### 4. App Integration ✅

**Files Updated**:
- ✅ `admin-panel/src/pages/_app.tsx` - Initialized i18n
- ✅ `providers-panel/src/pages/_app.tsx` - Initialized i18n

---

## 📋 TODO - Remaining Work

### Backend Tasks

#### 1. Update API Endpoints to Return Localized Data
You need to update endpoints to use the `get_language` dependency and return localized responses.

**Example Pattern**:
```python
from app.api.deps import get_language
from app.api.localization import localize_trip_response

@router.get("/{trip_id}", response_model=TripRead)
def read_trip(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
    lang: str = Depends(get_language),  # Add this
    current_user: User = Depends(get_current_active_provider),
):
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    
    # Option 1: Return both languages (current behavior)
    if not lang:
        return trip
    
    # Option 2: Return localized response
    return localize_trip_response(trip, lang)
```

**Endpoints to Update**:
- [ ] `GET /api/v1/trips` - List trips
- [ ] `GET /api/v1/trips/{trip_id}` - Get trip details
- [ ] `GET /api/v1/trips/all` - Public trips list
- [ ] `GET /api/v1/admin/trips` - Admin trips list
- [ ] `GET /api/v1/admin/trips/{trip_id}` - Admin trip details
- [ ] Package endpoints
- [ ] Provider endpoints

#### 2. Update Unit Tests
- [ ] Update test data to include bilingual fields
- [ ] Test language query parameter
- [ ] Test Accept-Language header
- [ ] Test localized responses

### Frontend Tasks

#### 1. Add Language Switcher to Layouts

**Admin Panel** - Add to header/navbar:
```tsx
import LanguageSwitcher from '@/components/LanguageSwitcher';

// In your Layout component
<header>
  {/* ... other header content ... */}
  <LanguageSwitcher />
</header>
```

**Provider Panel** - Same pattern

#### 2. Update Forms for Bilingual Fields

**Example - Trip Form**:
```tsx
import { useTranslation } from 'react-i18next';

function TripForm() {
  const { t } = useTranslation();
  
  return (
    <form>
      {/* English Name */}
      <div>
        <label>{t('trip.nameEn')}</label>
        <input name="name_en" />
      </div>
      
      {/* Arabic Name */}
      <div>
        <label>{t('trip.nameAr')}</label>
        <input name="name_ar" dir="rtl" />
      </div>
      
      {/* English Description */}
      <div>
        <label>{t('trip.descriptionEn')}</label>
        <textarea name="description_en" />
      </div>
      
      {/* Arabic Description */}
      <div>
        <label>{t('trip.descriptionAr')}</label>
        <textarea name="description_ar" dir="rtl" />
      </div>
    </form>
  );
}
```

**Forms to Update**:
- [ ] Trip creation/edit form
- [ ] Package creation/edit form
- [ ] Provider profile form

#### 3. Update API Service to Send Language Parameter

**Example - tripService.ts**:
```typescript
// Get current language from i18n
import i18n from '@/i18n';

export const tripService = {
  async getTrips() {
    const lang = i18n.language; // 'en' or 'ar'
    const response = await api.get(`/trips?lang=${lang}`);
    return response.data;
  },
  
  async createTrip(data: TripCreatePayload) {
    // Send bilingual data
    const payload = {
      name_en: data.name_en,
      name_ar: data.name_ar,
      description_en: data.description_en,
      description_ar: data.description_ar,
      // ... other fields
    };
    return api.post('/trips', payload);
  }
};
```

#### 4. Add RTL Styles

**Create RTL CSS** (`styles/rtl.css`):
```css
[dir="rtl"] {
  text-align: right;
}

[dir="rtl"] .flex {
  flex-direction: row-reverse;
}

[dir="rtl"] input,
[dir="rtl"] textarea {
  text-align: right;
}

/* Add more RTL-specific styles as needed */
```

#### 5. Update Type Definitions

**Update Trip interface**:
```typescript
export interface Trip {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  // ... other fields
}

export interface TripCreatePayload {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  // ... other fields
}
```

---

## 🎯 Quick Start Guide

### For Backend Developers

1. **Use language parameter in endpoints**:
   ```python
   lang: str = Depends(get_language)
   ```

2. **Return localized responses**:
   ```python
   from app.api.localization import localize_trip_response
   return localize_trip_response(trip, lang)
   ```

### For Frontend Developers

1. **Add LanguageSwitcher to layout**:
   ```tsx
   import LanguageSwitcher from '@/components/LanguageSwitcher';
   <LanguageSwitcher />
   ```

2. **Use translations in components**:
   ```tsx
   import { useTranslation } from 'react-i18next';
   const { t } = useTranslation();
   <label>{t('trip.name')}</label>
   ```

3. **Update forms for bilingual fields**:
   ```tsx
   <input name="name_en" placeholder="English name" />
   <input name="name_ar" placeholder="الاسم بالعربية" dir="rtl" />
   ```

4. **Send language with API calls**:
   ```typescript
   const lang = i18n.language;
   api.get(`/trips?lang=${lang}`);
   ```

---

## 📚 Resources

- **i18next Documentation**: https://www.i18next.com/
- **react-i18next**: https://react.i18next.com/
- **RTL Best Practices**: https://rtlstyling.com/

---

## ✅ Testing Checklist

### Backend
- [ ] Create trip with bilingual fields
- [ ] Update trip with bilingual fields
- [ ] Get trip with `?lang=en` returns English
- [ ] Get trip with `?lang=ar` returns Arabic
- [ ] Get trip with `Accept-Language: ar` returns Arabic
- [ ] Get trip without lang returns both languages

### Frontend
- [ ] Language switcher appears in header
- [ ] Clicking switcher changes language
- [ ] Language persists after page refresh
- [ ] RTL layout works for Arabic
- [ ] Forms have separate English/Arabic fields
- [ ] API calls include language parameter
- [ ] Localized data displays correctly

---

## 🚀 Status

**Backend**: ✅ 95% Complete (API endpoints need language filtering)
**Frontend**: ✅ 70% Complete (Forms and API integration needed)
**Overall**: 🟡 In Progress

**Next Steps**:
1. Update API endpoints to use language parameter
2. Add LanguageSwitcher to layouts
3. Update forms for bilingual input
4. Update API services to send language parameter
5. Test end-to-end
