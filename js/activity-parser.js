/**
 * ============================================================
 * Ezaees Festival 2026 — Activity Display Helpers
 * ============================================================
 * The backend (AnalyticsService.gs) is the AUTHORITATIVE activity parser.
 * This file only handles presentation:
 *   - formatting parsed fields for the UI,
 *   - a clearly-labelled approximation used for the demo preview.
 */

var ActivityView = {
  /**
   * Render parsed activity meta as an array of label/value pairs
   * suitable for a detail view. Missing values are omitted.
   */
  metaPairs: function (act) {
    if (!act) return [];
    var pairs = [];

    if (act.location) pairs.push({ k: 'المكان', v: act.location });
    if (act.time) pairs.push({ k: 'الوقت', v: act.time });
    if (act.duration) pairs.push({ k: 'المدة', v: act.duration });
    if (act.language) pairs.push({ k: 'اللغة', v: act.language });
    if (act.org) pairs.push({ k: 'الفرقة / الدول', v: act.org });

    return pairs;
  },

  /**
   * One-line digest used in compact chips, e.g.
   * "مسرح الهناجر · 7:00 مساءً"
   */
  digest: function (act) {
    if (!act) return '';
    var parts = [];
    if (act.location) parts.push(act.location);
    if (act.time) parts.push(act.time);
    return parts.join(' · ');
  },

  /**
   * DEMO-ONLY approximation. Marks itself as approximate so it is never
   * confused with backend parsing.
   */
  approximateDemoParse: function (raw) {
    return { name: String(raw || '').split('\n')[0] || raw, approx: true };
  }
};