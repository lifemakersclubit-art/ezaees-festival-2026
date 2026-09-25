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