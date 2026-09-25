/**
 * ============================================================
 * Ezaees Festival 2026 — API Client
 * ============================================================
 * Smart transport that works from ANY origin:
 *   1. fetch() with a timeout  (Google Apps Script anonymous Web Apps
 *      answer with Access-Control-Allow-Origin: *).
 *   2. If that fails (some proxies / strict browsers), fall back to
 *      JSONP via <script> injection — the backend honours a
 *      `callback=` parameter.
 *
 * The frontend never stores the dataset; every call returns small
 * aggregations or one page of rows.
 */

var API = (function () {
  'use strict';

  function buildUrl(action, params) {
    var url = API_CONFIG.BASE_URL;
    var qs = [];
    qs.push('action=' + encodeURIComponent(action));

    if (params) {
      Object.keys(params).forEach(function (key) {
        var v = params[key];
        if (v === undefined || v === null || v === '') return;
        qs.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
      });
    }

    return url + (url.indexOf('?') === -1 ? '?' : '&') + qs.join('&');
  }

  function fetchJSON(action, params) {
    var url = buildUrl(action, params);
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;

    if (controller) {
      timer = setTimeout(function () { controller.abort(); }, API_CONFIG.FETCH_TIMEOUT_MS);
    }

    return fetch(url, { signal: controller ? controller.signal : undefined, cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        clearTimeout(timer);
        return data;
      })
      .catch(function (err) {
        clearTimeout(timer);
        throw err;
      });
  }

  function jsonp(action, params) {
    return new Promise(function (resolve, reject) {
      var cbName = '__ezaees_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
      var script = document.createElement('script');
      var timer = null;
      var settled = false;

      function cleanup() {
        if (timer) clearTimeout(timer);
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      function done(fn, value) {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      }

      window[cbName] = function (payload) { done(resolve, payload); };
      script.onerror = function () { done(reject, new Error('JSONP network error')); };

      timer = setTimeout(function () {
        done(reject, new Error('JSONP timeout'));
      }, API_CONFIG.JSONP_TIMEOUT_MS);

      script.src = buildUrl(action, params) + '&callback=' + encodeURIComponent(cbName);
      script.async = true;
      document.head.appendChild(script);
    });
  }

  /**
   * Public: GET an action. Tries fetch, falls back to JSONP, and retries
   * once on failure — a cold Apps Script VM routinely needs 20s+, so a
   * single cold failure must not surface as a broken dashboard.
   * Returns a Promise resolving to the parsed payload object.
   */
  function get(action, params) {
    if (API_CONFIG.DEMO_MODE) {
      return importDemoData(action, params);
    }

    var retries = typeof API_CONFIG.MAX_RETRIES === 'number' ? API_CONFIG.MAX_RETRIES : 1;

    function attempt(remaining) {
      return fetchJSON(action, params)
        .catch(function () { return jsonp(action, params); })
        .catch(function (err) {
          if (remaining <= 0) throw err;
          return attempt(remaining - 1);
        });
    }

    return attempt(retries);
  }

  /**
   * Begin the dashboard request as early as the script tag allows, so the
   * ~20s cold start overlaps page rendering instead of starting after it.
   * The returned promise is the one controllers should await.
   */
  function prefetch(action, params) {
    var p = get(action, params);
    window.__EZAEES_PREFETCH__ = p;
    return p;
  }

  /**
   * Backstop helper: is this payload an explicit API error object?
   */
  function isError(payload) {
    return !payload || payload.success === false;
  }

  return {
    get: get,
    prefetch: prefetch,
    buildUrl: buildUrl,
    isError: isError
  };
})();

/**
 * Clearly-labelled DEMO fallback. Isolated on purpose:
 * it exists only for development/preview and is never part of the
 * real data pipeline. Every surface renders a "بيانات تجريبية" badge.
 */
function importDemoData(action, params) {
  var demo = window.__EZAEES_DEMO__;
  if (!demo) {
    return Promise.reject(new Error('Demo data not built'));
  }

  var payload = { success: true, demo: true, generatedAt: new Date().toISOString() };

  if (action === 'dashboard' || action === 'activities' || action === 'governorates' || action === 'daily') {
    return Promise.resolve(buildDemoDashboard_(demo, params));
  }

  if (action === 'registrations') {
    var q = String(params.search || '').toLowerCase();
    var rows = demo.rows.filter(function (r) {
      if (params.governorate && r.governorate !== params.governorate) return false;
      if (params.eventType && r.eventType !== params.eventType) return false;
      if (params.englishLevel && r.englishLevel !== params.englishLevel) return false;
      if (params.day && r.day !== params.day) return false;
      if (params.activity && !(r.activity && r.activity.name === params.activity)) return false;
      if (q) {
        var hay = (r.name + ' ' + (r.governorate || '') + ' ' + (r.phone || '') + ' ' + (r.email || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var page = parseInt(params.page || '1', 10) || 1;
    var size = parseInt(params.pageSize || '50', 10) || 50;
    var start = (page - 1) * size;

    payload.page = page;
    payload.pageSize = size;
    payload.total = rows.length;
    payload.totalPages = Math.max(1, Math.ceil(rows.length / size));
    payload.rows = rows.slice(start, start + size);
    return Promise.resolve(payload);
  }

  return Promise.reject(new Error('Unknown demo action: ' + action));
}

/* ---------------------------------------------------------- *
 * Demo dashboard with the same filter semantics as the backend
 * ---------------------------------------------------------- */

function demoNormalize_(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[أإآ]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function demoGroup_(rows, pick) {
  var map = {};
  rows.forEach(function (r) {
    var v = pick(r);
    if (!v) return;
    map[v] = (map[v] || 0) + 1;
  });

  var total = rows.length || 1;
  return Object.keys(map).map(function (name) {
    return {
      name: name,
      count: map[name],
      percentage: Math.round((map[name] / total) * 1000) / 10
    };
  }).sort(function (a, b) { return b.count - a.count; });
}

function buildDemoDashboard_(demo, params) {
  params = params || {};
  var allRows = demo.rows || [];

  var filters = {
    governorate: demoNormalize_(params.governorate),
    activity: demoNormalize_(params.activity),
    day: demoNormalize_(params.day),
    eventType: demoNormalize_(params.eventType),
    englishLevel: demoNormalize_(params.englishLevel)
  };
  var active = !!(filters.governorate || filters.activity || filters.day ||
    filters.eventType || filters.englishLevel);

  var rows = allRows.filter(function (r) {
    if (filters.governorate && demoNormalize_(r.governorate) !== filters.governorate) return false;
    if (filters.eventType && demoNormalize_(r.eventType) !== filters.eventType) return false;
    if (filters.englishLevel && demoNormalize_(r.englishLevel) !== filters.englishLevel) return false;
    if (filters.day && demoNormalize_(r.day) !== filters.day) return false;
    if (filters.activity && !(r.activity && demoNormalize_(r.activity.name) === filters.activity)) return false;
    return true;
  });

  var total = rows.length;

  var dayMap = {};
  rows.forEach(function (r) {
    var d = String(r.submissionTime || '').slice(0, 10);
    if (!d) return;
    dayMap[d] = (dayMap[d] || 0) + 1;
  });
  var daily = Object.keys(dayMap).sort().map(function (date) {
    return { date: date, count: dayMap[date] };
  });

  var activityGroups = demoGroup_(rows, function (r) {
    return r.activity && r.activity.name;
  });
  activityGroups.forEach(function (g) {
    var sample = rows.filter(function (r) { return r.activity && r.activity.name === g.name; })[0];
    if (!sample) return;
    g.date = sample.day;
    g.time = sample.activity.time;
    g.location = sample.activity.location;
    g.language = sample.activity.language;
    g.duration = sample.activity.duration;
    g.org = sample.activity.org;
  });

  var governorates = demoGroup_(rows, function (r) { return r.governorate; });
  var englishLevels = demoGroup_(rows, function (r) { return r.englishLevel; });
  var eventTypes = demoGroup_(rows, function (r) { return r.eventType; });

  function distinctAll(pick) {
    var seen = {};
    var out = [];
    allRows.forEach(function (r) {
      var v = pick(r);
      if (!v) return;
      var n = demoNormalize_(v);
      if (seen[n]) return;
      seen[n] = true;
      out.push(v);
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'ar'); });
  }

  var last = null;
  rows.forEach(function (r) {
    var t = String(r.submissionTime || '');
    if (!t) return;
    if (!last || t > last) last = t;
  });

  var byDate = {};
  rows.forEach(function (r) {
    var d = String(r.submissionTime || '').slice(0, 10);
    if (d) byDate[d] = true;
  });

  var payload = {
    success: true,
    demo: true,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRegistrations: total,
      totalUnfiltered: allRows.length,
      isFiltered: active,
      uniqueActivities: activityGroups.length,
      governorates: governorates.length,
      activeDays: Object.keys(byDate).length,
      lastSubmissionAt: last || (demo.summary && demo.summary.lastSubmissionAt)
    },
    filters: filters,
    options: {
      governorates: distinctAll(function (r) { return r.governorate; }),
      eventTypes: distinctAll(function (r) { return r.eventType; }),
      englishLevels: distinctAll(function (r) { return r.englishLevel; }),
      days: distinctAll(function (r) { return r.day; }),
      activities: distinctAll(function (r) { return r.activity && r.activity.name; })
    },
    activities: activityGroups,
    governorates: governorates,
    daily: daily,
    englishLevels: englishLevels,
    eventTypes: eventTypes
  };

  return payload;
}