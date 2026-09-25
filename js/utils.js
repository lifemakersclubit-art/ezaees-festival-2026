/**
 * ============================================================
 * Ezaees Festival 2026 — Frontend Utilities
 * ============================================================
 * Small display helpers. NO dataset lives here.
 */

var Util = (function () {
  'use strict';

  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function fmtNumber(n) {
    var v = Number(n || 0);
    if (isNaN(v)) v = 0;
    return v.toLocaleString('en-US');
  }

  function pct(count, total) {
    if (!total) return '0%';
    var p = Math.round((count / total) * 1000) / 10;
    return p + '%';
  }

  /**
   * "2026-09-21" -> "21 Sep"
   */
  function formatDateLabel(dateStr) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
    if (!m) return dateStr || '';
    var month = parseInt(m[2], 10) - 1;
    return parseInt(m[3], 10) + ' ' + MONTHS_SHORT[month];
  }

  /**
   * "2026-09-21 19:04:42" -> "21 Sep 2026 · 19:04"
   */
  function formatSubmission(label) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(label || '');
    if (!m) return label || '';
    var month = parseInt(m[2], 10) - 1;
    return parseInt(m[3], 10) + ' ' + MONTHS_SHORT[month] + ' ' + m[1] + ' · ' + m[4] + ':' + m[5];
  }

  function decodeQueryComponent(v) {
    // application/x-www-form-urlencoded treats '+' as a space, and
    // URLSearchParams (which dashboard.js uses) writes it that way. Plain
    // decodeURIComponent does not, so a shared dashboard URL opened on the
    // registrations page would keep literal '+' inside Arabic day/activity
    // names. Normalise to the same behaviour as URLSearchParams.
    return decodeURIComponent(String(v).replace(/\+/g, '%20'));
  }

  function getQueryParams(source) {
    var search = (typeof source === 'string' && source.indexOf('?') === 0)
      ? source
      : (typeof location !== 'undefined' ? location.search : '');
    var out = {};
    if (!search) return out;
    var parts = search.replace(/^\?/, '').split('&');
    parts.forEach(function (part) {
      if (!part) return;
      var kv = part.split('=');
      var key = decodeQueryComponent(kv[0]);
      var val = kv.length > 1 ? decodeQueryComponent(kv.slice(1).join('=')) : '';
      if (val !== '') out[key] = val;
    });
    return out;
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  return {
    qs: qs,
    qsa: qsa,
    fmtNumber: fmtNumber,
    pct: pct,
    formatDateLabel: formatDateLabel,
    formatSubmission: formatSubmission,
    getQueryParams: getQueryParams,
    debounce: debounce,
    escapeHTML: escapeHTML,
    createEl: createEl
  };
})();

/**
 * ============================================================
 * Splash controller — shows the Lifemakers logo + credits while the
 * board is loading, then fades out.
 *
 * Both pages load utils.js, so this runs automatically. A page signals
 * "I have painted" with Util.markDataReady() and the splash goes away
 * immediately; the timers below are only a safety net.
 *
 * NOTE: this used to be duplicated in two IIFEs, and the second copy
 * listened for 'dataReady' while markDataReady() dispatched 'DataReady'.
 * Nothing ever called markDataReady(), so the splash always burned the
 * full MAX_SHOW on every load — a fixed multi-second tax on startup.
 * ============================================================
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // Just long enough to avoid a one-frame flash, nothing more.
  var MIN_SHOW = 500;
  // Safety net: never trap the user behind the logo if a page forgets to
  // signal, or the API is slow (a cold Apps Script start is ~20s).
  var MAX_SHOW = 3000;

  ready(function () {
    var splash = Util.qs('#splash') || document.querySelector('.splash');
    if (!splash) return;

    var started = Date.now();
    var done = false;

    function hide() {
      if (done) return;
      done = true;
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }

    function dismiss() {
      if (done) return;
      var waited = Date.now() - started;
      setTimeout(hide, Math.max(0, MIN_SHOW - waited));
    }

    // The page has painted: stop showing the logo.
    document.addEventListener('DataReady', dismiss);

    setTimeout(hide, MAX_SHOW);
  });

  /** Pages call this once they have rendered real content (or a real error). */
  Util.markDataReady = function () {
    document.dispatchEvent(new Event('DataReady'));
  };
})();

/**
 * Demo dataset builder (DEVELOPMENT ONLY).
 * Enabled solely by API_CONFIG.DEMO_MODE = true and every surface that
 * consumes it shows a "بيانات تجريبية" badge. Never shipped as real data.
 */
function initDemoData() {
  if (!(typeof window !== 'undefined' && window.__EZAEES_DEMO__)) {
    window.__EZAEES_DEMO__ = buildDemoData();
  }
}

