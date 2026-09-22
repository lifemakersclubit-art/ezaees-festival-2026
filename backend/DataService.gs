/**
 * ============================================================
 * Ezaees Festival 2026 — Data Access Layer
 * ============================================================
 * Rules enforced here:
 * - Batch read only: getDataRange().getValues() — never cell-by-cell in loops.
 * - Header row is read dynamically; column count is never assumed.
 * - Only configured fields are surfaced into row objects.
 * - No caching of raw rows or PII.
 */

/**
 * Read the full grid from the configured sheet.
 * Returns { headers: [String], values: [[Any]] } or null on failure.
 */
function readSheet_() {
  if (CONFIG.SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID') {
    throw new Error('Backend is not configured: set SPREADSHEET_ID in Config.gs');
  }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet not found: "' + CONFIG.SHEET_NAME + '"');
  }

  var range = sheet.getDataRange();
  if (range.getNumRows() < 2) {
    return { headers: [], values: [] };
  }

  var values = range.getValues();
  var headers = values[0].map(String);

  // Drop phantom header columns (KoboToolbox exports often have trailing blanks).
  while (headers.length && headers[headers.length - 1].trim() === '') headers.pop();

  return { headers: headers, values: values };
}

/**
 * Materialise raw grid values into lightweight row objects
 * containing only the exposed fields. Am empty row (no core value)
 * is skipped.
 */
function readRows_() {
  var grid = readSheet_();
  var headers = grid.headers;
  var values = grid.values;

  if (!headers.length) return [];

  var idx = {};
  EXPOSED_KEYS.forEach(function (key) {
    idx[key] = asArrayIndex_(headers, key);
  });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var src = values[r];
    var row = {};

    EXPOSED_KEYS.forEach(function (key) {
      var i = idx[key];
      if (i >= 0 && i < src.length) {
        var v = src[i];
        row[key] = (v === '' || v === null || v === undefined) ? null : v;
      } else {
        row[key] = null;
      }
    });

    if (isUsableRow_(row)) rows.push(row);
  }

  return rows;
}

function isUsableRow_(row) {
  return !!(row[COLUMNS.NAME] ||
             row[COLUMNS.PHONE] ||
             row[COLUMNS.NATIONAL_ID] ||
             row[COLUMNS.SUBMISSION_TIME] ||
             row[COLUMNS.ACTIVITY]);
}

/**
 * Public data snapshot used by every analytics consumer.
 * In-memory only; one read per request (or served from the cache layer).
 */
function getRows_() {
  return readRows_();
}