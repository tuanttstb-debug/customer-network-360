// ── Mst.gs — chỉ mục MST/CIF NỘI BỘ TPBank (PHUONG_AN_TRA_MST_NOI_BO.md, anh Tuân duyệt 2026-10-15) ──
// File chỉ mục (build bằng tools/build_mst_index.py, Admin tải lên ở Danh mục → MST nội bộ) nằm trong 1 thư mục Drive của TK chủ:
//   manifest.json · <version>.name.<i> (chỉ mục tên→MST nén gzip, cắt ~3 MB/mảnh) · <version>.cif (MST→CIF nén gzip)
// - Chỉ mục TÊN→MST: trình duyệt tải về (token hợp lệ) để tra tại máy — không có cờ "KH TPBank".
// - Bảng MST→CIF: CHỈ GAS đọc; trả CIF cho đúng các MST được hỏi (≤ 1.000/lần), ghi nhật ký. Không có endpoint tải cả bảng.
// - Thư mục + file: Guard gỡ chia sẻ (như CN360_DB). Gỡ chỉ mục = Admin bấm "Gỡ" (xóa file) → mọi máy hết tra ở lần mở sau.

var MST_FOLDER_NAME = 'CN360_MST — chỉ mục nội bộ TPBank (KHÔNG CHIA SẺ)';
var MST_CIF_MAX = 1000;
var MST_CACHE_S = 21600;   // 6 giờ (tối đa của CacheService)

function mstFolder_(create) {
  var P = PropertiesService.getScriptProperties(), id = P.getProperty('MST_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { if (!create) return null; } }
  if (!create) return null;
  var f = DriveApp.createFolder(MST_FOLDER_NAME);
  P.setProperty('MST_FOLDER_ID', f.getId());
  return f;
}
function mstFile_(folder, name) { var it = folder.getFilesByName(name); return it.hasNext() ? it.next() : null; }

/** manifest.json hiện hành (cache 10 phút) hoặc null nếu chưa tải chỉ mục lên. */
function mstManifest_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('mst:man');
  if (hit) return hit === 'none' ? null : JSON.parse(hit);
  var folder = mstFolder_(false), f = folder && mstFile_(folder, 'manifest.json'), m = null;
  if (f) m = JSON.parse(f.getBlob().getDataAsString());
  cache.put('mst:man', m ? JSON.stringify(m) : 'none', 600);
  return m;
}

function apiMstMeta_(u) {
  var m = mstManifest_();
  if (!m) return { version: null };
  return { version: m.version, builtAt: m.builtAt, uploadedAt: m.uploadedAt, uploadedBy: isAdmin_(u) ? m.uploadedBy : '', counts: m.counts,
           name: { parts: m.name.parts, bytes: m.name.bytes, sha256: m.name.sha256 } };
}

function apiMstPart_(u, body) {
  var m = mstManifest_();
  if (!m) throw new Error('Chưa có chỉ mục MST nội bộ (Admin tải lên ở Danh mục).');
  if (str_(body.version) !== m.version) throw new Error('MST_VERSION: chỉ mục đã đổi phiên bản — tải lại trang.');
  var i = Math.floor(+body.i);
  if (!(i >= 0 && i < m.name.parts)) throw new Error('Mảnh chỉ mục không hợp lệ.');
  var f = mstFile_(mstFolder_(false), m.version + '.name.' + i);
  if (!f) throw new Error('Thiếu mảnh chỉ mục ' + i + ' — Admin tải lại chỉ mục.');
  if (i === 0) withLock_(function () { log_(u, 'Tải chỉ mục MST nội bộ', m.version, m.name.parts + ' mảnh'); });
  return { i: i, b64: Utilities.base64Encode(f.getBlob().getBytes()) };
}

/* ---------- MST → CIF (chỉ server) ---------- */
function _mstDigits_(m) { return str_(m).replace(/\D/g, ''); }
function _mstKey_(m) { var d = _mstDigits_(m); return d.length === 13 ? d.slice(0, 10) + '-' + d.slice(10) : d.length === 10 ? d : ''; }
function _cifBucket_(key) { return key.slice(8, 10); }

