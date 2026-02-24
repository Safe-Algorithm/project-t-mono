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

      // Nav extras
      "nav.supportTickets": "Support Tickets",
      "nav.tripUpdates": "Trip Updates",
      "nav.team": "Team",
      "nav.welcome": "Welcome",

      // Support Tickets
      "support.title": "Customer Support Tickets",
      "support.subtitle": "Tickets raised by customers for your trips.",
      "support.noTickets": "No support tickets found.",
      "support.loadingTickets": "Loading tickets...",
      "support.allStatuses": "All statuses",
      "support.backToList": "← Back to list",
      "support.created": "Created",
      "support.userId": "User ID",
      "support.tripId": "Trip ID",
      "support.status": "Status",
      "support.priority": "Priority",
      "support.subject": "Subject",
      "support.messages": "Messages",
      "support.noMessages": "No messages yet.",
      "support.replyPlaceholder": "Type your reply to the customer...",
      "support.reply": "Reply",
      "support.you": "You (Provider)",
      "support.customer": "Customer",
      "support.dismiss": "Dismiss",

      // Ticket statuses
      "ticketStatus.open": "open",
      "ticketStatus.in_progress": "in progress",
      "ticketStatus.waiting_on_user": "waiting on user",
      "ticketStatus.resolved": "resolved",
      "ticketStatus.closed": "closed",

      // Ticket priorities
      "ticketPriority.low": "low",
      "ticketPriority.medium": "medium",
      "ticketPriority.high": "high",
      "ticketPriority.urgent": "urgent",

      // Trip Updates
      "tripUpdates.title": "Trip Updates",
      "tripUpdates.subtitle": "Send updates and notifications to your trip registrants.",
      "tripUpdates.selectTrip": "Select Trip",
      "tripUpdates.sendUpdate": "+ Send Update",
      "tripUpdates.cancel": "Cancel",
      "tripUpdates.sendNew": "Send New Update",
      "tripUpdates.allRegistered": "All registered users",
      "tripUpdates.specificRegistration": "Specific registration",
      "tripUpdates.registration": "Registration",
      "tripUpdates.selectRegistration": "Select a registration...",
      "tripUpdates.titleLabel": "Title",
      "tripUpdates.titlePlaceholder": "e.g. Flight tickets ready",
      "tripUpdates.messageLabel": "Message",
      "tripUpdates.messagePlaceholder": "Write your update message...",
      "tripUpdates.markImportant": "Mark as important",
      "tripUpdates.sending": "Sending...",
      "tripUpdates.send": "Send Update",
      "tripUpdates.sentSuccess": "Update sent successfully!",
      "tripUpdates.noUpdates": "No updates sent for this trip yet.",
      "tripUpdates.important": "Important",
      "tripUpdates.targeted": "Targeted",
      "tripUpdates.recipients": "Recipients",
      "tripUpdates.read": "Read",
      "tripUpdates.viewReceipts": "View receipts",
      "tripUpdates.hideReceipts": "Hide receipts",
      "tripUpdates.noReads": "No one has read this update yet.",
      "tripUpdates.readAt": "read at",
      "tripUpdates.loading": "Loading updates...",
      "tripUpdates.participant": "participant",
      "tripUpdates.participants": "participants",
      "tripUpdates.user": "User",

      // Destinations
      "destinations.title": "Trip Destinations",
      "destinations.selectCountry": "Select Country",
      "destinations.selectCity": "Select City (optional)",
      "destinations.selectPlace": "Select Place (optional)",
      "destinations.add": "Add",
      "destinations.noDestinations": "No destinations added yet.",
      "destinations.loadingCountries": "Loading countries...",

      // Dashboard
      "dashboard.title": "Provider Dashboard",
      "dashboard.totalTrips": "Total Trips",
      "dashboard.activeTrips": "Active Trips",
      "dashboard.totalRegistrations": "Total Registrations",
      "dashboard.revenue": "Revenue",

      // Profile
      "profile.companyProfile": "Company Profile",
      "profile.companyName": "Company Name",
      "profile.companyEmail": "Company Email",
      "profile.companyPhone": "Company Phone",
      "profile.bioEn": "Bio (English)",
      "profile.bioAr": "Bio (Arabic)",
      "profile.editProfile": "Edit Profile",
      "profile.userProfile": "User Profile",

      // Team
      "team.title": "Team Management",
      "team.inviteMember": "Invite Member",

      // Trips list
      "trips.title": "My Trips",
      "trips.createNew": "Create New Trip",
      "trips.noTrips": "No trips found.",

      // Common extras
      "common.confirm": "Confirm",
      "common.dismiss": "Dismiss",
      "common.backToList": "← Back to list",
      "common.all": "All",
      "common.date": "Date",
      "common.actions": "Actions",
      "common.details": "Details",
      "common.close": "Close",
      "common.open": "Open",
      "common.send": "Send",
      "common.noData": "No data found.",
      "common.goBack": "Go back",
      "common.optional": "optional",
      "common.required": "required",

      // Trip form — dates & capacity section
      "trip.datesCapacity": "Dates & Capacity",
      "trip.startDateTime": "Start Date & Time",
      "trip.endDateTime": "End Date & Time",
      "trip.registrationDeadline": "Registration Deadline",
      "trip.registrationDeadlineHint": "≤ start date",
      "trip.maxParticipantsPlaceholder": "e.g. 20",

      // Trip form — starting city section
      "trip.startingCity": "Starting City",
      "trip.startingCityHint": "The city from which this trip departs.",
      "trip.startingCitySelected": "Starting city selected",
      "trip.country": "Country",
      "trip.city": "City",
      "trip.selectCountry": "Select country…",
      "trip.selectCity": "Select city…",

      // Trip form — settings & destinations
      "trip.settingsDestinations": "Settings & Destinations",

      // Trip form — trip type
      "trip.tripType": "Trip Type",
      "trip.tripTypeHint": "Choose whether this trip has multiple selectable packages or a single price.",
      "trip.simpleTrip": "Simple Trip",
      "trip.simpleTripDesc": "One price for all participants",
      "trip.packagedTrip": "Packaged Trip",
      "trip.packagedTripDesc": "Multiple packages, each with its own price",

      // Trip form — price/policy section
      "trip.pricePolicyFields": "Price, Policy & Fields",
      "trip.pricePerPerson": "Price per Person (SAR)",
      "trip.pricePlaceholder": "e.g. 250",
      "trip.requiredParticipantFields": "Required Participant Fields",
      "trip.requiredFieldsNote": "Name and Date of Birth are always required.",
      "trip.provideOneLanguage": "Provide info in at least one language (English or Arabic)",
      "trip.optionalIfArabic": "optional if Arabic provided",
      "trip.optionalIfEnglish": "optional if English provided",

      // Trip form — error banner
      "form.fixFollowing": "Please fix the following:",
      "form.uploadingImages": "Uploading images, please wait…",

      // Trip form — packages section
      "package.minRequired": "minimum 2 required",
      "package.provideOneLanguage": "Provide info in at least one language (English or Arabic)",
      "package.nameEnOptional": "optional",
      "package.maxParticipants": "Max Participants",
      "package.maxParticipantsPlaceholder": "e.g. 10",
      "package.pricePlaceholder": "e.g. 250",
      "package.refundable": "Refundable",
      "package.amenities": "Amenities",
      "package.nameDOBAlwaysRequired": "Name & DOB always required.",

      // Destinations selector
      "destinations.addDestination": "Add Destination",
      "destinations.noDestinationsYet": "No destinations added yet. Please add at least one destination.",
      "destinations.loading": "Loading destinations…",
      "destinations.addButton": "+ Add Destination",
      "destinations.adding": "Adding…",
      "destinations.country": "Country",
      "destinations.city": "City",
      "destinations.place": "Place",
      "destinations.selectCountryPlaceholder": "— Select Country —",
      "destinations.selectCityPlaceholder": "— Select City —",
      "destinations.selectPlacePlaceholder": "— Select Place —",

      // Validation config
      "validation.rulesFor": "Validation Rules — {{field}}",
      "validation.noOptions": "No validation options available for this field type.",
      "validation.configureHint": "Configure validation rules that participants must meet for this field:",
      "validation.errors": "Validation Errors:",
      "validation.currentConfig": "Current Configuration:",
      "validation.loading": "Loading validation options…",

      // Trips list page
      "trips.totalCount_one": "{{count}} trip total",
      "trips.totalCount_other": "{{count}} trips total",
      "trips.searchPlaceholder": "Search trips...",
      "trips.filterAll": "All",
      "trips.filterActive": "Active",
      "trips.filterInactive": "Inactive",
      "trips.colTrip": "Trip",
      "trips.colDates": "Dates",
      "trips.colPrice": "Price",
      "trips.colSeats": "Seats",
      "trips.colStatus": "Status",
      "trips.typePackaged": "Packaged",
      "trips.typeSimple": "Simple",
      "trips.pkg": "pkg",
      "trips.getStarted": "Get started by creating your first trip",

      // New/Edit trip pages
      "trip.createNew": "Create New Trip",
      "trip.createNewSubtitle": "Fill in the details to create a new trip offering",
      "trip.editTrip": "Edit Trip",
      "trip.viewDetails": "View Details",
      "trip.deleteTrip": "Delete Trip",
      "trip.cancelCreate": "Cancel",
      "trip.loadingError": "An unknown error occurred while fetching trip details.",
      "trip.notFound": "Trip not found.",
      "trip.goBack": "Go back",

      // Layout
      "layout.providerPanel": "Provider Panel",
      "layout.logoutConfirm": "Logout?",
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

      // Nav extras
      "nav.supportTickets": "تذاكر الدعم",
      "nav.tripUpdates": "تحديثات الرحلات",
      "nav.team": "الفريق",
      "nav.welcome": "مرحباً",

      // Support Tickets
      "support.title": "تذاكر دعم العملاء",
      "support.subtitle": "التذاكر المرفوعة من العملاء لرحلاتك.",
      "support.noTickets": "لا توجد تذاكر دعم.",
      "support.loadingTickets": "جاري تحميل التذاكر...",
      "support.allStatuses": "جميع الحالات",
      "support.backToList": "→ العودة للقائمة",
      "support.created": "تاريخ الإنشاء",
      "support.userId": "معرف المستخدم",
      "support.tripId": "معرف الرحلة",
      "support.status": "الحالة",
      "support.priority": "الأولوية",
      "support.subject": "الموضوع",
      "support.messages": "الرسائل",
      "support.noMessages": "لا توجد رسائل بعد.",
      "support.replyPlaceholder": "اكتب ردك للعميل...",
      "support.reply": "رد",
      "support.you": "أنت (مقدم الخدمة)",
      "support.customer": "العميل",
      "support.dismiss": "إغلاق",

      // Ticket statuses
      "ticketStatus.open": "مفتوحة",
      "ticketStatus.in_progress": "قيد المعالجة",
      "ticketStatus.waiting_on_user": "بانتظار المستخدم",
      "ticketStatus.resolved": "تم الحل",
      "ticketStatus.closed": "مغلقة",

      // Ticket priorities
      "ticketPriority.low": "منخفضة",
      "ticketPriority.medium": "متوسطة",
      "ticketPriority.high": "عالية",
      "ticketPriority.urgent": "عاجلة",

      // Trip Updates
      "tripUpdates.title": "تحديثات الرحلات",
      "tripUpdates.subtitle": "أرسل تحديثات وإشعارات للمسجلين في رحلاتك.",
      "tripUpdates.selectTrip": "اختر الرحلة",
      "tripUpdates.sendUpdate": "+ إرسال تحديث",
      "tripUpdates.cancel": "إلغاء",
      "tripUpdates.sendNew": "إرسال تحديث جديد",
      "tripUpdates.allRegistered": "جميع المسجلين",
      "tripUpdates.specificRegistration": "تسجيل محدد",
      "tripUpdates.registration": "التسجيل",
      "tripUpdates.selectRegistration": "اختر تسجيلاً...",
      "tripUpdates.titleLabel": "العنوان",
      "tripUpdates.titlePlaceholder": "مثال: تذاكر الطيران جاهزة",
      "tripUpdates.messageLabel": "الرسالة",
      "tripUpdates.messagePlaceholder": "اكتب رسالة التحديث...",
      "tripUpdates.markImportant": "تحديد كمهم",
      "tripUpdates.sending": "جاري الإرسال...",
      "tripUpdates.send": "إرسال التحديث",
      "tripUpdates.sentSuccess": "تم إرسال التحديث بنجاح!",
      "tripUpdates.noUpdates": "لم يتم إرسال تحديثات لهذه الرحلة بعد.",
      "tripUpdates.important": "مهم",
      "tripUpdates.targeted": "موجّه",
      "tripUpdates.recipients": "المستلمون",
      "tripUpdates.read": "مقروء",
      "tripUpdates.viewReceipts": "عرض إيصالات القراءة",
      "tripUpdates.hideReceipts": "إخفاء الإيصالات",
      "tripUpdates.noReads": "لم يقرأ أحد هذا التحديث بعد.",
      "tripUpdates.readAt": "قُرئ في",
      "tripUpdates.loading": "جاري تحميل التحديثات...",
      "tripUpdates.participant": "مشارك",
      "tripUpdates.participants": "مشاركين",
      "tripUpdates.user": "المستخدم",

      // Destinations
      "destinations.title": "وجهات الرحلة",
      "destinations.selectCountry": "اختر الدولة",
      "destinations.selectCity": "اختر المدينة (اختياري)",
      "destinations.selectPlace": "اختر المكان (اختياري)",
      "destinations.add": "إضافة",
      "destinations.noDestinations": "لم تتم إضافة وجهات بعد.",
      "destinations.loadingCountries": "جاري تحميل الدول...",

      // Dashboard
      "dashboard.title": "لوحة تحكم مقدم الخدمة",
      "dashboard.totalTrips": "إجمالي الرحلات",
      "dashboard.activeTrips": "الرحلات النشطة",
      "dashboard.totalRegistrations": "إجمالي التسجيلات",
      "dashboard.revenue": "الإيرادات",

      // Profile
      "profile.companyProfile": "ملف الشركة",
      "profile.companyName": "اسم الشركة",
      "profile.companyEmail": "بريد الشركة",
      "profile.companyPhone": "هاتف الشركة",
      "profile.bioEn": "النبذة (إنجليزي)",
      "profile.bioAr": "النبذة (عربي)",
      "profile.editProfile": "تعديل الملف",
      "profile.userProfile": "الملف الشخصي",

      // Team
      "team.title": "إدارة الفريق",
      "team.inviteMember": "دعوة عضو",

      // Trips list
      "trips.title": "رحلاتي",
      "trips.createNew": "إنشاء رحلة جديدة",
      "trips.noTrips": "لا توجد رحلات.",

      // Common extras
      "common.confirm": "تأكيد",
      "common.dismiss": "إغلاق",
      "common.backToList": "→ العودة للقائمة",
      "common.all": "الكل",
      "common.date": "التاريخ",
      "common.actions": "الإجراءات",
      "common.details": "التفاصيل",
      "common.close": "إغلاق",
      "common.open": "فتح",
      "common.send": "إرسال",
      "common.noData": "لا توجد بيانات.",
      "common.goBack": "رجوع",
      "common.optional": "اختياري",
      "common.required": "مطلوب",

      // Trip form — dates & capacity section
      "trip.datesCapacity": "التواريخ والسعة",
      "trip.startDateTime": "تاريخ ووقت البدء",
      "trip.endDateTime": "تاريخ ووقت الانتهاء",
      "trip.registrationDeadline": "آخر موعد للتسجيل",
      "trip.registrationDeadlineHint": "≤ تاريخ البدء",
      "trip.maxParticipantsPlaceholder": "مثال: 20",

      // Trip form — starting city section
      "trip.startingCity": "مدينة الانطلاق",
      "trip.startingCityHint": "المدينة التي تنطلق منها هذه الرحلة.",
      "trip.startingCitySelected": "تم اختيار مدينة الانطلاق",
      "trip.country": "الدولة",
      "trip.city": "المدينة",
      "trip.selectCountry": "اختر الدولة…",
      "trip.selectCity": "اختر المدينة…",

      // Trip form — settings & destinations
      "trip.settingsDestinations": "الإعدادات والوجهات",

      // Trip form — trip type
      "trip.tripType": "نوع الرحلة",
      "trip.tripTypeHint": "اختر ما إذا كانت الرحلة تحتوي على باقات متعددة أو سعر واحد.",
      "trip.simpleTrip": "رحلة عادية",
      "trip.simpleTripDesc": "سعر واحد لجميع المشاركين",
      "trip.packagedTrip": "رحلة بباقات",
      "trip.packagedTripDesc": "باقات متعددة، كل منها بسعرها الخاص",

      // Trip form — price/policy section
      "trip.pricePolicyFields": "السعر والسياسة والحقول",
      "trip.pricePerPerson": "السعر للشخص (ريال)",
      "trip.pricePlaceholder": "مثال: 250",
      "trip.requiredParticipantFields": "الحقول المطلوبة للمشارك",
      "trip.requiredFieldsNote": "الاسم وتاريخ الميلاد مطلوبان دائماً.",
      "trip.provideOneLanguage": "أدخل المعلومات بلغة واحدة على الأقل (إنجليزي أو عربي)",
      "trip.optionalIfArabic": "اختياري إذا تم إدخال العربي",
      "trip.optionalIfEnglish": "اختياري إذا تم إدخال الإنجليزي",

      // Trip form — error banner
      "form.fixFollowing": "يرجى تصحيح ما يلي:",
      "form.uploadingImages": "جاري رفع الصور، يرجى الانتظار…",

      // Trip form — packages section
      "package.minRequired": "الحد الأدنى 2 مطلوب",
      "package.provideOneLanguage": "أدخل المعلومات بلغة واحدة على الأقل (إنجليزي أو عربي)",
      "package.nameEnOptional": "اختياري",
      "package.maxParticipants": "الحد الأقصى للمشاركين",
      "package.maxParticipantsPlaceholder": "مثال: 10",
      "package.pricePlaceholder": "مثال: 250",
      "package.refundable": "قابل للاسترداد",
      "package.amenities": "المرافق",
      "package.nameDOBAlwaysRequired": "الاسم وتاريخ الميلاد مطلوبان دائماً.",

      // Destinations selector
      "destinations.addDestination": "إضافة وجهة",
      "destinations.noDestinationsYet": "لم تتم إضافة وجهات بعد. يرجى إضافة وجهة واحدة على الأقل.",
      "destinations.loading": "جاري تحميل الوجهات…",
      "destinations.addButton": "+ إضافة وجهة",
      "destinations.adding": "جاري الإضافة…",
      "destinations.country": "الدولة",
      "destinations.city": "المدينة",
      "destinations.place": "المكان",
      "destinations.selectCountryPlaceholder": "— اختر الدولة —",
      "destinations.selectCityPlaceholder": "— اختر المدينة —",
      "destinations.selectPlacePlaceholder": "— اختر المكان —",

      // Validation config
      "validation.rulesFor": "قواعد التحقق — {{field}}",
      "validation.noOptions": "لا توجد خيارات تحقق متاحة لهذا النوع من الحقول.",
      "validation.configureHint": "قم بتكوين قواعد التحقق التي يجب أن يستوفيها المشاركون لهذا الحقل:",
      "validation.errors": "أخطاء التحقق:",
      "validation.currentConfig": "التكوين الحالي:",
      "validation.loading": "جاري تحميل خيارات التحقق…",

      // Trips list page
      "trips.totalCount_one": "{{count}} رحلة إجمالاً",
      "trips.totalCount_other": "{{count}} رحلة إجمالاً",
      "trips.searchPlaceholder": "ابحث عن رحلة...",
      "trips.filterAll": "الكل",
      "trips.filterActive": "نشط",
      "trips.filterInactive": "غير نشط",
      "trips.colTrip": "الرحلة",
      "trips.colDates": "التواريخ",
      "trips.colPrice": "السعر",
      "trips.colSeats": "المقاعد",
      "trips.colStatus": "الحالة",
      "trips.typePackaged": "بباقات",
      "trips.typeSimple": "عادية",
      "trips.pkg": "باقة",
      "trips.getStarted": "ابدأ بإنشاء رحلتك الأولى",

      // New/Edit trip pages
      "trip.createNew": "إنشاء رحلة جديدة",
      "trip.createNewSubtitle": "أدخل التفاصيل لإنشاء رحلة جديدة",
      "trip.editTrip": "تعديل الرحلة",
      "trip.viewDetails": "عرض التفاصيل",
      "trip.deleteTrip": "حذف الرحلة",
      "trip.cancelCreate": "إلغاء",
      "trip.loadingError": "حدث خطأ غير معروف أثناء جلب تفاصيل الرحلة.",
      "trip.notFound": "الرحلة غير موجودة.",
      "trip.goBack": "رجوع",

      // Layout
      "layout.providerPanel": "لوحة مقدم الخدمة",
      "layout.logoutConfirm": "تسجيل الخروج؟",
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
