/**
 * ============================================================
 * Ezaees Festival 2026 — Client-side Filter Engine
 * ============================================================
 * Port of the backend aggregation (AnalyticsService.gs) so the browser can
 * re-aggregate the whole dataset locally.
 *
 * Why this exists: every filter combination used to be its own Apps Script
 * request, and those measured 2-25s with occasional hard 404s from Google.
 * The dataset is small (tens to low thousands of rows), so the browser pulls
 * the projected columns once and then every subsequent filter is a pure
 * in-memory pass — effectively 0ms, and it works offline.
 *
 * These functions MUST stay behaviourally identical to their `_`-suffixed
 * backend twins; tests/fixtures compare the two outputs directly.
 */

var FilterEngine = (function () {
  'use strict';

  var F = {
    GOVERNORATE: 0,
    EVENT_TYPE: 1,
    ENGLISH_LEVEL: 2,
    DAY: 3,
    ACTIVITY_NAME: 4,
    ACTIVITY_TIME: 5,
    ACTIVITY_LOCATION: 6,
    ACTIVITY_LANGUAGE: 7,
    ACTIVITY_DURATION: 8,
    ACTIVITY_ORG: 9,
    SUBMITTED_AT: 10
  };

  /* ---------------- normalization (mirrors Utils.gs) ---------------- */

  function trimSafe(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function normalize(value) {
    var s = String(value === null || value === undefined ? '' : value).toLowerCase();
    s = s.replace(/[\u064B-\u0652\u0670]/g, '');        // tashkeel
    s = s.replace(/[أإآا]/g, '\u0627');                  // alef forms
    s = s.replace(/ة/g, 'ه');                 // taa marbuta
    s = s.replace(/[ىي]/g, 'ي');   // yaa / alef maqsura
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function percentOf(count, total) {
    if (!total) return 0;
    return Math.round((count / total) * 1000) / 10;
  }

  /**
   * Submission timestamps arrive as "YYYY-MM-DD HH:MM:SS" text. Day buckets
   * use the date part only.
   */
  function submissionDate(value) {
    var t = trimSafe(value);
    if (!t) return null;
    return t.slice(0, 10) || null;
  }

  function dayMatches(value, dayNeedle) {
    var raw = trimSafe(value);
    if (!raw) return false;
    if (normalize(raw) === dayNeedle) return true;
    return normalize(raw).indexOf(dayNeedle) !== -1;
  }

  /* ---------------- filtering (mirrors applyFilters_) ---------------- */

  function emptyFilters() {
    return { governorate: '', activity: '', day: '', eventType: '', englishLevel: '' };
  }

  function filtersActive(filters) {
    return !!(filters && (
      filters.governorate || filters.activity ||
      filters.day || filters.eventType || filters.englishLevel
    ));
  }

  /**
   * All conditions AND-ed, exactly like the backend. Returns the subset of
   * `rows` that survives.
   *
   * Filter values arrive in their DISPLAY form ("القاهرة"), so each one is
   * normalized before comparing — the backend does the same, which is what
   * lets a user pick "أسيوط" and still match a row spelled "اسيوط".
   */
  function applyFilters(rows, filters) {
    if (!filtersActive(filters)) return rows;

    var f = {
      governorate: filters.governorate ? normalize(filters.governorate) : '',
      eventType: filters.eventType ? normalize(filters.eventType) : '',
      englishLevel: filters.englishLevel ? normalize(filters.englishLevel) : '',
      day: filters.day ? normalize(filters.day) : '',
      activity: filters.activity ? normalize(filters.activity) : ''
    };

    return rows.filter(function (row) {
      if (f.governorate && normalize(trimSafe(row[F.GOVERNORATE])) !== f.governorate) return false;
      if (f.eventType && normalize(trimSafe(row[F.EVENT_TYPE])) !== f.eventType) return false;
      if (f.englishLevel && normalize(trimSafe(row[F.ENGLISH_LEVEL])) !== f.englishLevel) return false;
      if (f.day && !dayMatches(row[F.DAY], f.day)) return false;
      if (f.activity) {
        var act = normalize(trimSafe(row[F.ACTIVITY_NAME]));
        if (act !== f.activity && act.indexOf(f.activity) === -1) return false;
      }
      return true;
    });
  }

  /* ---------------- aggregations (mirrors the backend) ---------------- */

  function aggregateActivities(rows, total) {
    var groups = {};
    var order = [];

    rows.forEach(function (row) {
      var name = trimSafe(row[F.ACTIVITY_NAME]);
      if (!name) return;

      if (!groups[name]) {
        groups[name] = {
          name: name,
          date: modeOf(rows, name, F.DAY),
          time: trimSafe(row[F.ACTIVITY_TIME]) || null,
          location: trimSafe(row[F.ACTIVITY_LOCATION]) || null,
          language: trimSafe(row[F.ACTIVITY_LANGUAGE]) || null,
          duration: trimSafe(row[F.ACTIVITY_DURATION]) || null,
          org: trimSafe(row[F.ACTIVITY_ORG]) || null,
          count: 0
        };
        order.push(name);
      }
      groups[name].count += 1;
    });

    var list = order.map(function (name) {
      var g = groups[name];
      g.date = g.date || null;
      g.percentage = percentOf(g.count, total);
      return g;
    });

    list.sort(function (a, b) { return b.count - a.count; });
    return list;
  }

  /** Most frequent value in `field` among rows belonging to `activityName`. */
  function modeOf(rows, activityName, field) {
    var buckets = {};
    rows.forEach(function (row) {
      if (trimSafe(row[F.ACTIVITY_NAME]) !== activityName) return;
      var v = trimSafe(row[field]);
      if (!v) return;
      buckets[v] = (buckets[v] || 0) + 1;
    });

    var best = { value: null, count: 0 };
    Object.keys(buckets).forEach(function (key) {
      if (buckets[key] > best.count) best = { value: key, count: buckets[key] };
    });
    return best.value;
  }

  function aggregateByField(rows, field, total) {
    var groups = {};
    var display = {};

    rows.forEach(function (row) {
      var name = trimSafe(row[field]);
      if (!name) return;
      var norm = normalize(name);
      groups[norm] = (groups[norm] || 0) + 1;
      display[norm] = name;
    });

    var list = Object.keys(groups).map(function (key) {
      var count = groups[key];
      return { name: display[key], count: count, percentage: percentOf(count, total) };
    });

    list.sort(function (a, b) { return b.count - a.count; });
    return list;
  }

  function aggregateDailyCounts(rows) {
    var counts = {};
    rows.forEach(function (row) {
      var d = submissionDate(row[F.SUBMITTED_AT]);
      if (!d) return;
      counts[d] = (counts[d] || 0) + 1;
    });

    return Object.keys(counts).sort().map(function (date) {
      return { date: date, count: counts[date] };
    });
  }

  function findLastSubmission(rows) {
    var last = null;
    rows.forEach(function (row) {
      var t = trimSafe(row[F.SUBMITTED_AT]);
      if (t && t > String(last || '')) last = t;
    });
    return last;
  }

  /**
   * Full dashboard payload for one filter set — the same shape the backend
   * would have returned, so `render()` needs to know nothing about where
   * the numbers came from.
   */
  function buildPayload(dataset, filters, generatedAt) {
    filters = filters || emptyFilters();
    var rows = applyFilters(dataset.rows, filters);
    var total = rows.length;
    var active = filtersActive(filters);

    var activities = aggregateActivities(rows, total);
    var dateCounts = aggregateDailyCounts(rows);

    return {
      success: true,
      demo: false,
      local: true,
      generatedAt: generatedAt || dataset.generatedAt,
      summary: {
        totalRegistrations: total,
        totalUnfiltered: dataset.totalUnfiltered,
        isFiltered: active,
        uniqueActivities: activities.length,
        governorates: aggregateByField(rows, F.GOVERNORATE, total).length,
        activeDays: dateCounts.length,
        lastSubmissionAt: findLastSubmission(rows)
      },
      // Echo the filters in their normalized form, matching what the backend
      // would have received, so `renderFilterStatus()` reads them correctly.
      filters: {
        governorate: filters.governorate ? normalize(filters.governorate) : '',
        activity: filters.activity ? normalize(filters.activity) : '',
        day: filters.day ? normalize(filters.day) : '',
        eventType: filters.eventType ? normalize(filters.eventType) : '',
        englishLevel: filters.englishLevel ? normalize(filters.englishLevel) : ''
      },
      // Options always come from the FULL row set, so dropdowns never
      // collapse to a single choice once a filter is applied.
      options: dataset.options,
      activities: activities,
      governorates: aggregateByField(rows, F.GOVERNORATE, total),
      daily: dateCounts.map(function (b) { return { date: b.date, count: b.count }; }),
      englishLevels: aggregateByField(rows, F.ENGLISH_LEVEL, total),
      eventTypes: aggregateByField(rows, F.EVENT_TYPE, total)
    };
  }

  return {
    F: F,
    emptyFilters: emptyFilters,
    filtersActive: filtersActive,
    normalize: normalize,
    buildPayload: buildPayload,
    applyFilters: applyFilters
  };
})();
