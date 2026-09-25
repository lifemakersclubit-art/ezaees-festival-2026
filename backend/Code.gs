/**
 * ============================================================
 * Ezaees Festival 2026 — API Entry Point (Router)
 * ============================================================
 * Web App exposed via ContentService.
 *
 * Endpoints:
 *   GET ?action=dashboard             -> all dashboard aggregates (one call)
 *   GET ?action=activities            -> activity analytics slice
 *   GET ?action=governorates          -> geographic slice
 *   GET ?action=daily                 -> daily registration trend
 *   GET ?action=registrations&...     -> server-side search/filter/pagination
 *
 * Every endpoint accepts an optional `callback` parameter (JSONP) so the
 * frontend can talk to this API even from the file:// protocol.
 */

function doGet(e) {
  return route_(e ? e.parameter : {}, e);
}

function doPost(e) {
  var body = {};
  if (e && e.postData && e.postData.contents) {
    try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  }
  return route_(body, e);
}

function route_(params, e) {
  resetRequestState_();
  try {
    var action = String(params.action || ACTION.DASHBOARD).toLowerCase();

    switch (action) {
      case ACTION.DASHBOARD:
        return response_(getDashboardPayload_(params), params.callback);

      case ACTION.ACTIVITIES: {
        var payload = getDashboardPayload_(params);
        return response_({
          success: true,
          demo: payload.demo,
          generatedAt: payload.generatedAt,
          activities: payload.activities
        }, params.callback);
      }

      case ACTION.GOVERNORATES: {
        var gPayload = getDashboardPayload_(params);
        return response_({
          success: true,
          demo: gPayload.demo,
          generatedAt: gPayload.generatedAt,
          governorates: gPayload.governorates
        }, params.callback);
      }

      case ACTION.DAILY: {
        var dPayload = getDashboardPayload_(params);
        return response_({
          success: true,
          demo: dPayload.demo,
          generatedAt: dPayload.generatedAt,
          daily: dPayload.daily
        }, params.callback);
      }

      case ACTION.REGISTRATIONS:
        return response_(getRegistrationsPage_(params), params.callback);

      case ACTION.ROWS:
        return response_(getRowProjection_(), params.callback);

      default:
        return response_(errorPayload_('Unknown action: ' + action), params.callback);
    }
  } catch (err) {
    return response_(errorPayload_(String(err && err.message ? err.message : err)), params.callback);
  }
}