function buildDemoData() {
  var levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
  var govs = ['الجيزة', 'القاهرة', 'القليوبية', 'الإسكندرية', 'المنوفية', 'الشرقية', 'الدقهلية'];
  var types = ['العروض', 'ورش العمل', 'الندوات'];

  var activities = [
    { name: 'عرض الافتتاح + شُعب البنات', time: '8:00 مساءً', location: 'مسرح السامر', language: 'العربية', duration: '75 دقيقة', org: null, weight: 0.24 },
    { name: 'Underdogs + حفل الختام', time: '9:00 مساءً', location: 'مسرح الهناجر', language: 'غير ناطق', duration: '55 دقيقة', org: 'Editta Braun - Austria', weight: 0.19 },
    { name: 'أصوات عميقة', time: '7:00 مساءً', location: 'مسرح الهناجر', language: 'العربية', duration: '50 دقيقة', org: 'ماتيردرا للثقافة ومسرح القصبة', weight: 0.15 },
    { name: 'فرصة أخرى عن الثانية عشرة', time: '7:00 مساءً', location: 'مسرح الهناجر', language: 'العربية', duration: '35 دقيقة', org: 'المعهد العالي للفنون المسرحية – مصر', weight: 0.11 }
  ];
  var days = ['25 سبتمبر 2026', '27 سبتمبر 2026', '28 سبتمبر 2026', '29 سبتمبر 2026', '2 أكتوبر 2026'];

  var total = 240;
  var rows = [];
  var actCounts = {};
  var govCounts = {};
  var levelCounts = {};
  var typeCounts = {};
  var dayCounts = {};

  var meet = ['سعيد منصور جابر عيسي', 'محمد ربيع احمد ربيع', 'ياسمين سيد محمود', 'محمد محمد سيد فروح', 'أحمد خالد إبراهيم', 'مريم عادل حسن', 'نور هشام عبد الله', 'علي مصطفى سامي', 'حبيبة طارق محمود', 'عمر يوسف عادل'];

  for (var i = 0; i < total; i++) {
    var rnd = Math.random();
    var act = activities[0];
    var acc = 0;
    for (var a = 0; a < activities.length; a++) {
      acc += activities[a].weight;
      if (rnd <= acc) { act = activities[a]; break; }
    }

    var day = days[Math.floor(Math.random() * days.length)];
    var gov = govs[Math.floor(Math.random() * govs.length)];
    var level = levels[Math.floor(Math.random() * levels.length)];
    var type = types[Math.floor(Math.random() * types.length)];
    var name = meet[Math.floor(Math.random() * meet.length)];

    actCounts[act.name] = (actCounts[act.name] || 0) + 1;
    govCounts[gov] = (govCounts[gov] || 0) + 1;
    levelCounts[level] = (levelCounts[level] || 0) + 1;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;

    rows.push({
      _id: String(823860000 + i),
      submissionTime: '2026-09-2' + ((i % 9) + 1) + ' 1' + (i % 10) + ':' + (i % 60) + ':00',
      name: name,
      phone: maskDemo(12, 4, 2),
      nationalId: maskDemo(14, 6, 3),
      email: name.split(' ')[0].toLowerCase() + '@gmail.com',
      englishLevel: level,
      governorate: gov,
      eventType: type,
      day: day,
      activity: act
    });
  }

  function maskDemo(len, keepHead, keepTail) {
    var s = '';
    for (var x = 0; x < len - keepHead - keepTail; x++) s += '*';
    return '01' + s + '12';
  }

  function sliceCounts(map) {
    return Object.keys(map).map(function (key) {
      var count = map[key];
      return { name: key, count: count, percentage: Math.round((count / total) * 1000) / 10 };
    }).sort(function (x, y) { return y.count - x.count; });
  }

  var daily = [
    { date: '2026-09-19', count: 18 },
    { date: '2026-09-20', count: 34 },
    { date: '2026-09-21', count: 41 },
    { date: '2026-09-22', count: 57 },
    { date: '2026-09-23', count: 49 },
    { date: '2026-09-24', count: 31 }
  ];

  return {
    summary: {
      totalRegistrations: total,
      uniqueActivities: activities.length,
      governorates: govs.length,
      activeDays: daily.length,
      lastSubmissionAt: '2026-09-24 23:05:00'
    },
    activities: actCounts.length ? sliceCounts(actCounts) : activities.map(function (a) { return { name: a.name, count: Math.round(a.weight * total), percentage: a.weight * 100 }; }),
    governorates: sliceCounts(govCounts),
    englishLevels: sliceCounts(levelCounts),
    eventTypes: sliceCounts(typeCounts),
    daily: daily,
    rows: rows
  };
}