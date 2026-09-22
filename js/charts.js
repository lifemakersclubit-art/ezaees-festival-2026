/**
 * ============================================================
 * Ezaees Festival 2026 — Chart Layer (Chart.js wrapper)
 * ============================================================
 * Single chart-kit used by both dashboard and registrations pages.
 * Palette: Ezaees blue #014976, orange #FBAE42 / #F17206, light #F4F3EF.
 */

var Charts = (function () {
  'use strict';

  var registry = [];
  var PALETTE = ['#014976', '#FBAE42', '#F17206', '#6B93AC', '#0A2E4A', '#E5B97A', '#AEC7D8', '#1E5B7E'];

  function tuneDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "'Alexandria', 'Segoe UI', Tahoma, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#5A5A52';
    Chart.defaults.borderColor = 'rgba(1, 73, 118, 0.08)';
    Chart.defaults.animation.duration = 420;
  }

  function destroyAll() {
    registry.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    registry = [];
  }

  /* ----- Activity ranking (horizontal bars) ----- */
  function activity(elId, list, total) {
    if (!list || !list.length) return null;
    var labels = list.map(function (a) { return a.name; });
    var values = list.map(function (a) { return a.count; });

    tuneDefaults();
    if (!window.Chart) return null;
    var ctx = Util.qs(elId);

    return new Chart(ctx, {
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
    });
  }

  /* ----- Governorates (horizontal bars) ----- */
  function governorates(elId, list, total) {
    if (!list || !list.length) return null;
    var labels = list.map(function (g) { return g.name; });
    var values = list.map(function (g) { return g.count; });

    tuneDefaults();
    if (!window.Chart) return null;

    return new Chart(Util.qs(elId), {
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
    });
  }

  /* ----- Festival Pulse (daily area line) ----- */
  function daily(elId, list) {
    if (!list || !list.length) return null;
    var labels = list.map(function (d) { return Util.formatDateLabel(d.date); });
    var values = list.map(function (d) { return d.count; });

    tuneDefaults();
    if (!window.Chart) return null;
    var ctx = Util.qs(elId);
    var grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, '#FBAE4259');
    grad.addColorStop(1, '#FBAE4202');

    return new Chart(ctx, {
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
    });
  }

  /* ----- English levels (doughnut) ----- */
  function englishLevels(elId, list, total) {
    if (!list || !list.length) return null;
    var labels = list.map(function (x) { return x.name; });
    var values = list.map(function (x) { return x.count; });

    tuneDefaults();
    if (!window.Chart) return null;

    return new Chart(Util.qs(elId), {
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
    });
  }

  /* ----- Event types (polar area) ----- */
  function eventTypes(elId, list, total) {
    if (!list || !list.length) return null;
    var labels = list.map(function (x) { return x.name; });
    var values = list.map(function (x) { return x.count; });

    tuneDefaults();
    if (!window.Chart) return null;

    return new Chart(Util.qs(elId), {
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
    });
  }

  return {
    activity: activity,
    governorates: governorates,
    daily: daily,
    englishLevels: englishLevels,
    eventTypes: eventTypes,
    destroyAll: destroyAll
  };
})();
