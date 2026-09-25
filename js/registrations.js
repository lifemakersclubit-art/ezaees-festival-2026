/**
 * ============================================================
 * Ezaees Festival 2026 — Registrations Controller
 * ============================================================
 * Server-side pagination, search and filters. The browser only ever
 * holds the current page of rows.
 */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    if (API_CONFIG.DEMO_MODE) initDemoData();

    var urlParams = Util.getQueryParams();

    var state = {
      page: 1,
      total: 0,
      totalPages: 1,
      search: urlParams.search || '',
      filters: {
        governorate: urlParams.governorate || '',
        eventType: urlParams.eventType || '',
        englishLevel: urlParams.englishLevel || '',
        day: urlParams.day || '',
        activity: urlParams.activity || ''
      }
    };

    var els = {
      error: Util.qs('#errorState'),
      retry: Util.qs('#retryBtn'),
      summary: Util.qs('#resultSummary'),
      search: Util.qs('#searchInput'),
      fGov: Util.qs('#fGov'),
      fType: Util.qs('#fType'),
      fLevel: Util.qs('#fLevel'),
      fDay: Util.qs('#fDay'),
      fActivity: Util.qs('#fActivity'),
      body: Util.qs('#tableBody'),
      prev: Util.qs('#prevPage'),
      next: Util.qs('#nextPage'),
      pageInfo: Util.qs('#pageInfo'),
      pagination: Util.qs('#pagination'),
      footUpdated: Util.qs('#footUpdated')
    };

    function syncInputsFromState() {
      els.search.value = state.search;
      els.fGov.value = state.filters.governorate || '';
      els.fType.value = state.filters.eventType || '';
      els.fLevel.value = state.filters.englishLevel || '';
      els.fDay.value = state.filters.day || '';
      els.fActivity.value = state.filters.activity || '';
    }

    function fillSelect(select, values) {
      var seen = {};
      values.forEach(function (v) {
        if (!v || seen[v]) return;
        seen[v] = true;
        var opt = Util.createEl('option', null, v);
        opt.value = v;
        select.appendChild(opt);
      });
    }

    function loadMeta() {
      return API.get('dashboard').then(function (payload) {
        if (API.isError(payload)) throw new Error(payload.error || 'API error');

        els.footUpdated.textContent = Util.formatSubmission(
          (payload.summary && payload.summary.lastSubmissionAt) || payload.generatedAt
        );

        fillSelect(els.fGov, (payload.governorates || []).map(function (g) { return g.name; }));
        fillSelect(els.fType, (payload.eventTypes || []).map(function (t) { return t.name; }));
        fillSelect(els.fLevel, (payload.englishLevels || []).map(function (l) { return l.name; }));

        var daySet = {};
        (payload.activities || []).forEach(function (a) { if (a.date) daySet[a.date] = true; });

        fillSelect(els.fDay, Object.keys(daySet).sort());
        fillSelect(els.fActivity, (payload.activities || []).map(function (a) { return a.name; }));
      });
    }

    function loadPage() {
      var params = {
        page: state.page,
        pageSize: state.pageSize || API_CONFIG.DEFAULT_PAGE_SIZE,
        search: state.search || undefined,
        governorate: state.filters.governorate || undefined,
        eventType: state.filters.eventType || undefined,
        englishLevel: state.filters.englishLevel || undefined,
        day: state.filters.day || undefined,
        activity: state.filters.activity || undefined
      };

      return API.get('registrations', params).then(function (payload) {
        if (API.isError(payload)) throw new Error(payload.error || 'API error');

        state.total = payload.total;
        state.totalPages = payload.totalPages;
        state.page = payload.page;

        renderRows(payload.rows || []);
        renderPagination();
        renderSummary();
        syncUrl();

        // First real content on screen: let the splash go.
        if (Util && typeof Util.markDataReady === 'function') Util.markDataReady();
      });
    }

    function renderRows(rows) {
      els.body.innerHTML = '';

      if (!rows.length) {
        var tr = Util.createEl('tr', null);
        var td = Util.createEl('td', 'table-empty');
        td.colSpan = 9;
        td.textContent = 'لا توجد نتائج مطابقة للبحث أو الفلاتر.';
        tr.appendChild(td);
        els.body.appendChild(tr);
        return;
      }

      var pageSize = state.pageSize || API_CONFIG.DEFAULT_PAGE_SIZE;

      rows.forEach(function (row, i) {
        var tr = Util.createEl('tr', null);

        var idx = cell(String(((state.page - 1) * pageSize) + i + 1), 'cell-idx');
        var name = cell(row.name || '—', 'cell-name');
        var gov = cell(row.governorate || '—', 'cell-gov');
        var phone = cell(row.phone || '—', 'cell-phone');
        var email = cell(row.email || '—', 'cell-email');
        var level = cell(row.englishLevel || '—', 'cell-level');
        var type = cell(row.eventType || '—', 'cell-type');
        var day = cell(row.day || '—', 'cell-day');

        var act = Util.createEl('td', 'cell-activity');
        if (row.activity && row.activity.name) {
          var actName = Util.createEl('span', 'cell-activity__name', row.activity.name);
          act.appendChild(actName);
          if (row.activity.time) {
            act.appendChild(Util.createEl('span', 'cell-activity__time', row.activity.time));
          }
        } else {
          act.textContent = '—';
        }

        tr.appendChild(idx);
        tr.appendChild(name);
        tr.appendChild(gov);
        tr.appendChild(phone);
        tr.appendChild(email);
        tr.appendChild(level);
        tr.appendChild(type);
        tr.appendChild(day);
        tr.appendChild(act);

        els.body.appendChild(tr);
      });
    }

    function cell(text, cls) {
      var td = Util.createEl('td', cls);
      td.textContent = text;
      return td;
    }

    function renderSummary() {
      var txt = 'إجمالي ' + Util.fmtNumber(state.total) + ' تسجيل';
      if (state.totalPages > 1) {
        txt += ' — حاضر ' + state.pageSize + ' لكل صفحة، والبحث والتصفية تتمان على الخادم.';
      }
      els.summary.textContent = txt;
    }

    function renderPagination() {
      if (state.totalPages <= 1) {
        els.pagination.hidden = true;
        return;
      }
      els.pagination.hidden = false;
      els.prev.disabled = state.page <= 1;
      els.next.disabled = state.page >= state.totalPages;
      els.pageInfo.textContent = 'صفحة ' + state.page + ' من ' + state.totalPages;
    }

    function syncUrl() {
      var q = {};
      if (state.search) q.search = state.search;
      ['governorate', 'eventType', 'englishLevel', 'day', 'activity'].forEach(function (key) {
        if (state.filters[key]) q[key] = state.filters[key];
      });

      var parts = Object.keys(q).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); });

      if (typeof history !== 'undefined' && history.replaceState && q) {
        history.replaceState(null, '', parts.length ? location.pathname + '?' + parts.join('&') : location.pathname);
      }
    }

    function refresh(resetPage) {
      if (resetPage !== false) state.page = 1;
      els.body.innerHTML = '<tr><td colspan="9" class="table-empty">جاري التحميل…</td></tr>';
      loadPage().catch(showError);
    }

    function showError() {
      els.error.hidden = false;
      els.body.innerHTML = '<tr><td colspan="9" class="table-empty">—</td></tr>';
      if (Util && typeof Util.markDataReady === 'function') Util.markDataReady();
    }

    // UI wiring -------------------------------------------------
    els.search.addEventListener('input', Util.debounce(function () {
      state.search = els.search.value.trim();
      refresh(true);
    }, 350));

    els.fGov.addEventListener('change', function () { state.filters.governorate = els.fGov.value; refresh(true); });
    els.fType.addEventListener('change', function () { state.filters.eventType = els.fType.value; refresh(true); });
    els.fLevel.addEventListener('change', function () { state.filters.englishLevel = els.fLevel.value; refresh(true); });
    els.fDay.addEventListener('change', function () { state.filters.day = els.fDay.value; refresh(true); });
    els.fActivity.addEventListener('change', function () { state.filters.activity = els.fActivity.value; refresh(true); });

    els.prev.addEventListener('click', function () {
      if (state.page > 1) { state.page -= 1; loadPage().catch(showError); }
    });
    els.next.addEventListener('click', function () {
      if (state.page < state.totalPages) { state.page += 1; loadPage().catch(showError); }
    });
    els.retry.addEventListener('click', function () {
      els.error.hidden = true;
      refresh(true);
    });

    Util.qs('#clearFilters').addEventListener('click', function () {
      state.search = '';
      state.filters = { governorate: '', eventType: '', englishLevel: '', day: '', activity: '' };
      syncInputsFromState();
      refresh(true);
    });

    // Boot ------------------------------------------------------
    syncInputsFromState();

    // Meta only fills the filter dropdowns and the "last updated" footer, so
    // the table must not wait for it. Chaining these serially meant two Apps
    // Script round trips back to back — on a cold start that is ~40s before
    // any row appears. Run them together; if meta fails the table still shows.
    loadMeta().catch(function () { /* footer/options degrade, rows still load */ });
    loadPage().catch(showError);
  });
})();