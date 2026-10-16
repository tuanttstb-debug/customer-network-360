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

/** Ghi cache TỪNG khóa (putAll vài MB một lần bị GAS từ chối cả lô → không cache được gì — prod 16/10). → số khóa ghi được. */
function cachePutEach_(cache, obj) {
  var n = 0;
  Object.keys(obj).forEach(function (k) { try { cache.put(k, obj[k], MST_CACHE_S); n++; } catch (e) { /* khóa quá cỡ → bỏ, lượt sau đọc tệp */ } });
  return n;
}
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
      if (!line || line.charAt(0) === '#' || line.charAt(0) === 'K') return;   // khối K = bảng KH (kh-find), không vào bucket
      var k = line.split('\t')[0], b = 'cif:' + m.version + ':' + _cifBucket_(k);
      all[b] = (all[b] || '') + line + '\n';
    });
    cachePutEach_(cache, all);
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
  log_(u, 'Tra CIF nội bộ', str_(body.context).slice(0, 80), msts.length + ' MST · ' + Object.keys(r).length + ' có CIF');   // appendRow nguyên tử — không chờ khóa ghi
  return { version: mstManifest_().version, map: r };
}

/* ---------- KHHH nội bộ (KH line CB) theo CIF / MST — chỉ server (ô tìm + tự điền ở bước ① · chuẩn hóa KHHH) ---------- */
// Khối K cuối tệp CIF: "K CIF MST BRN SEG Tên" — CIF + CN theo dữ liệu TPB · MST + tên đẹp theo sheet 900k (anh Tuân 16/10).
// Chia bucket theo 2 số cuối CIF, nén gzip+base64 vào CacheService 6 giờ → mỗi lượt tra chỉ giải 1 vài bucket.
// Tra theo TÊN chạy trên máy người dùng (chỉ mục tên→MST) rồi gửi danh sách MST lên — server không quét tên.
var KH_FIND_MAX = 20;
/** Mã BRN_MIS → {label "001-HKM-Hoàn Kiếm", ptkd, loai, tinh, vung} theo BLOCK.xlsx (manifest.dvkd); không có → "002 (ngoài BLOCK 2026)". */
function dvkdInfo_(m, brn) {
  var b = str_(brn), d = ((m && m.dvkd) || {})[b];
  if (!b) return { label: '' };
  if (!d) return { label: b + ' (ngoài BLOCK 2026)' };
  return typeof d === 'string' ? { label: d } : d;
}
function _khB_(cif) { return ('00' + str_(cif).replace(/\D/g, '')).slice(-2); }
var _khMem_ = null;   // trong 1 request: {v, b: {bucket: text}}
var _khSrc_ = '';      // nguồn lượt tra gần nhất: mem | cache | file (đo hiệu năng)
/** Đọc cả khối K (1 lần / 6 giờ / phiên bản) → bucket → cache. */
function _khAll_(m) {
  if (_khMem_ && _khMem_.v === m.version) { _khSrc_ = 'mem'; return _khMem_.b; }
  _khSrc_ = 'file';
  var f = mstFile_(mstFolder_(false), m.version + '.cif');
  if (!f) throw new Error('Thiếu file CIF của chỉ mục ' + m.version + '.');
  var text = Utilities.ungzip(Utilities.newBlob(f.getBlob().getBytes(), 'application/x-gzip')).getDataAsString('UTF-8');
  var all = {}, p = text.indexOf('\nK\t');
  if (p >= 0) text.slice(p + 1).split('\n').forEach(function (line) {
    if (line.charAt(0) !== 'K') return;
    var b = _khB_(line.split('\t', 2)[1]); all[b] = (all[b] || '') + line + '\n';
  });
  var put = {};
  Object.keys(all).forEach(function (b) { put['kh:' + m.version + ':' + b] = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(all[b], 'text/plain')).getBytes()); });
  cachePutEach_(CacheService.getScriptCache(), put);
  _khMem_ = { v: m.version, b: all };
  return all;
}
function _khBuckets_(m, bs) {
  if (_khMem_ && _khMem_.v === m.version) { _khSrc_ = 'mem'; return _khMem_.b; }
  var names = bs.map(function (b) { return 'kh:' + m.version + ':' + b; }), got = CacheService.getScriptCache().getAll(names), out = {};
  if (names.some(function (n) { return !got[n]; })) return _khAll_(m);
  _khSrc_ = 'cache';
  bs.forEach(function (b, i) { out[b] = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(got[names[i]]), 'application/x-gzip')).getDataAsString('UTF-8'); });
  return out;
}
// K CIF MST BRN SEG TênHT [Tên900k] — tên hiển thị = tên 900k (có dấu), không có → tên trên hệ thống TPB
function _khRow_(m, line) {
  var e = line.split('\t'), d = dvkdInfo_(m, e[3]), tenHT = e[5] || '', ten900 = e[6] || '';
  return { cif: e[1], mst: e[2] || '', brn: e[3] || '', cn: d.label, seg: e[4] || '', ten: ten900 || tenHT, tenHT: tenHT, ten900: ten900,
           ptkd: d.ptkd || '', loaiDvkd: d.loai || '', tinh: d.tinh || '', vung: d.vung || '' };
}
/** [CIF] → [KH] (giữ thứ tự hỏi). */
function khByCifs_(m, cifs) {
  cifs = cifs.map(function (c) { return str_(c).replace(/\D/g, ''); }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
  if (!cifs.length) return [];
  var B = _khBuckets_(m, cifs.map(_khB_).filter(function (b, i, a) { return a.indexOf(b) === i; })), out = [];
  cifs.forEach(function (c) {
    var t = '\n' + (B[_khB_(c)] || ''), p = t.indexOf('\nK\t' + c + '\t');
    if (p >= 0) out.push(_khRow_(m, t.slice(p + 1, t.indexOf('\n', p + 1))));
  });
  return out;
}
/** [MST] → [KH] qua bảng MST→CIF (đã cache) — mọi CIF của MST đó, giữ thứ tự MST. */
function khByMsts_(m, msts) {
  var keys = msts.map(_mstKey_).filter(function (k, i, a) { return k && a.indexOf(k) === i; });
  if (!keys.length) return [];
  var B = _cifBuckets_(m, keys), cifs = [];
  keys.forEach(function (k) {
    var t = '\n' + (B['cif:' + m.version + ':' + _cifBucket_(k)] || ''), p = t.indexOf('\n' + k + '\t');
    if (p >= 0) t.slice(p + 1, t.indexOf('\n', p + 1)).split('\t')[1].split(',').forEach(function (c) { if (c) cifs.push(c); });
  });
  return khByCifs_(m, cifs);
}
/** body.q = CIF hoặc MST (chỉ số) | body.msts = MST ứng viên từ tra tên trên máy (≤ 20) → ≤ 20 KH {cif, mst, ten, brn, cn, seg}. */
function apiKhFind_(u, body) {
  var m = mstManifest_();
  if (!m) return { version: null, items: [] };
  var items, what;
  if (body.msts) {
    var ms = (body.msts || []).map(str_).filter(Boolean).slice(0, KH_FIND_MAX);
    items = khByMsts_(m, ms); what = 'tên → ' + ms.length + ' MST';
  } else {
    var raw = str_(body.q).trim(), dig = raw.replace(/[\s.\-]/g, '');
    if (!/^\d{3,}$/.test(dig)) throw new Error('Gõ CIF hoặc MST (chỉ số, ≥ 3 ký tự) — tìm theo tên dùng chỉ mục trên máy.');
    items = (dig.length === 10 || dig.length === 13) ? khByMsts_(m, [raw]) : [];
    if (!items.length) items = khByCifs_(m, [dig]);
    what = raw.slice(0, 20);
  }
  items = items.slice(0, KH_FIND_MAX);
  log_(u, 'Tìm KHHH nội bộ', str_(body.context).slice(0, 80), what + ' → ' + items.length + ' KH');   // appendRow nguyên tử — không chờ khóa ghi
  return { version: m.version, items: items, src: _khSrc_ };
}
/** {CIF: KH chuẩn} cho các CIF — dùng khi lưu lô / chuẩn hóa KHHH. null nếu chưa có chỉ mục. */
function khStd_(cifs) {
  var m = mstManifest_();
  if (!m) return null;
  var out = {};
  khByCifs_(m, cifs).forEach(function (k) { out[k.cif] = k; });
  return out;
}
/** Áp dữ liệu chuẩn vào 1 dòng KHHH (lưu lô / chuẩn hóa hàng loạt): MST · Tên khách hàng · ĐVKD (cột khác giữ nguyên). → true nếu đổi. */
function khApplyStd_(row, k) {
  var ch = false, set = function (col, v) { if (v && str_(row[col]) !== v) { row[col] = v; ch = true; } };
  set('MST', k.mst); set('Tên khách hàng', k.ten); set('ĐVKD', k.cn);
  return ch;
}
/** Dòng KHHH → dữ liệu TPB: theo CIF; không có → theo MST (đúng 1 CIF mới tự khớp). {k, via: 'cif'|'mst'|'', cands: [KH theo MST]} */
function khMatch_(m, row) {
  var c = str_(row['CIF']).replace(/\D/g, ''), byCif = c ? khByCifs_(m, [c]) : [];
  if (byCif.length) return { k: byCif[0], via: 'cif', cands: [] };
  var cands = str_(row['MST']) ? khByMsts_(m, [str_(row['MST'])]) : [];
  return { k: cands.length === 1 ? cands[0] : null, via: cands.length === 1 ? 'mst' : '', cands: cands };
}
/** Đổi CIF 1 KHHH (gọi TRONG withLock_): KHHH · Lo · cột CIF ở DoiTac. Báo lỗi nếu CIF mới đã là KHHH khác. */
function khRenameCif_(kh, from, to) {
  if (from === to) return;
  if (kh.some(function (k) { return str_(k['CIF']) === to; })) throw new Error('CIF ' + to + ' đã là 1 KHHH khác trong kho — gộp tay (xóa 1 trong 2) trước.');
  kh.forEach(function (k) { if (str_(k['CIF']) === from) k['CIF'] = to; });
  var lots = rows_('Lo'), nl = 0; lots.forEach(function (l) { if (str_(l['CIF']) === from) { l['CIF'] = to; nl++; } });
  if (nl) writeTable_('Lo', lots);
  var dts = rows_('DoiTac'), nd = 0; dts.forEach(function (d) { if (str_(d[DT_CIF_COL]) === from) { d[DT_CIF_COL] = to; nd++; } });
  if (nd) writeTable_('DoiTac', dts);
}
/** Tên/CN mới của KHHH → các lô của KHHH đó hiển thị khớp (gọi TRONG withLock_). */
function khSyncLots_(cif, ten, cn) {
  var lots = rows_('Lo'), n = 0;
  lots.forEach(function (l) { if (str_(l['CIF']) === cif) { if (ten && l['Tên KHHH'] !== ten) { l['Tên KHHH'] = ten; n++; } if (cn && l['CN'] !== cn) { l['CN'] = cn; n++; } } });
  if (n) writeTable_('Lo', lots);
}
/** Admin/Teamlead: chuẩn hóa mọi KHHH theo dữ liệu TPB — khớp CIF, không có thì theo MST (MST ra đúng 1 CIF → đổi cả CIF). */
function apiSyncKhhh_(u) {
  if (!canDirect_(u)) throw new Error('FORBIDDEN: Admin/Teamlead.');
  var m = mstManifest_();
  if (!m) throw new Error('Chưa có chỉ mục MST nội bộ (Admin tải lên ở Danh mục).');
  return withLock_(function () {
    var kh = rows_('KHHH'), n = 0, byCif = 0, byMst = 0, many = [];
    kh.slice().forEach(function (row) {
      var r = khMatch_(m, row), from = str_(row['CIF']);
      if (!r.k) { if (r.cands.length > 1) many.push(from); return; }
      if (r.via === 'mst') { khRenameCif_(kh, from, r.k.cif); byMst++; } else byCif++;
      var ch = khApplyStd_(row, r.k);
      if (ch || r.via === 'mst') { n++; khSyncLots_(str_(row['CIF']), row['Tên khách hàng'], row['ĐVKD']); }
    });
    if (n) writeTable_('KHHH', kh);
    log_(u, 'Chuẩn hóa KHHH nội bộ', '', kh.length + ' KHHH · khớp CIF ' + byCif + ' · khớp MST ' + byMst + ' · cập nhật ' + n + (many.length ? ' · MST nhiều CIF: ' + many.join(',') : ''));
    return { checked: kh.length, byCif: byCif, byMst: byMst, updated: n, many: many };
  });
}
function _khEditable_(u, row) { if (!(isAdmin_(u) || canApprove_(u, row['Team']))) throw new Error('FORBIDDEN: Admin hoặc Teamlead của team quản lý KHHH.'); }
/** Màn chi tiết KHHH → "Chuẩn hóa": hiện tại + dữ liệu TPB khớp (theo CIF, hoặc mọi CIF của MST). Chỉ đọc. */
function apiKhStd_(u, body) {
  var m = mstManifest_();
  if (!m) throw new Error('Chưa có chỉ mục MST nội bộ (Admin tải lên ở Danh mục).');
  var cif = str_(body.cif), row = rows_('KHHH').filter(function (k) { return str_(k['CIF']) === cif; })[0];
  if (!row) throw new Error('Không thấy KHHH ' + cif + '.');
  _khEditable_(u, row);
  var r = khMatch_(m, row), mst = str_(body.mst) || str_(row['MST']);
  var cands = r.via === 'cif' ? [r.k] : (mst ? khByMsts_(m, [mst]) : []);
  log_(u, 'Xem dữ liệu chuẩn KHHH', cif, (r.via || 'không khớp') + ' · ' + cands.length + ' ứng viên');
  return { via: r.via === 'cif' ? 'cif' : (cands.length ? 'mst' : ''), cands: cands,
           cur: { cif: cif, mst: str_(row['MST']), ten: str_(row['Tên khách hàng']), dvkd: str_(row['ĐVKD']), rm: str_(row['RM/PTKD phụ trách']) } };
}
/** Áp dữ liệu chuẩn cho 1 KHHH. body: {cif, toCif, f: {cif, mst, ten, dvkd, rm: bool}, tenSrc: '900k'|'ht'}. Giá trị lấy LẠI ở server (không tin FE). */
function apiKhApplyStd_(u, body) {
  var m = mstManifest_();
  if (!m) throw new Error('Chưa có chỉ mục MST nội bộ (Admin tải lên ở Danh mục).');
  var to = str_(body.toCif).replace(/\D/g, ''), k = khByCifs_(m, [to])[0], f = body.f || {};
  if (!k) throw new Error('CIF ' + to + ' không có trong dữ liệu TPB.');
  return withLock_(function () {
    var kh = rows_('KHHH'), cif = str_(body.cif), row = kh.filter(function (x) { return str_(x['CIF']) === cif; })[0];
    if (!row) throw new Error('Không thấy KHHH ' + cif + '.');
    _khEditable_(u, row);
    var before = JSON.stringify({ cif: row['CIF'], mst: row['MST'], ten: row['Tên khách hàng'], dvkd: row['ĐVKD'], rm: row['RM/PTKD phụ trách'] });
    if (f.cif) khRenameCif_(kh, cif, k.cif);
    var ten = body.tenSrc === 'ht' ? k.tenHT : (k.ten900 || k.tenHT);
    if (f.mst && k.mst) row['MST'] = k.mst;
    if (f.ten && ten) row['Tên khách hàng'] = ten;
    if (f.dvkd && k.cn) row['ĐVKD'] = k.cn;
    if (f.rm && k.ptkd) row['RM/PTKD phụ trách'] = k.ptkd;
    writeTable_('KHHH', kh);
    khSyncLots_(str_(row['CIF']), f.ten ? row['Tên khách hàng'] : '', f.dvkd ? row['ĐVKD'] : '');
    log_(u, 'Chuẩn hóa KHHH (chi tiết)', str_(row['CIF']), before + ' → ' + JSON.stringify({ cif: row['CIF'], mst: row['MST'], ten: row['Tên khách hàng'], dvkd: row['ĐVKD'], rm: row['RM/PTKD phụ trách'] }));
    return { cif: str_(row['CIF']) };
  });
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
              name: { parts: parts, bytes: size, sha256: str_(man.files.name.sha256) }, dvkd: {} };
  Object.keys(man.dvkd || {}).slice(0, 1000).forEach(function (k) {
    if (!/^\d{3}$/.test(k)) return;
    var v = man.dvkd[k];
    out.dvkd[k] = (v && typeof v === 'object') ? { label: str_(v.label).slice(0, 120), ptkd: str_(v.ptkd).slice(0, 40), loai: str_(v.loai).slice(0, 60), tinh: str_(v.tinh).slice(0, 60), vung: str_(v.vung).slice(0, 30) }
                                               : str_(v).slice(0, 120);
  });
  var old = folder.getFilesByName('manifest.json'); while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(Utilities.newBlob(JSON.stringify(out), 'application/json', 'manifest.json'));
  // Bỏ file phiên bản cũ
  var it = folder.getFiles();
  while (it.hasNext()) { var x = it.next(), nm = x.getName(); if (nm !== 'manifest.json' && nm.indexOf(v + '.') !== 0) x.setTrashed(true); }
  CacheService.getScriptCache().remove('mst:man');
  try { _khMem_ = null; _khAll_(out); } catch (e) { /* hâm cache lỗi → lượt tra đầu tự nạp */ }
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
  var owner = folder.getOwner().getEmail();   // không dùng Session.getEffectiveUser — cần scope userinfo.email (manifest không khai)
  var lock = function (x, label) {
    if (x.getSharingAccess() !== DriveApp.Access.PRIVATE) { removed.push(label + ' link'); x.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); }
    x.getEditors().forEach(function (p) { if (p.getEmail() !== owner) { x.removeEditor(p); removed.push(label + ' editor:' + p.getEmail()); } });
    x.getViewers().forEach(function (p) { if (p.getEmail() !== owner) { x.removeViewer(p); removed.push(label + ' viewer:' + p.getEmail()); } });
  };
  lock(folder, 'thư mục MST');
  var it = folder.getFiles(); while (it.hasNext()) { var f = it.next(); lock(f, f.getName()); }
  return { removed: removed };
}
