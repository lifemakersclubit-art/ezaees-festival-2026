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
   * Public: GET an action. Tries fetch, falls back to JSONP.
   * Returns a Promise resolving to the parsed payload object.
   */
  function get(action, params) {
    if (API_CONFIG.DEMO_MODE) {
      return importDemoData(action, params);
    }
    return fetchJSON(action, params).catch(function () {
      return jsonp(action, params);
    });
  }

  /**
   * Backstop helper: is this payload an explicit API error object?
   */
  function isError(payload) {
    return !payload || payload.success === false;
  }

  return {
    get: get,
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
  var summary = demo.summary;

  if (action === 'dashboard') {
    payload.summary = summary;
    payload.activities = demo.activities;
    payload.governorates = demo.governorates;
    payload.daily = demo.daily;
    payload.englishLevels = demo.englishLevels;
    payload.eventTypes = demo.eventTypes;
    return Promise.resolve(payload);
  }

  if (action === 'activities') {
    payload.activities = demo.activities;
    return Promise.resolve(payload);
  }
  if (action === 'governorates') {
    payload.governorates = demo.governorates;
    return Promise.resolve(payload);
  }
  if (action === 'daily') {
    payload.daily = demo.daily;
    return Promise.resolve(payload);
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