var _cifMem_ = null;   // trong 1 request
/** keys (MST chuẩn) → {key: 'cif|brn|seg'} cho các bucket cần; nạp file + cache khi thiếu. */
function _cifBuckets_(m, keys) {
  var need = {}; keys.forEach(function (k) { need[_cifBucket_(k)] = true; });
  var names = Object.keys(need).map(function (b) { return 'cif:' + m.version + ':' + b; });
  if (_cifMem_ && _cifMem_.v === m.version) return _cifMem_.b;
  var cache = CacheService.getScriptCache(), got = cache.getAll(names), out = {};
  var miss = names.filter(function (n) { return got[n] === undefined || got[n] === null; });
  if (miss.length) {
    var f = mstFile_(mstFolder_(false), m.version + '.cif');
    if (!f) throw new Error('Thiếu file CIF của chỉ mục ' + m.version + '.');
    var text = Utilities.ungzip(Utilities.newBlob(f.getBlob().getBytes(), 'application/x-gzip')).getDataAsString('UTF-8');
    var all = {};
    text.split('\n').forEach(function (line) {
      if (!line || line.charAt(0) === '#') return;
      var k = line.split('\t')[0], b = 'cif:' + m.version + ':' + _cifBucket_(k);
      all[b] = (all[b] || '') + line + '\n';
    });
    try { cache.putAll(all, MST_CACHE_S); } catch (e) { /* cache đầy/quá cỡ → vẫn dùng bản trong bộ nhớ */ }
    _cifMem_ = { v: m.version, b: all };
    return all;
  }
  names.forEach(function (n) { out[n] = got[n]; });
  return out;
}

/** [MST] → {MST gốc: {cif, cn, seg, via: 'mst'|'cty-me'}} — chỉ MST có CIF. null nếu chưa có chỉ mục. */
function cifLookup_(msts) {
  var m = mstManifest_();
  if (!m) return null;
  var keys = [];
  msts.forEach(function (x) { var k = _mstKey_(x); if (k) { keys.push(k); if (k.length > 10) keys.push(k.slice(0, 10)); } });
  if (!keys.length) return {};
  var B = _cifBuckets_(m, keys), out = {};
  var find = function (k) {
    var txt = B['cif:' + m.version + ':' + _cifBucket_(k)] || '', p = txt.indexOf(k + '\t');
    while (p > 0 && txt.charAt(p - 1) !== '\n') p = txt.indexOf(k + '\t', p + 1);
    if (p < 0) return null;
    var e = txt.slice(p, txt.indexOf('\n', p)).split('\t');
    return { cif: e[1] || '', cn: e[2] || '', seg: e[3] || '' };
  };
  msts.forEach(function (x) {
    var k = _mstKey_(x); if (!k) return;
    var r = find(k);
    if (r) { r.via = 'mst'; out[str_(x)] = r; return; }
    if (k.length > 10) { r = find(k.slice(0, 10)); if (r) { r.via = 'cty-me'; out[str_(x)] = r; } }
  });
  return out;
}

function apiMstCif_(u, body) {
  var msts = (body.msts || []).map(str_).filter(Boolean);
  msts = msts.filter(function (x, i) { return msts.indexOf(x) === i; });
  if (msts.length > MST_CIF_MAX) throw new Error('Tối đa ' + MST_CIF_MAX + ' MST mỗi lần tra.');
  var r = cifLookup_(msts);
  if (r === null) return { version: null, map: {} };
  withLock_(function () { log_(u, 'Tra CIF nội bộ', str_(body.context).slice(0, 80), msts.length + ' MST · ' + Object.keys(r).length + ' có CIF'); });
  return { version: mstManifest_().version, map: r };
}

var DT_CIF_COL = 'CIF (nếu là KH TP)';
/** Điền CIF cho đối tác có MST (gọi TRONG withLock_). onlyEmpty: chỉ ô trống. → số dòng đổi; -1 nếu chưa có chỉ mục. */
function fillCif_(dts, onlyEmpty) {
  var list = dts.filter(function (d) { return str_(d['MST']) && str_(d['Cá nhân']) !== 'Có' && (!onlyEmpty || !str_(d[DT_CIF_COL])); });
  if (!list.length) return 0;
  var r = cifLookup_(list.map(function (d) { return str_(d['MST']); }));
  if (r === null) return -1;
  var n = 0;
  list.forEach(function (d) {
    var hit = r[str_(d['MST'])], v = hit ? hit.cif + (hit.via === 'cty-me' ? ' (cty mẹ)' : '') : '';
    if (v && v !== str_(d[DT_CIF_COL])) { d[DT_CIF_COL] = v; n++; }
  });
  return n;
}

function apiSyncCif_(u) {
  if (!canDirect_(u)) throw new Error('FORBIDDEN: Admin/Teamlead.');
  return withLock_(function () {
    var dts = rows_('DoiTac'), n = fillCif_(dts, false);
    if (n < 0) throw new Error('Chưa có chỉ mục MST nội bộ (Admin tải lên ở Danh mục).');
    if (n) writeTable_('DoiTac', dts);
    log_(u, 'Đối chiếu CIF nội bộ', '', dts.length + ' đối tác · ' + n + ' cập nhật CIF');
    return { checked: dts.length, updated: n };
  });
}

