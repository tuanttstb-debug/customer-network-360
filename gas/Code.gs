// ── Code.gs — cửa vào Web App CN360 (khuôn doPost của SHTD) ──
// Deploy: Execute as **Me** (TK chủ) · Who has access: **Anyone** — đây chỉ là cửa HTTP; MỌI action trừ auth-login/health
// đều phải có token hợp lệ + user còn Active trong User_Master. Dữ liệu chỉ đọc/ghi qua đây; file DB gốc chỉ TK chủ mở được.
// Client gửi POST Content-Type text/plain (tránh preflight CORS): { action, token, reqId?, ... } → { status:'ok'|'error', ... }

var ACTIONS = {
  'me':             { fn: function (u) { return { user: u, version: APP_VERSION }; } },
  'load':           { fn: apiLoad_ },
  'submit-batch':   { fn: apiSubmitBatch_, write: true },
  'approve-lot':    { fn: apiApproveLot_, write: true },
  'edit-doitac':    { fn: apiEditDoiTac_, write: true },
  'merge-doitac':   { fn: apiMergeDoiTac_, write: true },
  'approve-req':    { fn: apiApproveReq_, write: true },
  'edit-khhh':      { fn: apiEditKhhh_, write: true },
  'set-khtp':       { fn: apiSetKhtp_, write: true },
  'set-config':     { fn: apiSetConfig_, write: true },
  'delete-khhh':    { fn: apiDeleteKhhh_, write: true },
  'import-kho':     { fn: apiImportKho_, write: true },
  'audit':          { fn: apiAudit_ },
  'log':            { fn: apiLog_ },
  'mst-meta':       { fn: apiMstMeta_ },
  'mst-part':       { fn: apiMstPart_ },
  'mst-cif':        { fn: apiMstCif_ },
  'kh-find':        { fn: apiKhFind_ },
  'sync-cif':       { fn: apiSyncCif_, write: true },
  'mst-upload':     { fn: apiMstUpload_, write: true },
  'mst-remove':     { fn: apiMstRemove_, write: true },
};

function _json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return _json_({ status: 'ok', app: 'CN360', version: APP_VERSION }); }

function doPost(e) {
  try { return _json_(handle_(JSON.parse(e.postData.contents))); }
  catch (err) { return _json_({ status: 'error', error: String(err && err.message || err) }); }
}

/** Tách khỏi doPost để test được trong Node (test/gas_harness.mjs). */
function handle_(body) {
  var action = String(body.action || '').toLowerCase();
  if (action === 'health') return { status: 'ok', version: APP_VERSION };
  if (action === 'auth-login') { var r = authLogin_(body.username, body.password); return { status: 'ok', token: r.token, user: r.user }; }

  var td = validateToken_(body.token);
  if (!td || ROLES_.indexOf(td.r) < 0) return { status: 'error', error: 'AUTH_REQUIRED' };
  var u = currentUser_(td);
  if (!u || ROLES_.indexOf(u.role) < 0) return { status: 'error', error: 'AUTH_REQUIRED' };

  var A = ACTIONS[action];
  if (!A) return { status: 'error', error: 'Hành động không hỗ trợ: ' + action };

  // Idempotency (SHTD Pha A): cùng reqId trong 10 phút → trả lại kết quả cũ, không ghi lặp khi client retry sau timeout
  var cache = CacheService.getScriptCache(), rk = A.write && body.reqId ? 'req:' + u.username + ':' + String(body.reqId).slice(0, 60) : null;
  if (rk) { var hit = cache.get(rk); if (hit) return JSON.parse(hit); }
  try {
    var out = A.fn(u, body);
    var res = { status: 'ok', data: out };
    if (rk) { var s = JSON.stringify(res); if (s.length < 90000) cache.put(rk, s, 600); }
    return res;
  } catch (err) {
    var msg = String(err && err.message || err);
    return { status: 'error', error: /^FORBIDDEN/.test(msg) ? 'FORBIDDEN' : msg, detail: msg };
  }
}
