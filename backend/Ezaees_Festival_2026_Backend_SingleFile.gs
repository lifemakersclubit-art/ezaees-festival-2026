// ============================================================
// EZAEES Festival 2026 - Registration Intelligence Backend
// SINGLE FILE EDITION - paste ALL of this into Apps Script Code.gs
// GENERATED FILE - do not edit by hand.
// Source of truth: the modular files in backend/. Edit those, then re-bundle.
// Regenerate with: tools/build-backend.ps1
// ============================================================

// =================== SOURCE FILE: Config.gs (CONFIGURATION) ===================
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

  // 5 minutes: a cold Apps Script execution costs ~20s, so a long TTL is
  // what actually makes the board feel fast. The client revalidates
  // opportunistically and shows a spinner while it does.
  // Aggregates only. NEVER used for raw rows or PII.
  CACHE_TTL_SECONDS: 300,

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

/**
 * Filtered dashboard views are cached under their own key so that
 * applying a filter never overwrites the canonical unfiltered payload.
 */
var CACHE_KEY_DASHBOARD_FILTERED = 'ezaees_dash_f_' + CONFIG.API_VERSION;

// =================== SOURCE FILE: Utils.gs (SHARED UTILITIES) ===================
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

// =================== SOURCE FILE: DataService.gs (DATA ACCESS LAYER) ===================
/**
 * ============================================================
 * Ezaees Festival 2026 — Data Access Layer
 * ============================================================
 * Rules enforced here:
 * - Batch read only: getDataRange().getValues() — never cell-by-cell in loops.
 * - Header row is read dynamically; column count is never assumed.
 * - Only configured fields are surfaced into row objects.
 * - No caching of raw rows or PII.
 */

/**
 * Read the full grid from the configured sheet.
 * Returns { headers: [String], values: [[Any]] } or null on failure.
 */
function readSheet_() {
  if (CONFIG.SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID') {
    throw new Error('Backend is not configured: set SPREADSHEET_ID in Config.gs');
  }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet not found: "' + CONFIG.SHEET_NAME + '"');
  }

  var range = sheet.getDataRange();
  if (range.getNumRows() < 2) {
    return { headers: [], values: [] };
  }

  var values = range.getValues();
  var headers = values[0].map(String);

  // Drop phantom header columns (KoboToolbox exports often have trailing blanks).
  while (headers.length && headers[headers.length - 1].trim() === '') headers.pop();

  return { headers: headers, values: values };
}

/**
 * Materialise raw grid values into lightweight row objects
 * containing only the exposed fields. Am empty row (no core value)
 * is skipped.
 */
function readRows_() {
  var grid = readSheet_();
  var headers = grid.headers;
  var values = grid.values;

  if (!headers.length) return [];

  var idx = {};
  EXPOSED_KEYS.forEach(function (key) {
    idx[key] = asArrayIndex_(headers, key);
  });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var src = values[r];
    var row = {};

    EXPOSED_KEYS.forEach(function (key) {
      var i = idx[key];
      if (i >= 0 && i < src.length) {
        var v = src[i];
        row[key] = (v === '' || v === null || v === undefined) ? null : v;
      } else {
        row[key] = null;
      }
    });

    if (isUsableRow_(row)) rows.push(row);
  }

  return rows;
}

function isUsableRow_(row) {
  return !!(row[COLUMNS.NAME] ||
             row[COLUMNS.PHONE] ||
             row[COLUMNS.NATIONAL_ID] ||
             row[COLUMNS.SUBMISSION_TIME] ||
             row[COLUMNS.ACTIVITY]);
}

/**
 * Public data snapshot used by every analytics consumer.
 * In-memory only; one read per request (or served from the cache layer).
 */
function getRows_() {
  return readRows_();
}

// =================== SOURCE FILE: AnalyticsService.gs (ANALYTICS SERVICE) ===================
/**
 * ============================================================
 * Ezaees Festival 2026 — Analytics Service
 * ============================================================
 * All counting / grouping / aggregation / parsing happens here,
 * server-side. The browser never receives the raw dataset.
 */

/**
 * Dashboard payload: every aggregate the main page needs in ONE call.
 * Aggregates only — no PII, no images, no national IDs.
 */
