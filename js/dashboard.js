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
      filterStatus: Util.qs('#dFilterStatus')
    };

    // Filter field -> (select element, API parameter name, dropdown options key)
    var FILTER_FIELDS = [
      { el: els.filterGov, key: 'governorate', options: 'governorates' },
      { el: els.filterActivity, key: 'activity', options: 'activities' },
      { el: els.filterDay, key: 'day', options: 'days' },
      { el: els.filterEventType, key: 'eventType', options: 'eventTypes' },
      { el: els.filterLevel, key: 'englishLevel', options: 'englishLevels' }
    ];

    var state = { payload: null, filters: readFiltersFromUrl(), optionsReady: false };

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

    function load() {
      hideError();
      document.body.classList.remove('ready');
      Util.qsa('.dfilter__select').forEach(function (s) { s.disabled = true; });

      API.get('dashboard', state.filters).then(function (payload) {
        if (API.isError(payload)) throw new Error(payload.error || 'API error');
        state.payload = payload;
        render(payload);
        document.body.classList.add('ready');
      }).catch(function () {
        showError();
      }).then(function () {
        Util.qsa('.dfilter__select').forEach(function (s) { s.disabled = false; });
      });
    }

    function render(payload) {
      var summary = payload.summary || {};
      var total = summary.totalRegistrations || 0;

      if (ensureFilterOptions(payload)) {
        // A URL filter didn't exist in the dataset: refetch unfiltered.
        load();
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

    function applyFilter(key, value) {
      state.filters[key] = value || '';
      syncUrl();
      load();
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
        load();
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