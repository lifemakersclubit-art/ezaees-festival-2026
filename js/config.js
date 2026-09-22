/**
 * ============================================================
 * Ezaees Festival 2026 — API Configuration (Frontend)
 * ============================================================
 * Put your deployed Google Apps Script Web App URL here.
 * See GOOGLE_APPS_SCRIPT_SETUP.md for the deployment steps.
 *
 * The spreadsheet id never appears in the frontend —
 * it lives only in backend/Config.gs.
 */

var API_CONFIG = {
  // Example: "https://script.google.com/macros/s/AKfycb.../exec"
  BASE_URL: 'https://script.google.com/macros/s/AKfycbxipbQpoLIJPJm0oyzR8GU4MWxnh3-NfPuK2feJFBZGCOFfhMqRrIWoM9-KrgBztGaU/exec',

  DEFAULT_PAGE_SIZE: 50,

  // Timeout BEFORE falling back to JSONP (ms). Keep it small.
  FETCH_TIMEOUT_MS: 12000,

  // JSONP fallback timeout (ms).
  JSONP_TIMEOUT_MS: 25000,

  // Debug only: set to true to exercise the clearly-labelled demo path
  // instead of hitting the API. NEVER ship with this enabled.
  DEMO_MODE: false
};

/** Semi-displayed banners/strings kept in one place for consistency. */
var UI_TEXT = {
  APP_NAME: 'EZAEES',
  FESTIVAL: 'FESTIVAL 2026',
  TAGLINE: 'Registration Intelligence',
  SUBTITLE: 'نوادي صناع الحياة بالجامعات المصرية',
  ERROR_TITLE: 'تعذر الاتصال ببيانات التسجيلات',
  ERROR_BODY: 'حاول تحديث الصفحة مرة أخرى.',
  DEMO_BADGE: 'بيانات تجريبية — للعرض فقط'
};