function getDashboardPayload_(params) {
  var filters = readFilters_(params);
  var active = filtersActive_(filters);
  var cache = CacheService.getScriptCache();

  // Filtered views get their own cache slot so they never overwrite
  // the canonical unfiltered payload.
  var cacheKey = active
    ? CACHE_KEY_DASHBOARD_FILTERED + '_' + filterSignature_(filters)
    : CACHE_KEY_DASHBOARD;

  if (cache) {
    var cached = cache.get(cacheKey);
    if (cached) {
      try {
        var data = JSON.parse(cached);
        if (data && data.summary) return data;
      } catch (e) { /* stale/corrupt cache -> recompute */ }
    }
  }

  var payload = computeDashboard_(filters, readFilterEcho_(params));

  if (cache) {
    try {
      cache.put(cacheKey, JSON.stringify(payload), CONFIG.CACHE_TTL_SECONDS);
    } catch (e) { /* caching is an optimisation, never a source of truth */ }
  }

  return payload;
}

/**
 * Normalise the raw query-string filter values into a stable object.
 * Empty / "all" values collapse to '' so they are simply ignored.
 */
function readFilters_(params) {
  params = params || {};
  return {
    governorate: normalize_(params.governorate),
    activity: normalize_(params.activity),
    day: normalize_(params.day),
    eventType: normalize_(params.eventType),
    englishLevel: normalize_(params.englishLevel)
  };
}

/**
 * The ORIGINAL (trimmed) values as the client sent them, echoed back so the
 * UI can highlight the active filters without re-normalising Arabic text.
 */
function readFilterEcho_(params) {
  params = params || {};
  return {
    governorate: trimSafe_(params.governorate),
    activity: trimSafe_(params.activity),
    day: trimSafe_(params.day),
    eventType: trimSafe_(params.eventType),
    englishLevel: trimSafe_(params.englishLevel)
  };
}

function filtersActive_(filters) {
  return !!(
    filters.governorate || filters.activity || filters.day ||
    filters.eventType || filters.englishLevel
  );
}

