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
      var key = decodeURIComponent(kv[0]);
      var val = kv.length > 1 ? decodeURIComponent(kv.slice(1).join('=')) : '';
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
 * Splash controller — shows the Lifemakers logo + credits for
 * the first 3 seconds (covers data loading), then fades out.
 * Both pages load utils.js, so this runs automatically.
 * ============================================================
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  var MIN_SHOW = 3000;   // أقل مدة: 3 ثوانٍ فعلية (تغطي تحميل الداتا كما طلبت)
  var MAX_SHOW = 4500;   // سقف أمان: يُخفى مهما حدث لو تعطل التحميل (يعطي 3s أساسية)

  ready(function () {
    var splash = Util.qs('#splash');
    if (!splash) return;
    var started = Date.now();
    var done = false;

    function hide() {
      if (done) return;
      done = true;
      splash.classList.add('splash--hide');
      setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 650);
    }

    // 1) التحميل اكتمل → يُخفي بعد الحد الأدنى إن لم يمرّ بعد.
    document.addEventListener('DataReady', function () {
      var waited = Date.now() - started;
      setTimeout(hide, Math.max(0, MIN_SHOW - waited));
    });

    // 2) سقف أمان: أقصى 4 ثوانٍ مهما حدث (يغطي 3 ثوانٍ، ويسقط
    //    تلقائيًا لو تعطل الـ API أو لم تُبعث إشارة DataReady).
    setTimeout(hide, MAX_SHOW);
  });

  /**
   * Page responsible to call Util.markDataReady() once the real data
   * has rendered, so the Splash hides as soon as possible (min 1.8s).
   */
  function markDataReady() {
    document.dispatchEvent(new Event('DataReady'));
  }

  ready(function () {
    var splash = document.querySelector('.splash');
    if (!splash) return;

    // Always hide after 3s (covers slow networks/loading).
    var timer = setTimeout(hide, 3000);

    // If data finishes earlier, still respect the 3s minimum,
    // but cap the wait so nothing blocks the page forever.
    document.addEventListener('dataReady', function () {
      clearTimeout(timer);
      setTimeout(hide, 300);
    });

    function hide() {
      if (splash.classList.contains('splash--hide')) return;
      splash.classList.add('splash--hide');
      setTimeout(function () {
        var parent = splash.parentNode;
        if (parent) parent.removeChild(splash);
      }, 700);
    }
  });
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