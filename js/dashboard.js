/**
 * ============================================================
 * Ezaees Festival 2026 — Dashboard Controller
 * ============================================================
 * Makes ONE lightweight request (?action=dashboard), renders the
 * editorial dashboard, and never holds the full dataset.
 */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    if (API_CONFIG.DEMO_MODE) initDemoData();

    var FILTER_LABELS = {
      governorate: 'كل المحافظات',
      activity: 'كل العروض',
      day: 'كل الأيام',
      eventType: 'كل الأنواع',
      englishLevel: 'كل المستويات'
    };

    // Aggregates only. Bump the suffix if the payload shape ever changes.
var CACHE_PREFIX = 'ezaees_dash_v1:';
var MAX_CACHED_VIEWS = 8;
/* A filter combo that was already confirmed this recently is trusted as-is:
   re-selecting it paints from cache and skips the network entirely. */
var FRESH_MS = 60000;

    var els = {
      error: Util.qs('#errorState'),
      retry: Util.qs('#retryBtn'),
      heroTotal: Util.qs('#heroTotal'),
      heroUpdated: Util.qs('#heroUpdated'),
      pulseDelta: Util.qs('#pulseDelta'),
      pulseMeta: Util.qs('#pulseMeta'),
      kpiTotal: Util.qs('#kpiTotal'),
      kpiActivities: Util.qs('#kpiActivities'),
      kpiGovernorates: Util.qs('#kpiGovernorates'),
      kpiDays: Util.qs('#kpiDays'),
      activityList: Util.qs('#activityList'),
      govList: Util.qs('#govList'),
      trendAverage: Util.qs('#trendAverage'),
      trendPeak: Util.qs('#trendPeak'),
      trendBars: Util.qs('#trendBars'),
      footUpdated: Util.qs('#footUpdated'),

      filterGov: Util.qs('#dFilterGov'),
      filterActivity: Util.qs('#dFilterActivity'),
      filterDay: Util.qs('#dFilterDay'),
      filterEventType: Util.qs('#dFilterEventType'),
      filterLevel: Util.qs('#dFilterLevel'),
      filterReset: Util.qs('#dFilterReset'),
      filterStatus: Util.qs('#dFilterStatus'),
      filterBusy: Util.qs('#dFilterBusy')
    };

    // Filter field -> (select element, API parameter name, dropdown options key)
    var FILTER_FIELDS = [
      { el: els.filterGov, key: 'governorate', options: 'governorates' },
      { el: els.filterActivity, key: 'activity', options: 'activities' },
      { el: els.filterDay, key: 'day', options: 'days' },
      { el: els.filterEventType, key: 'eventType', options: 'eventTypes' },
      { el: els.filterLevel, key: 'englishLevel', options: 'englishLevels' }
    ];

    var state = {
      payload: null,
      filters: readFiltersFromUrl(),
      optionsReady: false,
      generation: 0,
      inFlight: {}
    };

    // Start the network call the moment this script executes, not at
    // DOMContentLoaded. A cold Apps Script execution is ~20s; every second
    // we overlap with rendering is a second the board doesn't wait.
    var bootPrefetch = hasActiveFilters()
      ? null
      : API.prefetch('dashboard', state.filters);

    function readFiltersFromUrl() {
      var params = new URLSearchParams(window.location.search);
      var out = {};
      FILTER_FIELDS.forEach(function (f) {
        out[f.key] = params.get(f.key) || '';
      });
      return out;
    }

    function syncUrl() {
      var params = new URLSearchParams();
      FILTER_FIELDS.forEach(function (f) {
        var v = state.filters[f.key];
        if (v) params.set(f.key, v);
      });
      var qs = params.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '');
      window.history.replaceState(null, '', url);
    }

    function hasActiveFilters() {
      return FILTER_FIELDS.some(function (f) { return !!state.filters[f.key]; });
    }

    /**
     * Dropdown options are built ONCE from the unfiltered `options` payload
     * the server sends, so the lists stay complete and the user never loses
     * focus or scroll position while re-filtering.
     *
     * Returns true when a filter from the URL did not exist in the dataset
     * and had to be dropped (so the caller can re-fetch cleanly).
     */
    function ensureFilterOptions(payload) {
      if (state.optionsReady) return false;

      var options = (payload && payload.options) || {};
      if (!Object.keys(options).length) return false;

      var changed = false;

      FILTER_FIELDS.forEach(function (f) {
        if (!f.el) return;
        var values = options[f.options] || [];

        f.el.innerHTML = '';
        f.el.appendChild(buildOption(f.key, ''));
        values.forEach(function (v) {
          f.el.appendChild(buildOption(f.key, v));
        });

        // Sanitise a hand-edited URL against what actually exists.
        var current = state.filters[f.key];
        if (current && values.indexOf(current) === -1) {
          state.filters[f.key] = '';
          changed = true;
        }
        f.el.value = state.filters[f.key] || '';
      });

      state.optionsReady = true;
      if (changed) syncUrl();
      return changed;
    }

    function buildOption(key, value) {
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value || FILTER_LABELS[key];
      return opt;
    }

    function renderFilterStatus(payload) {
      if (!els.filterStatus) return;

      els.filterStatus.classList.remove('is-stale');

      if (!hasActiveFilters()) {
        els.filterStatus.textContent = '';
        els.filterStatus.classList.remove('is-active');
        return;
      }

      var summary = (payload && payload.summary) || {};
      var shown = summary.totalRegistrations || 0;
      var all = summary.totalUnfiltered || shown;
      var labels = FILTER_FIELDS
        .filter(function (f) { return !!state.filters[f.key]; })
        .map(function (f) { return state.filters[f.key]; })
        .join(' · ');

      els.filterStatus.classList.add('is-active');
      els.filterStatus.textContent = 'عرض ' + Util.fmtNumber(shown) + ' من ' + Util.fmtNumber(all) + ' تسجيل · ' + labels;
    }

    function staggerReveal() {
      Util.qsa('.reveal').forEach(function (el, i) {
        el.style.setProperty('--rd', (i * 90) + 'ms');
      });
    }

    function showError() {
      Util.qsa('.reveal').forEach(function (el) { el.classList.add('is-error'); });
      els.error.hidden = false;
    }

    function hideError() {
      els.error.hidden = true;
      Util.qsa('.reveal').forEach(function (el) { el.classList.remove('is-error'); });
    }

    /** Shown when a refresh failed but we still have something on screen. */
    function showStaleNotice() {
      if (!els.filterStatus) return;
      els.filterStatus.classList.add('is-stale');
      els.filterStatus.textContent = 'تعذّر التحديث — الأرقام المعروضة محفوظة من آخر تحميل ناجح';
    }

    /* ---------------------------------------------------------- *
     * View cache (aggregates only — never rows, never PII)
     * ---------------------------------------------------------- *
     * The dashboard payload is a set of counts. Keeping the last few
     * rendered views means a repeat visit, or flipping back to a filter
     * you already used, paints instantly instead of waiting on Apps
     * Script. Every entry is revalidated in the background anyway.
     */

    function viewKey(filters) {
      return FILTER_FIELDS.map(function (f) { return filters[f.key] || ''; }).join('\u0001');
    }

    function readView(key) {
      try {
        var raw = window.localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        var rec = JSON.parse(raw);
        if (!rec || !rec.payload || rec.payload.success !== true) return null;
        return rec;
      } catch (e) {
        return null; // private mode / quota — cache is a nicety, not a requirement
      }
    }

    function isFresh(rec) {
      return !!rec && typeof rec.at === 'number' && (Date.now() - rec.at) < FRESH_MS;
    }

    function writeView(key, payload) {
      try {
        window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
          at: Date.now(),
          payload: payload
        }));
      } catch (e) { /* ignore */ }
      pruneViews(key);
    }

    function pruneViews(keepKey) {
      try {
        var entries = [];
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (!k || k.indexOf(CACHE_PREFIX) !== 0) continue;
          var raw = window.localStorage.getItem(k);
          var at = 0;
          try { at = (JSON.parse(raw) || {}).at || 0; } catch (e) { at = 0; }
          entries.push({ k: k, at: at });
        }
        entries.sort(function (a, b) { return b.at - a.at; });
        for (var j = MAX_CACHED_VIEWS; j < entries.length; j++) {
          if (entries[j].k === CACHE_PREFIX + keepKey) continue;
          window.localStorage.removeItem(entries[j].k);
        }
      } catch (e) { /* ignore */ }
    }

    function setBusy(on) {
      if (els.filterBusy) els.filterBusy.hidden = !on;
    }

    /**
     * Fetch one view. `initial` only controls the page-level entrance
     * animation — a re-filter NEVER replays it, which is what used to make
     * the whole dashboard blink and re-animate on every filter change.
     */
    function requestView(initial, prefetched) {
      var key = viewKey(state.filters);

      if (state.inFlight[key]) return;
      state.inFlight[key] = true;

      var gen = ++state.generation;
      setBusy(true);
      // Animate only on a genuine cold first load. A filter change must
      // repaint in place, otherwise every filter click re-runs the page's
      // entrance animation, which is exactly the stutter we're removing.
      Charts.setAnimation(!!initial);

      var pending = prefetched || API.get('dashboard', state.filters);

      pending.then(function (payload) {
        delete state.inFlight[key];
        if (gen !== state.generation) return; // superseded by a newer filter
        if (API.isError(payload)) throw new Error(payload.error || 'API error');

        state.payload = payload;
        writeView(key, payload);
        render(payload);
        document.body.classList.add('ready');
        hideError();
        painted();
      }).catch(function () {
        delete state.inFlight[key];
        if (gen !== state.generation) return;

        // A failed refresh must not blank the board: fall back to the
        // cached view and say so quietly.
        var stale = readView(key);
        if (stale) {
          state.payload = stale.payload;
          render(stale.payload);
          document.body.classList.add('ready');
          showStaleNotice();
        } else {
          showError();
        }
        painted();
      }).then(function () {
        if (gen !== state.generation) return;
        setBusy(false);
        Charts.setAnimation(true);
      });
    }

    /** Tell the splash the board has real content on screen. */
    function painted() {
      if (Util && typeof Util.markDataReady === 'function') Util.markDataReady();
    }

    function load() {
      hideError();

      var key = viewKey(state.filters);
      var cached = readView(key);

      if (cached) {
        // Paint instantly, then quietly revalidate behind the scenes.
        Charts.setAnimation(false);
        state.payload = cached.payload;
        render(cached.payload);
        document.body.classList.add('ready');
        painted();
      } else {
        // Genuine first visit: let the entrance animation play once.
        document.body.classList.remove('ready');
      }

      // Reuse the request already started at script-parse time, if any.
      var prefetched = bootPrefetch;
      bootPrefetch = null;

      // A very recent entry was confirmed moments ago; don't re-ask.
      if (isFresh(cached)) {
        return;
      }

      requestView(!cached, prefetched);
    }

    /** Filter change: cached views paint instantly, live ones refresh in place. */
    function applyFilter(key, value) {
      state.filters[key] = value || '';
      syncUrl();

      var viewKey_ = viewKey(state.filters);
      var cached = readView(viewKey_);

      if (cached) {
        // Cached views are the whole point of the cache: repaint them with
        // no motion, so flipping back to a filter feels instant.
        Charts.setAnimation(false);
        state.payload = cached.payload;
        render(cached.payload);
        document.body.classList.add('ready');
        hideError();

        // Same combo, already confirmed: the paint above is the whole job.
        if (isFresh(cached)) {
          Charts.setAnimation(true);
          renderFilterStatus(cached.payload);
          return;
        }
      }

      requestView(false);
    }

    function render(payload) {
      var summary = payload.summary || {};
      var total = summary.totalRegistrations || 0;

      if (ensureFilterOptions(payload)) {
        // A URL filter didn't exist in the dataset: refetch unfiltered.
        state.filters = readFiltersFromUrl();
        FILTER_FIELDS.forEach(function (f) { if (f.el) f.el.value = ''; });
        syncUrl();
        requestView(false);
        return;
      }

      renderFilterStatus(payload);

      // HERO
      els.heroTotal.textContent = Util.fmtNumber(total);
      els.heroUpdated.textContent = Util.formatSubmission(summary.lastSubmissionAt || payload.generatedAt);

      // PULSE + TREND
      var daily = payload.daily || [];
      renderPulse(daily);
      renderTrend(daily);
      Charts.daily('#dailyChart', daily);

      // KPI STRIP
      els.kpiTotal.textContent = Util.fmtNumber(total);
      els.kpiActivities.textContent = Util.fmtNumber(summary.uniqueActivities || 0);
      els.kpiGovernorates.textContent = Util.fmtNumber(summary.governorates || 0);
      els.kpiDays.textContent = Util.fmtNumber(summary.activeDays || 0);

      // ACTIVITY INTELLIGENCE
      renderActivities(payload.activities || [], total);
      Charts.activity('#activityChart', payload.activities || [], total);

      // GEOGRAPHIC
      renderGovernorates(payload.governorates || [], total);
      Charts.governorates('#govChart', payload.governorates || [], total);

      // PROFILE
      Charts.englishLevels('#englishChart', payload.englishLevels || [], total);
      Charts.eventTypes('#eventTypeChart', payload.eventTypes || [], total);

      // FOOT
      els.footUpdated.textContent = Util.formatSubmission(summary.lastSubmissionAt || payload.generatedAt);
    }

    function renderPulse(daily) {
      var last = daily[daily.length - 1];
      var prev = daily[daily.length - 2];
      if (!last) {
        els.pulseDelta.textContent = '—';
        els.pulseMeta.textContent = 'لا توجد بيانات يومية بعد';
        return;
      }

      els.pulseDelta.textContent = Util.fmtNumber(last.count);
      els.pulseMeta.textContent = 'تسجيل في ' + Util.formatDateLabel(last.date);

      if (prev && prev.count !== undefined) {
        var diff = last.count - prev.count;
        var trend = Util.qs('#pulseTrend');
        if (trend) {
          trend.textContent = (diff >= 0 ? '▲ +' : '▼ ') + diff;
          trend.className = 'pulse__trend ' + (diff >= 0 ? 'is-up' : 'is-down');
        }
      }
    }

    function renderTrend(daily) {
      if (!daily.length) {
        els.trendAverage.textContent = '—';
        els.trendPeak.textContent = '—';
        return;
      }

      var sum = 0;
      var peak = daily[0];
      daily.forEach(function (d) {
        sum += d.count;
        if (d.count > peak.count) peak = d;
      });

      els.trendAverage.textContent = Math.round(sum / daily.length);
      els.trendPeak.textContent = peak.count;
      els.trendPeak.setAttribute('data-hint', Util.formatDateLabel(peak.date));
      els.trendPeak.title = Util.formatDateLabel(peak.date);

      var max = Math.max.apply(null, daily.map(function (d) { return d.count; })) || 1;
      els.trendBars.innerHTML = '';

      daily.forEach(function (d, i) {
        var col = Util.createEl('div', 'tbar' + (d.count === max && max > 0 ? ' tbar--peak' : ''));
        col.style.setProperty('--h', Math.max(8, Math.round((d.count / max) * 100)) + '%');

        var num = Util.createEl('span', 'tbar__num', Util.fmtNumber(d.count));
        num.setAttribute('aria-hidden', 'true');

        var bar = Util.createEl('span', 'tbar__bar');
        var label = Util.createEl('span', 'tbar__label', Util.formatDateLabel(d.date));

        col.appendChild(num);
        col.appendChild(bar);
        col.appendChild(label);
        col.setAttribute('aria-label', Util.fmtNumber(d.count) + ' تسجيل في ' + Util.formatDateLabel(d.date));
        els.trendBars.appendChild(col);
      });
    }

    function renderActivities(activities, total) {
      els.activityList.innerHTML = '';

      if (!activities.length) {
        var empty = Util.createEl('li', 'empty-note', 'لا توجد بيانات عن العروض بعد.');
        els.activityList.appendChild(empty);
        return;
      }

      activities.forEach(function (act, i) {
        var li = Util.createEl('li', 'activity-item');
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', 'عرض تسجيلات: ' + act.name);
        li.style.setProperty('--w', Math.min(100, act.percentage || 0) + '%');

        var index = Util.createEl('span', 'activity-item__index', String(i + 1).padStart(2, '0'));
        var body = Util.createEl('div', 'activity-item__body');
        var name = Util.createEl('h3', 'activity-item__name', act.name);
        var meta = Util.createEl('p', 'activity-item__meta', ActivityView.digest(act));

        body.appendChild(name);
        body.appendChild(meta);

        var count = Util.createEl('div', 'activity-item__count');
        var num = Util.createEl('span', 'activity-item__num', Util.fmtNumber(act.count));
        var pct = Util.createEl('span', 'activity-item__pct', Util.pct(act.count, total));
        count.appendChild(num);
        count.appendChild(pct);

        li.appendChild(index);
        li.appendChild(body);
        li.appendChild(count);

        li.addEventListener('click', function () { openActivity(act.name); });
        li.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openActivity(act.name); }
        });

        els.activityList.appendChild(li);
      });
    }

    function renderGovernorates(governorates, total) {
      els.govList.innerHTML = '';

      if (!governorates.length) {
        var empty = Util.createEl('li', 'empty-note', 'لا توجد بيانات عن المحافظات بعد.');
        els.govList.appendChild(empty);
        return;
      }

      governorates.forEach(function (g, i) {
        var li = Util.createEl('li', 'rank-item');
        li.style.setProperty('--w', Math.min(100, g.percentage || 0) + '%');

        var idx = Util.createEl('span', 'rank-item__index', String(i + 1).padStart(2, '0'));
        var name = Util.createEl('span', 'rank-item__name', g.name);
        var bar = Util.createEl('span', 'rank-item__bar');
        var count = Util.createEl('span', 'rank-item__count', Util.fmtNumber(g.count) + ' · ' + Util.pct(g.count, total));

        name.appendChild(bar);
        li.appendChild(idx);
        li.appendChild(name);
        li.appendChild(count);

        els.govList.appendChild(li);
      });
    }

    function openActivity(activityName) {
      // Carry the active filters across so the board keeps its context.
      var params = new URLSearchParams();
      FILTER_FIELDS.forEach(function (f) {
        if (state.filters[f.key]) params.set(f.key, state.filters[f.key]);
      });
      params.set('activity', activityName);
      window.location.href = 'registrations.html?' + params.toString();
    }

    FILTER_FIELDS.forEach(function (f) {
      if (!f.el) return;
      // Reflect any filters restored from the URL on first paint.
      f.el.value = state.filters[f.key] || '';
      f.el.addEventListener('change', function () {
        applyFilter(f.key, f.el.value);
      });
    });

    if (els.filterReset) {
      els.filterReset.addEventListener('click', function () {
        if (!hasActiveFilters()) return;
        FILTER_FIELDS.forEach(function (f) {
          state.filters[f.key] = '';
          if (f.el) f.el.value = '';
        });
        syncUrl();
        // Clearing filters is a refresh, not a first load.
        var cached = readView(viewKey(state.filters));
        if (cached) {
          Charts.setAnimation(false);
          state.payload = cached.payload;
          render(cached.payload);
          document.body.classList.add('ready');
          hideError();
        }
        requestView(false);
      });
    }

    els.retry.addEventListener('click', load);

    staggerReveal();

    // Scroll behaviour: offsets for anchor links.
    Util.qsa('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    load();
  });
})();