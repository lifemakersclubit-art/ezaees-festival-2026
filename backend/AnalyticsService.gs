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
function getDashboardPayload_() {
  var cache = CacheService.getScriptCache();

  if (cache) {
    var cached = cache.get(CACHE_KEY_DASHBOARD);
    if (cached) {
      try {
        var data = JSON.parse(cached);
        if (data && data.summary) return data;
      } catch (e) { /* stale/corrupt cache -> recompute */ }
    }
  }

  var payload = computeDashboard_();

  if (cache) {
    try {
      cache.put(CACHE_KEY_DASHBOARD, JSON.stringify(payload), CONFIG.CACHE_TTL_SECONDS);
    } catch (e) { /* caching is an optimisation, never a source of truth */ }
  }

  return payload;
}

function computeDashboard_() {
  var rows = getRows_();
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
      uniqueActivities: activities.length,
      governorates: governorates.length,
      activeDays: dateCounts.length,
      lastSubmissionAt: lastAt
    },
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
  var gov = normalize_(params.governorate);
  var eventType = normalize_(params.eventType);
  var englishLevel = normalize_(params.englishLevel);
  var day = normalize_(params.day);
  var activity = normalize_(params.activity);

  var filtered = rows.filter(function (row) {
    if (gov && normalize_(trimSafe_(row[COLUMNS.GOVERNORATE])) !== gov) return false;
    if (eventType && normalize_(trimSafe_(row[COLUMNS.EVENT_TYPE])) !== eventType) return false;
    if (englishLevel && normalize_(trimSafe_(row[COLUMNS.ENGLISH_LEVEL])) !== englishLevel) return false;
    if (day && !contains_(trimSafe_(row[COLUMNS.DAY]), day)) return false;
    if (activity && !activityMatches_(row, activity)) return false;

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