/**
 * ============================================================
 * Ezaees Festival 2026 — Backend Utilities
 * ============================================================
 * Masking, Arabic-aware normalization, safe JSONP/JSON responses,
 * small generic helpers. No Spreadsheet access lives here.
 */

/**
 * Wrap an object into a ContentService response, honouring JSONP
 * when a `callback` parameter is present.
 *
 * JSONP matters: it lets the frontend talk to this API even from the
 * file:// protocol if the plain fetch() path hits a CORS edge case.
 */
function response_(payload, callback) {
  var json = JSON.stringify(payload);
  var callbackParam = callback ? String(callback).replace(/[^A-Za-z0-9_.]/g, '') : null;

  if (callbackParam) {
    return ContentService.createTextOutput(callbackParam + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Build an error payload.
 */
function errorPayload_(message) {
  return {
    success: false,
    error: message || 'Unknown error',
    generatedAt: new Date().toISOString()
  };
}

/**
 * Strip every character that is neither a digit nor a leading +.
 */
function digitsOnly_(value) {
  var s = String(value == null ? '' : value);
  return s.replace(/[^0-9+]/g, '');
}

function keepDigits_(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

/**
 * National ID masking — example: 29801232400791 -> 298012******791
 * Keeps first 6 and last 3 characters, masks the middle.
 */
function maskNationalId_(value) {
  var s = keepDigits_(value);
  if (s.length <= 9) {
    return s.length ? '***' : null;
  }
  return s.slice(0, 6) + maskMiddle_(s.length - 9) + s.slice(-3);
}

/**
 * Phone masking — example: 010326606360 -> 0103******60
 * Keeps first 4 and last 2 characters, masks the middle.
 */
function maskPhone_(value) {
  var s = digitsOnly_(value).replace(/^\+/, '');
  if (s.length <= 6) {
    return s.length ? '***' : null;
  }
  return s.slice(0, 4) + maskMiddle_(s.length - 6) + s.slice(-2);
}

/**
 * Email masking — example: a******@gmail.com
 */
function maskEmail_(value) {
  var s = String(value == null ? '' : value).trim();
  if (!s) return null;
  var at = s.lastIndexOf('@');
  if (at <= 0) return '***';
  var local = s.slice(0, at);
  var domain = s.slice(at);
  return local.charAt(0) + '******' + domain;
}

function maskMiddle_(count) {
  var stars = '';
  for (var i = 0; i < count; i++) stars += '*';
  return stars;
}

/**
 * Normalise a sheet value into an ISO-ish timestamp string
 * "YYYY-MM-DD HH:MM:SS".
 * Handles both plain text values and real Date objects — KoboToolbox
 * exports sometimes store _submission_time as an actual date cell.
 */
function normalizeTimestamp_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return String(value == null ? '' : value).trim();
}

/**
 * Arabic-aware, diacritic-free normalization used by server-side search.
 * Unifies alef forms, taa marbuta, and yaa forms so a user can type
 * loosely (محمد / محمد) and still match.
 */
function normalize_(value) {
  var s = String(value == null ? '' : value).toLowerCase();
  s = s.replace(/[\u064B-\u0652\u0670]/g, '');             // tashkeel
  s = s.replace(/[أإآا]/g, '\u0627');                       // alef -> ا
  s = s.replace(/[\u0629]/g, '\u0647');                     // ة -> ه
  s = s.replace(/[\u0649\u064A]/g, '\u064A');               // ى/ي -> ي
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function contains_(haystack, needleNormalized) {
  if (!needleNormalized) return true;
  return normalize_(haystack).indexOf(needleNormalized) !== -1;
}

/**
 * Percent with a single decimal.
 */
function percentOf_(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function clamp_(value, min, max) {
  value = parseInt(value, 10);
  if (isNaN(value)) value = min;
  if (value < min) value = min;
  if (value > max) value = max;
  return value;
}

function asArrayIndex_(headers, name) {
  return headers.indexOf(name);
}