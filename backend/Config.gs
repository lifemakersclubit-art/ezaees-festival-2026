/**
 * ============================================================
 * Ezaees Festival 2026 — Registration Intelligence Dashboard
 * Backend Configuration
 * نوادي صناع الحياة بالجامعات المصرية
 * ============================================================
 *
 * Placement rules:
 * - SPREADSHEET_ID lives ONLY inside the backend (never in the frontend).
 * - This file is uploaded to the same Apps Script project as the rest of backend/.
 */

var CONFIG = {
  // Replace with your Google Sheet id (the long token in the sheet URL).
  SPREADSHEET_ID: '1a71v21nf6z3jF5jYrIjejSuMZQyZQCKZ-a0Ya4zbdwI',

  // The exact sheet (tab) name that holds the KoboToolbox export.
  SHEET_NAME: 'ALLDATA',

  // Short TTL: keeps the dashboard quasi-real-time without hammering Sheets.
  // Aggregates only. NEVER used for raw rows or PII.
  CACHE_TTL_SECONDS: 85,

  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 250,

  API_VERSION: '1.0.0'
};

/**
 * Supported API actions.
 */
var ACTION = {
  DASHBOARD: 'dashboard',
  ACTIVITIES: 'activities',
  GOVERNORATES: 'governorates',
  DAILY: 'daily',
  REGISTRATIONS: 'registrations'
};

/**
 * Canonical mapping of known columns.
 * The backend reads the header row dynamically; these keys are used to
 * consume columns that exist. Columns that do not exist are safely skipped.
 */
var COLUMNS = {
  SUBMISSION_ID: '_id',
  SUBMISSION_UUID: '_uuid',
  SUBMISSION_TIME: '_submission_time',
  NAME: 'الاسم رباعي',
  PHONE: 'رقم الموبايل المرتبط بواتساب',
  NATIONAL_ID: 'الرقم القومي',
  EMAIL: 'البريد الإلكتروني',
  ENGLISH_LEVEL: 'مستوى اللغة الإنجليزية',
  GOVERNORATE: 'المحافظة',
  EVENT_TYPE: 'نوع الفعالية',
  DAY: 'اختر اليوم المتاح',
  ACTIVITY: 'اختر الفعالية التي ترغب في حضورها'
};

/**
 * Only these columns are ever materialised into row objects.
 * Everything else (image attachments, validator fields, extra probes)
 * stays untouched and is never sent to the frontend.
 */
var EXPOSED_KEYS = [
  COLUMNS.SUBMISSION_ID,
  COLUMNS.SUBMISSION_UUID,
  COLUMNS.SUBMISSION_TIME,
  COLUMNS.NAME,
  COLUMNS.PHONE,
  COLUMNS.NATIONAL_ID,
  COLUMNS.EMAIL,
  COLUMNS.ENGLISH_LEVEL,
  COLUMNS.GOVERNORATE,
  COLUMNS.EVENT_TYPE,
  COLUMNS.DAY,
  COLUMNS.ACTIVITY
];

var CACHE_KEY_DASHBOARD = 'ezaees_dashboard_' + CONFIG.API_VERSION;