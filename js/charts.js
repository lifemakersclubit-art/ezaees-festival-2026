/**
 * ============================================================
 * Ezaees Festival 2026 — Chart Layer (Chart.js wrapper)
 * ============================================================
 * Single chart-kit used by both dashboard and registrations pages.
 * Palette: Ezaees blue #014976, orange #FBAE42 / #F17206, light #F4F3EF.
 *
 * Every chart goes through mount(), which guarantees:
 * - the previous chart on that canvas is destroyed (no leak, no
 *   "Canvas is already in use"),
 * - an empty data set CLEARS the canvas instead of leaving the previous
 *   filter's bars on screen,
 * - animation can be switched off so re-filtering feels instant.
 */

var Charts = (function () {
  'use strict';

  var registry = [];
  var animate = true;
  var PALETTE = ['#014976', '#FBAE42', '#F17206', '#6B93AC', '#0A2E4A', '#E5B97A', '#AEC7D8', '#1E5B7E'];

  function tuneDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "'Alexandria', 'Segoe UI', Tahoma, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#5A5A52';
    Chart.defaults.borderColor = 'rgba(1, 73, 118, 0.08)';
  }

  function dropEntry_(elId) {
    for (var i = registry.length - 1; i >= 0; i--) {
      if (registry[i].id !== elId) continue;
      try { registry[i].chart.destroy(); } catch (e) { /* already gone */ }
      registry.splice(i, 1);
    }
  }

  /**
   * Create (or replace) the chart bound to `elId`.
   * `factory` receives the canvas element and returns a Chart.js config.
   * Called with data === null the canvas is simply cleared.
   */
  function mount(elId, factory) {
    tuneDefaults();
    if (!window.Chart) return null;

    var el = Util.qs(elId);
    if (!el) return null;

    // Always clear the previous instance first — this also wipes the bars
    // when a filter legitimately returns nothing.
    dropEntry_(elId);

    if (factory === null) return null;

    var chart;
    try {
      var cfg = factory(el);

      // `Chart.defaults.animation = false` is NOT enough on its own: the
      // doughnut and polarArea controllers ship their own
      // `animation: { animateRotate, animateScale }` default, which wins over
      // the global one and kept those two charts spinning on every filter
      // change. Setting it on the chart itself beats both.
      if (!animate) {
        cfg.options = cfg.options || {};
        cfg.options.animation = false;
      }

      chart = new Chart(el, cfg);
    } catch (e) {
      return null;
    }

    registry.push({ id: elId, chart: chart });

    return chart;
  }

  function destroyAll() {
    registry.slice().forEach(function (entry) {
      try { entry.chart.destroy(); } catch (e) { /* already gone */ }
    });
    registry = [];
  }

  /** Turn entry animations on/off (off while re-filtering). */
  function setAnimation(on) {
    animate = !!on;
    if (window.Chart) {
      Chart.defaults.animation = animate ? { duration: 420 } : false;
    }
  }

  /* ----- Activity ranking (horizontal bars) ----- */
  function activity(elId, list, total) {
    if (!list || !list.length) return mount(elId, null);

    var labels = list.map(function (a) { return a.name; });
    var values = list.map(function (a) { return a.count; });

    return mount(elId, function () {
      return {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'نوادي صناع الحياة',
            data: values,
            backgroundColor: PALETTE.slice(0, labels.length).map(function (c, i) { return i === 0 ? c : c + 'B3'; }),
            borderColor: '#FFFFFF66',
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 16,
            categoryPercentage: 0.9
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              rtl: true,
              textDirection: 'rtl',
              callbacks: {
                label: function (ctx) {
                  return (ctx.parsed.x || 0) + ' تسجيل \u00B7 ' + Util.pct(ctx.parsed.x, total);
                }
              }
            }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(1,73,118,0.07)' }, ticks: { precision: 0 } },
            y: { grid: { display: false }, ticks: { font: { size: 12 } } }
          }
        }
      };
    });
  }

  /* ----- Governorates (horizontal bars) ----- */
  function governorates(elId, list, total) {
    if (!list || !list.length) return mount(elId, null);

    var labels = list.map(function (g) { return g.name; });
    var values = list.map(function (g) { return g.count; });

    return mount(elId, function () {
      return {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'التسجيلات',
            data: values,
            backgroundColor: '#014976',
            borderRadius: 3,
            barThickness: 13
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              rtl: true,
              textDirection: 'rtl',
              callbacks: {
                label: function (ctx) {
                  return (ctx.parsed.x || 0) + ' تسجيل \u00B7 ' + Util.pct(ctx.parsed.x, total);
                }
              }
            }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(1,73,118,0.07)' }, ticks: { precision: 0 } },
            y: { grid: { display: false } }
          }
        }
      };
    });
  }

  /* ----- Festival Pulse (daily area line) ----- */
  function daily(elId, list) {
    if (!list || !list.length) return mount(elId, null);

    var labels = list.map(function (d) { return Util.formatDateLabel(d.date); });
    var values = list.map(function (d) { return d.count; });

    return mount(elId, function (ctx) {
      var grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 320);
      grad.addColorStop(0, '#FBAE4259');
      grad.addColorStop(1, '#FBAE4202');

      return {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'التسجيلات',
            data: values,
            borderColor: '#F17206',
            backgroundColor: grad,
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointBackgroundColor: '#014976',
            pointBorderColor: '#FFFFFF',
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              rtl: true,
              textDirection: 'rtl',
              callbacks: {
                label: function (ctx) { return (ctx.parsed.y || 0) + ' تسجيل'; }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(1,73,118,0.07)' }, ticks: { precision: 0 } }
          },
          interaction: { mode: 'index', intersect: false }
        }
      };
    });
  }

  /* ----- English levels (doughnut) ----- */
  function englishLevels(elId, list, total) {
    if (!list || !list.length) return mount(elId, null);

    var labels = list.map(function (x) { return x.name; });
    var values = list.map(function (x) { return x.count; });

    return mount(elId, function () {
      return {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: PALETTE,
            borderColor: '#F4F3EF',
            borderWidth: 3,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: {
            legend: {
              position: 'bottom',
              rtl: true,
              labels: { usePointStyle: true, boxWidth: 9, padding: 14 }
            },
            tooltip: {
              rtl: true,
              textDirection: 'rtl',
              callbacks: {
                label: function (ctx) {
                  return ' ' + (ctx.parsed || 0) + ' تسجيل \u00B7 ' + Util.pct(ctx.parsed, total);
                }
              }
            }
          }
        }
      };
    });
  }

  /* ----- Event types (polar area) ----- */
  function eventTypes(elId, list, total) {
    if (!list || !list.length) return mount(elId, null);

    var labels = list.map(function (x) { return x.name; });
    var values = list.map(function (x) { return x.count; });

    return mount(elId, function () {
      return {
        type: 'polarArea',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: PALETTE.slice(0, labels.length).map(function (c) { return c + 'C9'; }),
            borderColor: '#F4F3EF',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              rtl: true,
              labels: { usePointStyle: true, boxWidth: 9, padding: 14 }
            },
            tooltip: {
              rtl: true,
              textDirection: 'rtl',
              callbacks: {
                label: function (ctx) {
                  return ' ' + (ctx.parsed || 0) + ' تسجيل \u00B7 ' + Util.pct(ctx.parsed, total);
                }
              }
            }
          },
          scales: { r: { grid: { color: 'rgba(1,73,118,0.10)' }, ticks: { display: false } } }
        }
      };
    });
  }

  return {
    activity: activity,
    governorates: governorates,
    daily: daily,
    englishLevels: englishLevels,
    eventTypes: eventTypes,
    destroyAll: destroyAll,
    setAnimation: setAnimation
  };
})();
