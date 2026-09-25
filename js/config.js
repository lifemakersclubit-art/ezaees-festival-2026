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

  // Timeout BEFORE falling back to JSONP (ms).
  // A cold Apps Script execution was MEASURED at 7.4s, 28.9s and 30.6s on
  // the deployed /rows endpoint. The old 30s ceiling sat exactly on that
  // last measurement, so a large share of cold starts aborted themselves
  // and dropped the board into the slow per-filter path for the whole
  // session. 60s clears the observed worst case with headroom.
  FETCH_TIMEOUT_MS: 60000,

  // The row projection is the one call that must never be given up on: it
  // is fetched once and then answers every filter locally, forever. It gets
  // its own much longer budget, and it deliberately skips the JSONP hop
  // (which would pay for a SECOND cold execution) - see api.js.
  DATASET_FETCH_TIMEOUT_MS: 120000,

  // JSONP fallback timeout (ms). Generous because it usually pays for a
  // second, cold execution of its own.
  JSONP_TIMEOUT_MS: 45000,

  // One automatic retry on network/timeout failure. The retry almost
  // always hits a warm VM and succeeds in a couple of seconds.
  MAX_RETRIES: 1,

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