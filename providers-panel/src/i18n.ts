import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      "nav.dashboard": "Dashboard",
      "nav.trips": "My Trips",
      "nav.createTrip": "Create Trip",
      "nav.profile": "Profile",
      "nav.settings": "Settings",
      "nav.logout": "Logout",
      
      // Common
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.delete": "Delete",
      "common.edit": "Edit",
      "common.view": "View",
      "common.search": "Search",
      "common.filter": "Filter",
      "common.loading": "Loading...",
      "common.error": "Error",
      "common.success": "Success",
      "common.yes": "Yes",
      "common.no": "No",
      "common.active": "Active",
      "common.inactive": "Inactive",
      "common.english": "English",
      "common.arabic": "Arabic",
      
      // Language
      "language.english": "English",
      "language.arabic": "Arabic",
      "language.switch": "Switch Language",
      
      // Trip fields
      "trip.nameEn": "Trip Name (English)",
      "trip.nameAr": "Trip Name (Arabic)",
      "trip.descriptionEn": "Description (English)",
      "trip.descriptionAr": "Description (Arabic)",
      "trip.startDate": "Start Date",
      "trip.endDate": "End Date",
      "trip.maxParticipants": "Max Participants",
      "trip.refundable": "Refundable",
      "trip.amenities": "Amenities",
      "trip.meetingPlace": "Meeting Place",
      "trip.meetingLocation": "Meeting Location",
      "trip.meetingTime": "Meeting Time",
      "trip.details": "Trip Details",
      "trip.policies": "Trip Policies",
      "trip.images": "Trip Images",
      "trip.information": "Trip Information",
      "trip.status": "Status",
      
      // Package fields
      "package.nameEn": "Package Name (English)",
      "package.nameAr": "Package Name (Arabic)",
      "package.descriptionEn": "Description (English)",
      "package.descriptionAr": "Description (Arabic)",
      "package.price": "Price",
      "package.currency": "Currency",
      "package.requiredFields": "Required Fields",
      "package.atLeastOne": "At least one required",
      
      // Form labels
      "form.name": "Name",
      "form.description": "Description",
      "form.price": "Price",
      "form.startDate": "Start Date",
      "form.endDate": "End Date",
      "form.maxParticipants": "Max Participants",
      "form.images": "Images",
      "form.addImages": "Add Images",
      "form.removePackage": "Remove",
      "form.addPackage": "Add Package",
      
      // Actions
      "action.create": "Create",
      "action.update": "Update",
      "action.submit": "Submit",
      "action.back": "Back",
      "action.edit": "Edit",
      "action.viewDetails": "View Details",
      "action.editTrip": "Edit Trip",
      "action.backToTrips": "Back to Trips",
      
      // Status
      "status.active": "Active",
      "status.inactive": "Inactive",
      "status.loading": "Loading trip details...",
      "status.error": "Error",
      "status.notFound": "Trip not found",
      
      // Messages
      "message.welcome": "Welcome",
      "message.noPackages": "No packages found",
      "message.packageWarning": "At least one package is required",
      
      // Additional form fields
      "trip.refundableDescription": "Allow customers to cancel and get a refund",
      "trip.amenitiesDescription": "Select all amenities included in this trip",
      "trip.amenitiesSelected": "{{count}} amenities selected",
      "trip.meetingPlaceDescription": "Has Meeting Place",
      "trip.meetingLocationPlaceholder": "Enter meeting location",
      "trip.imagesDescription": "Upload images for your trip (max 10 images)",
      "trip.currentImages": "Current Images",
      "trip.newImages": "New Images to Upload",
      
      // Package specific
      "package.packageNumber": "Package {{number}}",
      "package.note": "Note",
      "package.name": "Name",
      "package.dateOfBirth": "and Date of Birth",
      "package.alwaysRequired": "are always required and cannot be removed",
      "package.required": "Required",
      "package.selectedFields": "{{count}} fields selected",
      
      // Form actions
      "form.remove": "Remove",
      "form.hide": "Hide",
      "form.configure": "Configure",
      "form.validations": "Validations",
      "form.submitting": "Submitting...",
      "form.createTrip": "Create Trip",
      "form.updateTrip": "Update Trip",
    }
  },
  ar: {
    translation: {
      // Navigation
      "nav.dashboard": "لوحة التحكم",
      "nav.trips": "رحلاتي",
      "nav.createTrip": "إنشاء رحلة",
      "nav.profile": "الملف الشخصي",
      "nav.settings": "الإعدادات",
      "nav.logout": "تسجيل الخروج",
      
      // Common
      "common.save": "حفظ",
      "common.cancel": "إلغاء",
      "common.delete": "حذف",
      "common.edit": "تعديل",
      "common.view": "عرض",
      "common.search": "بحث",
      "common.filter": "تصفية",
      "common.loading": "جاري التحميل...",
      "common.error": "خطأ",
      "common.success": "نجح",
      "common.yes": "نعم",
      "common.no": "لا",
      "common.active": "نشط",
      "common.inactive": "غير نشط",
      "common.english": "الإنجليزية",
      "common.arabic": "العربية",
      
      // Language
      "language.english": "الإنجليزية",
      "language.arabic": "العربية",
      "language.switch": "تغيير اللغة",
      
      // Trip fields
      "trip.nameEn": "اسم الرحلة (إنجليزي)",
      "trip.nameAr": "اسم الرحلة (عربي)",
      "trip.descriptionEn": "الوصف (إنجليزي)",
      "trip.descriptionAr": "الوصف (عربي)",
      "trip.startDate": "تاريخ البدء",
      "trip.endDate": "تاريخ الانتهاء",
      "trip.maxParticipants": "الحد الأقصى للمشاركين",
      "trip.refundable": "قابل للاسترداد",
      "trip.amenities": "المرافق",
      "trip.meetingPlace": "مكان اللقاء",
      "trip.meetingLocation": "موقع اللقاء",
      "trip.meetingTime": "وقت اللقاء",
      "trip.details": "تفاصيل الرحلة",
      "trip.policies": "سياسات الرحلة",
      "trip.images": "صور الرحلة",
      "trip.information": "معلومات الرحلة",
      "trip.status": "الحالة",
      
      // Package fields
      "package.nameEn": "اسم الباقة (إنجليزي)",
      "package.nameAr": "اسم الباقة (عربي)",
      "package.descriptionEn": "الوصف (إنجليزي)",
      "package.descriptionAr": "الوصف (عربي)",
      "package.price": "السعر",
      "package.currency": "العملة",
      "package.requiredFields": "الحقول المطلوبة",
      "package.atLeastOne": "مطلوب واحد على الأقل",
      
      // Form labels
      "form.name": "الاسم",
      "form.description": "الوصف",
      "form.price": "السعر",
      "form.startDate": "تاريخ البدء",
      "form.endDate": "تاريخ الانتهاء",
      "form.maxParticipants": "الحد الأقصى للمشاركين",
      "form.images": "الصور",
      "form.addImages": "إضافة صور",
      "form.removePackage": "إزالة",
      "form.addPackage": "إضافة باقة",
      
      // Actions
      "action.create": "إنشاء",
      "action.update": "تحديث",
      "action.submit": "إرسال",
      "action.back": "رجوع",
      "action.edit": "تعديل",
      "action.viewDetails": "عرض التفاصيل",
      "action.editTrip": "تعديل الرحلة",
      "action.backToTrips": "العودة إلى الرحلات",
      
      // Status
      "status.active": "نشط",
      "status.inactive": "غير نشط",
      "status.loading": "جاري تحميل تفاصيل الرحلة...",
      "status.error": "خطأ",
      "status.notFound": "الرحلة غير موجودة",
      
      // Messages
      "message.welcome": "مرحباً",
      "message.noPackages": "لم يتم العثور على باقات",
      "message.packageWarning": "مطلوب باقة واحدة على الأقل",
      
      // Additional form fields
      "trip.refundableDescription": "السماح للعملاء بالإلغاء واسترداد الأموال",
      "trip.amenitiesDescription": "اختر جميع المرافق المتضمنة في هذه الرحلة",
      "trip.amenitiesSelected": "تم اختيار {{count}} من المرافق",
      "trip.meetingPlaceDescription": "يوجد مكان لقاء",
      "trip.meetingLocationPlaceholder": "أدخل موقع اللقاء",
      "trip.imagesDescription": "تحميل صور للرحلة (بحد أقصى 10 صور)",
      "trip.currentImages": "الصور الحالية",
      "trip.newImages": "الصور الجديدة للتحميل",
      
      // Package specific
      "package.packageNumber": "الباقة {{number}}",
      "package.note": "ملاحظة",
      "package.name": "الاسم",
      "package.dateOfBirth": "وتاريخ الميلاد",
      "package.alwaysRequired": "مطلوبان دائماً ولا يمكن إزالتهما",
      "package.required": "مطلوب",
      "package.selectedFields": "تم اختيار {{count}} حقول",
      
      // Form actions
      "form.remove": "إزالة",
      "form.hide": "إخفاء",
      "form.configure": "تكوين",
      "form.validations": "التحققات",
      "form.submitting": "جاري الإرسال...",
      "form.createTrip": "إنشاء رحلة",
      "form.updateTrip": "تحديث الرحلة",
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    interpolation: {
      escapeValue: false,
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