/** Short, stable hash so cache keys stay well under the 250-char limit. */
function filterSignature_(filters) {
  var parts = [
    filters.governorate, filters.activity, filters.day,
    filters.eventType, filters.englishLevel
  ];
  var raw = parts.join('|');
  var h = 5381;
  for (var i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * Apply the active filter set to the row set.
 * All conditions are AND-ed. Shared by the dashboard and the
 * registrations page so both surfaces always agree on what "filtered" means.
 */
function applyFilters_(rows, filters) {
  if (!filtersActive_(filters)) return rows;

  return rows.filter(function (row) {
    if (filters.governorate && normalize_(trimSafe_(row[COLUMNS.GOVERNORATE])) !== filters.governorate) return false;
    if (filters.eventType && normalize_(trimSafe_(row[COLUMNS.EVENT_TYPE])) !== filters.eventType) return false;
    if (filters.englishLevel && normalize_(trimSafe_(row[COLUMNS.ENGLISH_LEVEL])) !== filters.englishLevel) return false;
    if (filters.day && !dayMatches_(row[COLUMNS.DAY], filters.day)) return false;
    if (filters.activity && !activityMatches_(row, filters.activity)) return false;
    return true;
  });
}

/**
 * Day values can be long free text ("25 سبتمبر 2026"), so match exactly
 * first and fall back to a containment test.
 */
function dayMatches_(value, dayNeedle) {
  var raw = trimSafe_(value);
  if (!raw) return false;
  var norm = normalize_(raw);
  if (norm === dayNeedle) return true;
  return contains_(raw, dayNeedle);
}

/**
 * Distinct values for every filter dropdown.
 * Always computed from the FULL row set so the dropdowns never
 * collapse to a single option once a filter is applied.
 */
function buildFilterOptions_(rows) {
  return {
    governorates: distinctValues_(rows, COLUMNS.GOVERNORATE),
    eventTypes: distinctValues_(rows, COLUMNS.EVENT_TYPE),
    englishLevels: distinctValues_(rows, COLUMNS.ENGLISH_LEVEL),
    days: distinctValues_(rows, COLUMNS.DAY),
    activities: distinctActivityNames_(rows)
  };
}

function distinctValues_(rows, column) {
  var seen = {};
  var out = [];
  rows.forEach(function (row) {
    var v = trimSafe_(row[column]);
    if (!v) return;
    var norm = normalize_(v);
    if (seen[norm]) return;
    seen[norm] = true;
    out.push(v);
  });
  out.sort(function (a, b) { return a.localeCompare(b, 'ar'); });
  return out;
}

function distinctActivityNames_(rows) {
  var seen = {};
  var out = [];
  rows.forEach(function (row) {
    var raw = row[COLUMNS.ACTIVITY];
    if (!raw) return;
    var parsed = parseActivity_(raw);
    if (!parsed) return;
    var name = trimSafe_(parsed.name);
    if (!name) return;
    var norm = normalize_(name);
    if (seen[norm]) return;
    seen[norm] = true;
    out.push(name);
  });
  out.sort(function (a, b) { return a.localeCompare(b, 'ar'); });
  return out;
}

function computeDashboard_(filters, echo) {
  filters = filters || readFilters_(null);
  echo = echo || {};

  var allRows = getRows_();
  var totalUnfiltered = allRows.length;

  var rows = applyFilters_(allRows, filters);
  var total = rows.length;

  var activities = aggregateActivities_(rows, total);
  var governorates = aggregateGovernorates_(rows, total);
  var daily = aggregateDaily_(rows);
  var englishLevels = aggregateByColumn_(rows, COLUMNS.ENGLISH_LEVEL, total);
  var eventTypes = aggregateByColumn_(rows, COLUMNS.EVENT_TYPE, total);

  var lastAt = findLastSubmission_(rows);
  var dateCounts = aggregateDailyCounts_(rows);

  return {
    success: true,
    demo: false,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRegistrations: total,
      totalUnfiltered: totalUnfiltered,
      isFiltered: filtersActive_(filters),
      uniqueActivities: activities.length,
      governorates: governorates.length,
      activeDays: dateCounts.length,
      lastSubmissionAt: lastAt
    },
    filters: echo,
    options: buildFilterOptions_(allRows),
    activities: activities,
    governorates: governorates,
    daily: daily,
    englishLevels: englishLevels,
    eventTypes: eventTypes
  };
}

/* ---------------------------------------------------------- *
 * Aggregations
 * ---------------------------------------------------------- */

function aggregateActivities_(rows, total) {
  var groups = {};

  rows.forEach(function (row) {
    var raw = row[COLUMNS.ACTIVITY];
    if (!raw) return;

    var parsed = parseActivity_(raw);
    var key = parsed ? parsed.name : null;
    if (!key) return;

    key = key.trim();
    if (!groups[key]) {
      var day = aggregateMode_(rows, key, COLUMNS.DAY);
      groups[key] = {
        name: key,
        date: day || null,
        time: parsed.time || null,
        location: parsed.location || null,
        language: parsed.language || null,
        duration: parsed.duration || null,
        org: parsed.org || null,
        count: 0
      };
    }
    groups[key].count += 1;
  });

  var list = Object.keys(groups).map(function (key) {
    var g = groups[key];
    g.percentage = percentOf_(g.count, total);
    return g;
  });

  list.sort(function (a, b) { return b.count - a.count; });
  return list;
}

function aggregateGovernorates_(rows, total) {
  var groups = {};
  var display = {};

  rows.forEach(function (row) {
    var name = trimSafe_(row[COLUMNS.GOVERNORATE]);
    if (!name) return;
    var norm = normalize_(name);
    groups[norm] = (groups[norm] || 0) + 1;
    display[norm] = name;
  });

  var list = Object.keys(groups).map(function (key) {
    var count = groups[key];
    return {
      name: display[key],
      count: count,
      percentage: percentOf_(count, total)
    };
  });

  list.sort(function (a, b) { return b.count - a.count; });
  return list;
}

function aggregateByColumn_(rows, column, total) {
  var groups = {};
  var display = {};

  rows.forEach(function (row) {
    var name = trimSafe_(row[column]);
    if (!name) return;
    var norm = normalize_(name);
    groups[norm] = (groups[norm] || 0) + 1;
    display[norm] = name;
  });

  var list = Object.keys(groups).map(function (key) {
    var count = groups[key];
    return {
      name: display[key],
      count: count,
      percentage: percentOf_(count, total)
    };
  });

  list.sort(function (a, b) { return b.count - a.count; });
  return list;
}

function aggregateDailyCounts_(rows) {
  var counts = {};
  rows.forEach(function (row) {
    var d = submissionDate_(row[COLUMNS.SUBMISSION_TIME]);
    if (!d) return;
    counts[d] = (counts[d] || 0) + 1;
  });

  var dates = Object.keys(counts).sort();
  return dates.map(function (date) {
    return { date: date, count: counts[date] };
  });
}

function aggregateDaily_(rows) {
  var buckets = aggregateDailyCounts_(rows);
  return buckets.map(function (b) {
    return { date: b.date, count: b.count };
  });
}

function findLastSubmission_(rows) {
  var last = null;
  rows.forEach(function (row) {
    var t = normalizeTimestamp_(row[COLUMNS.SUBMISSION_TIME]);
    if (t && t > String(last || '')) last = t;
  });
  return last;
}

/**
 * Most frequent value of `column` among rows whose activity key equals `name`.
 */
function aggregateMode_(rows, activityName, column) {
  var buckets = {};
  rows.forEach(function (row) {
    if (!row[COLUMNS.ACTIVITY]) return;
    var p = parseActivity_(row[COLUMNS.ACTIVITY]);
    if (!p || p.name.trim() !== activityName) return;
    var v = trimSafe_(row[column]);
    if (!v) return;
    buckets[v] = (buckets[v] || 0) + 1;
  });

  var best = { value: null, count: 0 };
  Object.keys(buckets).forEach(function (key) {
    if (buckets[key] > best.count) best = { value: key, count: buckets[key] };
  });
  return best.value;
}

/* ---------------------------------------------------------- *
 * Activity text parser
 * ---------------------------------------------------------- *
 * Input format (per registration):
 *   Underdogs + حفل الختام
 *   9:00 مساءً
 *   مسرح الهناجر
 *   غير ناطق – 55 دقيقة
 *   Editta Braun - Austria
 *
 * Never invents values: anything that can't be safely extracted => null.
 */
function parseActivity_(text) {
  if (!text) return null;

  // The same activity block repeats across many rows, and parsing it is
  // regex-heavy. Memoising per request turns O(rows) parses into
  // O(distinct activities). Reset on every request so nothing leaks
  // between them.
  var key = String(text);
  var memo = activityMemo_();
  if (Object.prototype.hasOwnProperty.call(memo, key)) return memo[key];

  var parsed = parseActivityUncached_(key);
  memo[key] = parsed;
  return parsed;
}

var ACTIVITY_MEMO_ = null;

function activityMemo_() {
  if (!ACTIVITY_MEMO_) ACTIVITY_MEMO_ = {};
  return ACTIVITY_MEMO_;
}

/** Called once per HTTP request. */
function resetRequestState_() {
  ACTIVITY_MEMO_ = null;
}

function parseActivityUncached_(text) {
  if (!text) return null;

  var lines = String(text)
    .split(/\r?\n/)
    .map(trimSafe_)
    .filter(function (l) { return l; });

  if (!lines.length) return null;

  var result = {
    name: lines[0],
    time: null,
    location: null,
    language: null,
    duration: null,
    org: null
  };

  var rest = lines.slice(1);
  var timeIdx = -1;
  var timeVal = null;
  var langIdx = -1;

  for (var i = 0; i < rest.length; i++) {
    var line = rest[i];
    var t = matchTime_(line);
    if (t && timeIdx === -1) {
      timeIdx = i;
      timeVal = t;
      continue;
    }
    if (isDurationLine_(line) && langIdx === -1) {
      langIdx = i;
      var langDur = parseLangDuration_(line);
      result.language = langDur.language;
      result.duration = langDur.duration;
    }
  }

  result.time = timeVal;

  // Location: first venue-like line before the language/duration line,
  // else the line right after the time line, else the first free line.
  var locationIdx = -1;
  for (var j = 0; j < rest.length; j++) {
    if (j === timeIdx || j === langIdx) continue;
    if (langIdx !== -1 && j > langIdx) break;
    if (isVenueLine_(rest[j])) { locationIdx = j; break; }
  }
  if (locationIdx === -1) {
    if (timeIdx !== -1) locationIdx = timeIdx + 1;
    else locationIdx = 0;
  }
  if (locationIdx !== -1 && locationIdx < rest.length) {
    result.location = rest[locationIdx];
  }

  // Organisation: the first remaining line (usually the last one).
  for (var k = rest.length - 1; k >= 0; k--) {
    if (k === timeIdx || k === langIdx || k === locationIdx) continue;
    result.org = rest[k];
    break;
  }

  return result;
}

function matchTime_(line) {
  var m = /(\d{1,2})\s*[:.]\s*(\d{1,2})\b\s*([Aa]?[Pp]?[\s:]*(صباحا|صباحاً|مساءً|مساءا|مساء))?/.exec(line);
  if (!m) return null;

  var hh = m[1];
  var mm = m[2].length === 1 ? '0' + m[2] : m[2];
  var period = m[4] ? (m[4].indexOf('مساء') !== -1 ? 'مساءً' : 'صباحًا') : '';
  return hh + ':' + mm + (period ? ' ' + period : '');
}

function isDurationLine_(line) {
  return /دقيقة|min\b/.test(line);
}

function isVenueLine_(line) {
  return /(مسرح|قاعة|ساحة|استوديو|ستوديو|أوبرا|دار|مركز|مسرح الهناجر|مسرح السامر)/.test(line);
}

function parseLangDuration_(line) {
  var parts = line.split(/[–—\-·•|]/);
  var out = { language: null, duration: null };

  for (var i = 0; i < parts.length; i++) {
    var part = trimSafe_(parts[i]);
    if (!part) continue;
    if (/^\d+\s*دقيقة/.test(part) || /دقيقة/.test(part)) {
      out.duration = part;
    } else {
      out.language = out.language || part;
    }
  }

  // No dash at all but clearly "العربية 75 دقيقة".
  if (!out.duration) {
    var m = /(\d{1,3})\s*دقيقة/.exec(line);
    if (m) out.duration = m[1] + ' دقيقة';
  }

  return out;
}

/* ---------------------------------------------------------- *
 * Registrations: server-side search, filters, pagination
 * ---------------------------------------------------------- */

function getRegistrationsPage_(params) {
  var rows = getRows_();
  var page = clamp_(params.page, 1, 100000);
  var pageSize = clamp_(
    params.pageSize,
    1,
    CONFIG.MAX_PAGE_SIZE
  );

  var search = normalize_(params.search);

  // Same filter semantics as the dashboard: one shared implementation.
  var filtered = applyFilters_(rows, readFilters_(params)).filter(function (row) {
    if (search && !rowMatchesSearch_(row, search)) return false;
    return true;
  });

  // Newest submissions first.
  filtered.sort(function (a, b) {
    var ta = normalizeTimestamp_(a[COLUMNS.SUBMISSION_TIME]) || '';
    var tb = normalizeTimestamp_(b[COLUMNS.SUBMISSION_TIME]) || '';
    if (ta !== tb) return ta < tb ? 1 : -1;
    var ia = String(a[COLUMNS.SUBMISSION_ID] || '');
    var ib = String(b[COLUMNS.SUBMISSION_ID] || '');
    return (ia || '') < (ib || '') ? 1 : -1;
  });

  var total = filtered.length;
  var totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) page = totalPages;

  var start = (page - 1) * pageSize;
  var slice = filtered.slice(start, start + pageSize);

  var rowsOut = slice.map(registrationsRowDto_);

  return {
    success: true,
    demo: false,
    generatedAt: new Date().toISOString(),
    page: page,
    pageSize: pageSize,
    total: total,
    totalPages: totalPages,
    rows: rowsOut
  };
}

