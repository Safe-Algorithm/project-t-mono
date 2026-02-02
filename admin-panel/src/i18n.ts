import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      "nav.dashboard": "Dashboard",
      "nav.trips": "Trips",
      "nav.providers": "Providers",
      "nav.users": "Users",
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
      
      // Language
      "language.english": "English",
      "language.arabic": "Arabic",
      "language.switch": "Switch Language",
      
      // Trip fields
      "trip.name": "Trip Name",
      "trip.description": "Description",
      "trip.startDate": "Start Date",
      "trip.endDate": "End Date",
      "trip.maxParticipants": "Max Participants",
      "trip.price": "Price",
      "trip.status": "Status",
      "trip.provider": "Provider",
      
      // Actions
      "action.create": "Create",
      "action.update": "Update",
      "action.approve": "Approve",
      "action.reject": "Reject",
    }
  },
  ar: {
    translation: {
      // Navigation
      "nav.dashboard": "لوحة التحكم",
      "nav.trips": "الرحلات",
      "nav.providers": "مقدمو الخدمات",
      "nav.users": "المستخدمون",
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
      
      // Language
      "language.english": "الإنجليزية",
      "language.arabic": "العربية",
      "language.switch": "تغيير اللغة",
      
      // Trip fields
      "trip.name": "اسم الرحلة",
      "trip.description": "الوصف",
      "trip.startDate": "تاريخ البدء",
      "trip.endDate": "تاريخ الانتهاء",
      "trip.maxParticipants": "الحد الأقصى للمشاركين",
      "trip.price": "السعر",
      "trip.status": "الحالة",
      "trip.provider": "مقدم الخدمة",
      
      // Actions
      "action.create": "إنشاء",
      "action.update": "تحديث",
      "action.approve": "موافقة",
      "action.reject": "رفض",
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
      escapeValue: false, // React already escapes
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