/* ---------- Admin: tải chỉ mục lên / gỡ ---------- */
// body: {version, kind: 'name'|'cif'|'manifest', i?, b64?, manifest?} — FE gửi tuần tự: các mảnh name → cif → manifest (chốt).
function apiMstUpload_(u, body) {
  _needAdmin_(u);
  var v = str_(body.version);
  if (!/^\d{8}-\d{4}$/.test(v)) throw new Error('Phiên bản chỉ mục không hợp lệ.');
  var folder = mstFolder_(true), kind = str_(body.kind);
  var put = function (name, b64) {
    var old = folder.getFilesByName(name); while (old.hasNext()) old.next().setTrashed(true);
    folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'application/octet-stream', name));
  };
  if (kind === 'name') {
    var i = Math.floor(+body.i); if (!(i >= 0 && i < 100)) throw new Error('Mảnh không hợp lệ.');
    // Kiểm toàn vẹn từng mảnh (≤ 3 MB) — không ghép cả 12 MB trong GAS (mảng byte JS quá nặng)
    if (_hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.base64Decode(body.b64))) !== str_(body.sha256)) throw new Error('Mảnh ' + i + ' lỗi khi truyền (sha256) — tải lên lại.');
    put(v + '.name.' + i, body.b64); return { ok: true };
  }
  if (kind === 'cif') { put(v + '.cif', body.b64); return { ok: true }; }
  if (kind !== 'manifest') throw new Error('Loại tệp không hợp lệ.');
  var man = body.manifest || {};
  if (man.version !== v) throw new Error('manifest.json không khớp phiên bản.');
  var parts = Math.floor(+body.parts), size = 0;
  if (!(parts >= 1 && parts < 100)) throw new Error('Số mảnh không hợp lệ.');
  for (var p = 0; p < parts; p++) {
    var f = mstFile_(folder, v + '.name.' + p);
    if (!f) throw new Error('Thiếu mảnh ' + p + ' — tải lên lại.');
    size += f.getSize();
  }
  if (size !== +man.files.name.bytes) throw new Error('Chỉ mục tên tải lên thiếu dữ liệu (' + size + ' / ' + man.files.name.bytes + ' byte) — tải lên lại.');
  if (!mstFile_(folder, v + '.cif')) throw new Error('Thiếu file CIF.');
  // sha256 toàn file (của bản build) — trình duyệt kiểm lại sau khi tải về
  var out = { version: v, builtAt: str_(man.builtAt), source: str_(man.source), counts: man.counts || {}, uploadedAt: nowIso_(), uploadedBy: u.username,
              name: { parts: parts, bytes: size, sha256: str_(man.files.name.sha256) } };
  var old = folder.getFilesByName('manifest.json'); while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(Utilities.newBlob(JSON.stringify(out), 'application/json', 'manifest.json'));
  // Bỏ file phiên bản cũ
  var it = folder.getFiles();
  while (it.hasNext()) { var x = it.next(), nm = x.getName(); if (nm !== 'manifest.json' && nm.indexOf(v + '.') !== 0) x.setTrashed(true); }
  CacheService.getScriptCache().remove('mst:man');
  var g = enforceMstPrivate_();
  withLock_(function () { log_(u, 'Tải lên chỉ mục MST nội bộ', v, JSON.stringify(out.counts) + (g.removed.length ? ' · gỡ chia sẻ: ' + g.removed.join(', ') : '')); });
  return out;
}

function apiMstRemove_(u) {
  _needAdmin_(u);
  var folder = mstFolder_(false), n = 0;
  if (folder) { var it = folder.getFiles(); while (it.hasNext()) { it.next().setTrashed(true); n++; } }
  CacheService.getScriptCache().remove('mst:man');
  withLock_(function () { log_(u, 'Gỡ chỉ mục MST nội bộ', '', n + ' file'); });
  return { removed: n };
}

/** Gỡ chia sẻ thư mục + mọi file chỉ mục (gọi khi tải lên + guardDaily). */
function enforceMstPrivate_() {
  var folder = mstFolder_(false), removed = [];
  if (!folder) return { removed: removed };
  var owner = Session.getEffectiveUser().getEmail();
  var lock = function (x, label) {
    if (x.getSharingAccess() !== DriveApp.Access.PRIVATE) { removed.push(label + ' link'); x.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); }
    x.getEditors().forEach(function (p) { if (p.getEmail() !== owner) { x.removeEditor(p); removed.push(label + ' editor:' + p.getEmail()); } });
    x.getViewers().forEach(function (p) { if (p.getEmail() !== owner) { x.removeViewer(p); removed.push(label + ' viewer:' + p.getEmail()); } });
  };
  lock(folder, 'thư mục MST');
  var it = folder.getFiles(); while (it.hasNext()) { var f = it.next(); lock(f, f.getName()); }
  return { removed: removed };
}