function activityMatches_(row, activityNeedle) {
  var raw = row[COLUMNS.ACTIVITY];
  if (contains_(raw, activityNeedle)) return true;
  var parsed = parseActivity_(raw);
  return parsed && contains_(parsed.name, activityNeedle);
}

function rowMatchesSearch_(row, needle) {
  return contains_(row[COLUMNS.NAME], needle) ||
    contains_(row[COLUMNS.PHONE], needle) ||
    contains_(row[COLUMNS.EMAIL], needle) ||
    contains_(row[COLUMNS.GOVERNORATE], needle) ||
    contains_(row[COLUMNS.EVENT_TYPE], needle) ||
    contains_(row[COLUMNS.DAY], needle) ||
    contains_(row[COLUMNS.ACTIVITY], needle);
}

/**
 * Public row DTO: PII is masked server-side, images never leave the sheet.
 */
function registrationsRowDto_(row) {
  var parsed = null;
  if (row[COLUMNS.ACTIVITY]) parsed = parseActivity_(row[COLUMNS.ACTIVITY]);
  var subTime = normalizeTimestamp_(row[COLUMNS.SUBMISSION_TIME]);

  return {
    _id: row[COLUMNS.SUBMISSION_ID],
    submissionTime: subTime || null,
    name: row[COLUMNS.NAME],
    phone: maskPhone_(row[COLUMNS.PHONE]),
    nationalId: maskNationalId_(row[COLUMNS.NATIONAL_ID]),
    email: maskEmail_(row[COLUMNS.EMAIL]),
    englishLevel: row[COLUMNS.ENGLISH_LEVEL],
    governorate: row[COLUMNS.GOVERNORATE],
    eventType: row[COLUMNS.EVENT_TYPE],
    day: row[COLUMNS.DAY],
    activity: parsed
  };
}

