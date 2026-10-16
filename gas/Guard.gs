// ── Guard.gs — chỉ TÀI KHOẢN CHỦ mở được file DB gốc (điều kiện anh Tuân đặt khi duyệt hướng 1, 2026-10-13) ──
// - Chia sẻ file: PRIVATE (không "anyone with link"), gỡ mọi editor/viewer/commenter khác chủ sở hữu.
// - Chạy trong setupAll() + trigger hằng ngày 7h (guardDaily). Phát hiện bị chia sẻ → tự gỡ + ghi NhatKy "CẢNH BÁO chia sẻ".
// Người dùng web KHÔNG cần quyền file: GAS chạy dưới TK chủ (Execute as Me) và kiểm token/role ở Code.gs.

function enforcePrivate_() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
  if (!id) return { ok: false, msg: 'Chưa có DB_ID' };
  var f = DriveApp.getFileById(id), owner = f.getOwner() ? f.getOwner().getEmail() : Session.getEffectiveUser().getEmail();
  var removed = [];
  if (f.getSharingAccess() !== DriveApp.Access.PRIVATE) { removed.push('link:' + f.getSharingAccess()); f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); }
  f.getEditors().forEach(function (x) { if (x.getEmail() !== owner) { f.removeEditor(x); removed.push('editor:' + x.getEmail()); } });
  f.getViewers().forEach(function (x) { if (x.getEmail() !== owner) { f.removeViewer(x); removed.push('viewer:' + x.getEmail()); } });   // gồm commenter
  f.setShareableByEditors(false);
  return { ok: true, owner: owner, removed: removed };
}

function guardDaily() {
  var r = enforcePrivate_();
  try { var m = enforceMstPrivate_(); if (m.removed.length) r.removed = (r.removed || []).concat(m.removed); } catch (e) { /* chưa có thư mục chỉ mục MST */ }
  if (r.removed && r.removed.length) {
    withLock_(function () { log_({ username: 'GUARD', role: 'Hệ thống', team: '' }, 'CẢNH BÁO chia sẻ — đã gỡ', 'CN360_DB', r.removed.join(', ')); });
  }
  return r;
}

function installGuardTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'guardDaily') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('guardDaily').timeBased().everyDays(1).atHour(7).create();
}
