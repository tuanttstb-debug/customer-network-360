// ── Db.gs — đọc/ghi bảng theo TÊN cột trên CN360_DB ──
// Mọi ghi chạy trong withLock_() (LockService) — bài học SHTD Concurrency.gs: 2 người ghi cùng lúc không được đè nhau.
// Quy mô dự kiến (≤ vài chục nghìn dòng) → đọc cả bảng 1 lần/lệnh, ghi lại cả bảng nhỏ, nối dòng cho bảng lớn.

function db_() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
  if (!id) throw new Error('Chưa khởi tạo DB (chạy setupAll trong GAS editor).');
  return SpreadsheetApp.openById(id);
}

var _tblCache_ = {};   // cache trong 1 lần chạy (1 request)

function sheet_(name) {
  var sh = db_().getSheetByName(name);
  if (!sh) throw new Error('Thiếu sheet ' + name + ' (chạy setupAll).');
  return sh;
}

/** Bảng → {H: [tiêu đề], rows: [{tiêu đề: giá trị}]} */
function readTable_(name) {
  if (_tblCache_[name]) return _tblCache_[name];
  var v = sheet_(name).getDataRange().getValues();
  var H = (v[0] || SCHEMA[name]).map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < v.length; i++) {
    if (v[i].every(function (x) { return x === '' || x === null; })) continue;
    var o = {};
    for (var j = 0; j < H.length; j++) if (H[j]) o[H[j]] = v[i][j];
    rows.push(o);
  }
  _tblCache_[name] = { H: H, rows: rows };
  return _tblCache_[name];
}
function rows_(name) { return readTable_(name).rows; }

function _toRow_(H, o) { return H.map(function (h) { var x = o[h]; return x === undefined || x === null ? '' : x; }); }

/** Ghi lại TOÀN BỘ bảng (giữ thứ tự cột hiện có của sheet). */
function writeTable_(name, rows) {
  var T = readTable_(name), sh = sheet_(name), H = T.H;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, H.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, H.length).setValues(rows.map(function (o) { return _toRow_(H, o); }));
  _tblCache_[name] = { H: H, rows: rows };
}

/** Nối dòng vào cuối bảng. */
function appendRows_(name, rows) {
  if (!rows.length) return;
  var T = readTable_(name), sh = sheet_(name);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, T.H.length).setValues(rows.map(function (o) { return _toRow_(T.H, o); }));
  T.rows = T.rows.concat(rows);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(WRITE_LOCK_MS);
  try { _tblCache_ = {}; return fn(); }
  finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}

// ── Config + bộ đếm mã ──
function config_() {
  var m = {};
  rows_('Config').forEach(function (r) { m[String(r['Khóa'])] = r['Giá trị']; });
  return m;
}
function setConfig_(updates) {
  var rows = rows_('Config');
  Object.keys(updates).forEach(function (k) {
    var r = rows.filter(function (x) { return String(x['Khóa']) === k; })[0];
    if (r) r['Giá trị'] = updates[k]; else rows.push({ 'Khóa': k, 'Giá trị': updates[k], 'Mô tả': '' });
  });
  writeTable_('Config', rows);
}
/** Cấp n số thứ tự liên tiếp cho bộ đếm (gọi TRONG withLock_). */
function nextSeq_(key, n) {
  var c = config_(), cur = Math.max(1, +c[key] || 1);
  var upd = {}; upd[key] = cur + (n || 1); setConfig_(upd);
  return cur;
}

// ── Tiện ích ──
function nowIso_() { return new Date().toISOString(); }
function today_() { return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'); }
function dstr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}
function padDt_(n) { return 'DT' + ('00000' + n).slice(-5); }
function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function num_(v) { var x = +v; return isFinite(x) ? x : 0; }

// Chỉ đọc dòng tiêu đề + appendRow (nguyên tử, không cần khóa) — KHÔNG đọc cả sheet nhật ký mỗi lần ghi (nhật ký dài dần → mọi thao tác chậm dần; 16/10)
function log_(u, action, target, detail) {
  var sh = sheet_('NhatKy'), H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(_toRow_(H, { 'Thời điểm': nowIso_(), 'Người': u.username, 'Vai trò': u.role, 'Team': u.team,
    'Hành động': action, 'Đối tượng': str_(target).slice(0, 200), 'Chi tiết': str_(detail).slice(0, 500) }));
  delete _tblCache_['NhatKy'];
}