function trimSafe_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function submissionDate_(value) {
  var s = normalizeTimestamp_(value);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s.slice(0, 10);
}

// =================== SOURCE FILE: Code.gs (API ENTRY POINT (ROUTER)) ===================
/**
 * ============================================================
 * Ezaees Festival 2026 — API Entry Point (Router)
 * ============================================================
 * Web App exposed via ContentService.
 *
 * Endpoints:
 *   GET ?action=dashboard             -> all dashboard aggregates (one call)
 *   GET ?action=activities            -> activity analytics slice
 *   GET ?action=governorates          -> geographic slice
 *   GET ?action=daily                 -> daily registration trend
 *   GET ?action=registrations&...     -> server-side search/filter/pagination
 *
 * Every endpoint accepts an optional `callback` parameter (JSONP) so the
 * frontend can talk to this API even from the file:// protocol.
 */

function doGet(e) {
  return route_(e ? e.parameter : {}, e);
}

function doPost(e) {
  var body = {};
  if (e && e.postData && e.postData.contents) {
    try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  }
  return route_(body, e);
}

function route_(params, e) {
  resetRequestState_();
  try {
    var action = String(params.action || ACTION.DASHBOARD).toLowerCase();

    switch (action) {
      case ACTION.DASHBOARD:
        return response_(getDashboardPayload_(params), params.callback);

      case ACTION.ACTIVITIES: {
        var payload = getDashboardPayload_(params);
        return response_({
          success: true,
          demo: payload.demo,
          generatedAt: payload.generatedAt,
          activities: payload.activities
        }, params.callback);
      }

      case ACTION.GOVERNORATES: {
        var gPayload = getDashboardPayload_(params);
        return response_({
          success: true,
          demo: gPayload.demo,
          generatedAt: gPayload.generatedAt,
          governorates: gPayload.governorates
        }, params.callback);
      }

      case ACTION.DAILY: {
        var dPayload = getDashboardPayload_(params);
        return response_({
          success: true,
          demo: dPayload.demo,
          generatedAt: dPayload.generatedAt,
          daily: dPayload.daily
        }, params.callback);
      }

      case ACTION.REGISTRATIONS:
        return response_(getRegistrationsPage_(params), params.callback);

      default:
        return response_(errorPayload_('Unknown action: ' + action), params.callback);
    }
  } catch (err) {
    return response_(errorPayload_(String(err && err.message ? err.message : err)), params.callback);
  }
}

