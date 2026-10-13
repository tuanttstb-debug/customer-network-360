// ── Setup.gs — khởi tạo 1 lần (chạy trong GAS editor bằng TK chủ) ──
// Trước khi chạy: Project Settings → Script Properties → AUTH_SECRET = giá trị AUTH_SECRET của GAS SHTD.
// setupAll(): tạo spreadsheet CN360_DB (nếu chưa có) · đủ 9 sheet + tiêu đề · Config mặc định · khóa file riêng tư · trigger guard.
// Chạy lại an toàn: không xóa dữ liệu, chỉ bổ sung sheet/cột/khóa còn thiếu.

function setupAll() {
  var P = PropertiesService.getScriptProperties();
  if (!P.getProperty('AUTH_SECRET')) throw new Error('Thiếu Script Property AUTH_SECRET (lấy từ GAS SHTD).');
  var id = P.getProperty('DB_ID'), ss;
  if (id) ss = SpreadsheetApp.openById(id);
  else { ss = SpreadsheetApp.create('CN360_DB — Customer Network 360 (KHÔNG CHIA SẺ)'); P.setProperty('DB_ID', ss.getId()); }

  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name), H = SCHEMA[name];
    var cur = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
    if (!cur.filter(Boolean).length) sh.getRange(1, 1, 1, H.length).setValues([H]);
    else { var miss = H.filter(function (h) { return cur.indexOf(h) < 0; }); if (miss.length) sh.getRange(1, cur.length + 1, 1, miss.length).setValues([miss]); }
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#EDE7F6');
  });
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  // Text cho cột mã (CIF/MST giữ số 0 đầu)
  [['KHHH', ['CIF', 'MST']], ['DoiTac', ['MST', 'CIF (nếu là KH TP)']], ['KH_TPBank', ['CIF', 'MST']], ['Lo', ['CIF', 'Kỳ']]].forEach(function (x) {
    var sh = ss.getSheetByName(x[0]), H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    x[1].forEach(function (h) { var c = H.indexOf(h) + 1; if (c > 0) sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'); });
  });

  _tblCache_ = {};
  var have = {}; rows_('Config').forEach(function (r) { have[String(r['Khóa'])] = true; });
  var add = CONFIG_DEFAULTS.filter(function (r) { return !have[r[0]]; }).map(function (r) { return { 'Khóa': r[0], 'Giá trị': r[1], 'Mô tả': r[2] }; });
  appendRows_('Config', add);

  var g = enforcePrivate_();
  installGuardTrigger_();
  Logger.log('CN360_DB: ' + ss.getUrl() + ' · chủ: ' + g.owner + ' · gỡ: ' + (g.removed.join(', ') || 'không'));
  return { dbId: ss.getId(), owner: g.owner, removed: g.removed, configAdded: add.length };
}

/** Kiểm nhanh sau khi cài: AUTH_SECRET đọc được, User_Master mở được, DB riêng tư. */
function checkSetup() {
  var out = { secret: !!PropertiesService.getScriptProperties().getProperty('AUTH_SECRET') };
  try { out.users = SpreadsheetApp.openById(USER_SPREADSHEET_ID).getSheetByName(USER_MASTER_SHEET).getLastRow() - 1; } catch (e) { out.users = 'LỖI: ' + e.message; }
  try { var f = DriveApp.getFileById(PropertiesService.getScriptProperties().getProperty('DB_ID')); out.sharing = String(f.getSharingAccess()); out.editors = f.getEditors().length; out.viewers = f.getViewers().length; } catch (e) { out.db = 'LỖI: ' + e.message; }
  Logger.log(JSON.stringify(out));
  return out;
}
