// ── Service.gs — nghiệp vụ CN360: tải dữ liệu theo quyền · nạp lô · duyệt · danh mục · nhập kho v0.1 ──
// Quyền (kế hoạch §5, D10 + A1–A3): Admin/Teamlead nạp & sửa vào thẳng; User → Chờ duyệt, Teamlead CÙNG TEAM hoặc Admin duyệt.
// Mọi người xem dữ liệu ĐÃ DUYỆT của mọi team (D09). Lô chờ/từ chối chỉ người nạp + người duyệt được thấy (A2).
// Khóa tên chuẩn hóa = MAP131.key (Mapping.gs — chép từ core/mapping.js, cùng 1 nguồn với trình duyệt).

var LO_ACTIVE = 'Đã duyệt', LO_PENDING = 'Chờ duyệt', LO_REJECTED = 'Từ chối', LO_REPLACED = 'Thay thế';
var DT_ACTIVE = 'Hoạt động', DT_PENDING = 'Chờ duyệt';
var VAL_COLS = ['Dư Nợ đầu kỳ', 'Dư Có đầu kỳ', 'Phát sinh Nợ', 'Phát sinh Có', 'Dư Nợ cuối kỳ', 'Dư Có cuối kỳ'];

function _key_(s) { return MAP131.key(str_(s)); }
function _lotKey_(l) { return [str_(l['CIF']), str_(l['TK']).slice(0, 3), dstr_(l['Kỳ'])].join('|'); }
function _hasLot_(field, id) { return str_(field).split(',').map(str_).indexOf(id) >= 0; }

function _canSeeLot_(u, l) {
  var st = str_(l['Trạng thái']);
  if (st === LO_ACTIVE) return true;
  if (st === LO_REPLACED) return false;
  return str_(l['Người nạp']).toLowerCase() === u.username.toLowerCase() || canApprove_(u, l['Team']);
}

/* ================= TẢI DỮ LIỆU ================= */
function apiLoad_(u) {
  var lots = rows_('Lo'), cfg = config_();
  var vis = lots.filter(function (l) { return _canSeeLot_(u, l); });
  var visIds = {}; vis.forEach(function (l) { visIds[str_(l['Batch_ID'])] = true; });
  var rowLots = {}; vis.forEach(function (l) { if (str_(l['Trạng thái']) !== LO_REJECTED) rowLots[str_(l['Batch_ID'])] = true; });
  var anyVisible = function (field) { return str_(field).split(',').some(function (id) { return visIds[str_(id)]; }); };
  var doiTac = rows_('DoiTac').filter(function (d) { return str_(d['Trạng thái']) !== DT_PENDING || anyVisible(d['Lô tạo']); });
  var tenGop = rows_('TenGop').filter(function (a) { return str_(a['Trạng thái']) !== 'Chờ duyệt' || anyVisible(a['Lô']); });
  var yc = rows_('YeuCau').filter(function (r) {
    return str_(r['Người đề nghị']).toLowerCase() === u.username.toLowerCase() || canApprove_(u, r['Team']);
  });
  var pendingForMe = vis.filter(function (l) { return str_(l['Trạng thái']) === LO_PENDING && canApprove_(u, l['Team']); }).length
    + yc.filter(function (r) { return str_(r['Trạng thái']) === 'Chờ duyệt' && canApprove_(u, r['Team']); }).length;
  var cfgOut = {}; Object.keys(cfg).forEach(function (k) { if (k.indexOf('NEXT_') !== 0) cfgOut[k] = cfg[k] instanceof Date ? dstr_(cfg[k]) : cfg[k]; });
  return {
    user: u, version: APP_VERSION, pendingForMe: pendingForMe,
    khhh: rows_('KHHH'), doiTac: doiTac, tenGop: tenGop, khTP: rows_('KH_TPBank'),
    lots: vis.map(function (l) { var o = {}; Object.keys(l).forEach(function (k) { o[k] = k === 'Kỳ' ? dstr_(l[k]) : l[k]; }); return o; }),
    congNo: rows_('CongNo').filter(function (r) { return rowLots[str_(r['Batch_ID'])]; }),
    yeuCau: yc, config: cfgOut,
  };
}

/* ================= NẠP LÔ ================= */
// body.lots: [{cif, tenKH, mstKH, cn, tk, ky(yyyy-mm-dd), kyGoc, file, rows:[{ma, raw, cid, vals[6], bal, trang, ghiChu}]}]
// body.partners: [{cid, isNew, mst, ten, caNhan, ttMst, nguonMst, tenSua, aliases:[{raw, trangThai}]}]
function apiSubmitBatch_(u, body) {
  var lotsIn = body.lots || [], partners = body.partners || [];
  if (!lotsIn.length) throw new Error('Không có lô nào để lưu.');
  lotsIn.forEach(function (l, i) {
    if (!str_(l.cif)) throw new Error('Lô ' + (i + 1) + ': thiếu CIF KHHH.');
    if (!/^(131|331)/.test(str_(l.tk))) throw new Error('Lô ' + (i + 1) + ': TK phải là 131 hoặc 331.');
    if (!/^\d{4}-\d\d-\d\d$/.test(str_(l.ky))) throw new Error('Lô ' + (i + 1) + ': thiếu kỳ (ngày cuối kỳ yyyy-mm-dd).');
    if (!(l.rows || []).length) throw new Error('Lô ' + (i + 1) + ': không có dòng công nợ.');
  });
  return withLock_(function () {
    var direct = canDirect_(u), now = nowIso_(), day = today_();
    var dts = rows_('DoiTac'), tg = rows_('TenGop'), lots = rows_('Lo'), kh = rows_('KHHH');
    var byId = {}, byMst = {}, byKey = {};
    dts.forEach(function (d) { var id = str_(d['Counterparty_ID']); byId[id] = d; if (str_(d['MST'])) byMst[str_(d['MST'])] = id; var k = _key_(d['Tên pháp lý']); if (k && !byKey[k]) byKey[k] = id; });
    var aliasKeys = {}; tg.forEach(function (a) { aliasKeys[str_(a['Khóa']) || _key_(a['Tên gốc'])] = true; });

    // 1) Mã lô
    var seq = nextSeq_('NEXT_LO', lotsIn.length);
    var lotIds = lotsIn.map(function (_, i) { return 'LO' + day.replace(/-/g, '') + '-' + ('0000' + (seq + i)).slice(-4); });
    var lotTag = lotIds.join(',');

    // 2) Đối tác: mã mới cấp ở SERVER (không tin mã client tự sinh — 2 người nạp song song sẽ trùng)
    var idMap = {}, newDt = [], ycNew = [], nNewDt = 0;
    partners.forEach(function (p) { if (p.isNew || !byId[str_(p.cid)]) nNewDt++; });
    var dtSeq = nNewDt ? nextSeq_('NEXT_DT', nNewDt) : 0;
    partners.forEach(function (p) {
      var cid = str_(p.cid), d = (!p.isNew && byId[cid]) || null;
      if (!d) {
        var hit = (str_(p.mst) && byMst[str_(p.mst)]) || byKey[_key_(p.ten)];
        if (hit) d = byId[hit];
      }
      if (!d) {
        var id = padDt_(dtSeq++);
        d = { 'Counterparty_ID': id, 'MST': str_(p.mst), 'Tên pháp lý': str_(p.ten), 'Tên rút gọn': '', 'Cá nhân': p.caNhan ? 'Có' : '',
              'Trạng thái MST': str_(p.ttMst), 'Nguồn MST': str_(p.nguonMst), 'Đã là KHHH': '', 'CIF (nếu là KH TP)': '', 'Ngành': '', 'Ghi chú': '',
              'Trạng thái': direct ? DT_ACTIVE : DT_PENDING, 'Lô tạo': lotTag, 'Người tạo': u.username, 'Ngày tạo': now, 'Ngày sửa': '' };
        dts.push(d); byId[id] = d; newDt.push(id);
        if (d['MST']) byMst[d['MST']] = id;
        var k0 = _key_(d['Tên pháp lý']); if (k0 && !byKey[k0]) byKey[k0] = id;
      } else {
        // đối tác đã có: đổi danh tính (tên/MST) → Admin/Teamlead sửa thẳng, User gửi yêu cầu
        var sau = {}, truoc = {};
        if (p.tenSua && str_(p.ten) && str_(p.ten) !== str_(d['Tên pháp lý'])) { sau.ten = str_(p.ten); truoc.ten = str_(d['Tên pháp lý']); }
        if (str_(p.mst) && str_(p.mst) !== str_(d['MST'])) { sau.mst = str_(p.mst); truoc.mst = str_(d['MST']); }
        if (Object.keys(sau).length) {
          if (direct || str_(d['Trạng thái']) === DT_PENDING && _hasLot_(d['Lô tạo'], lotIds[0])) _applyDtEdit_(d, sau, u, now);
          else ycNew.push(_newYc_(u, 'sua-doitac', d['Counterparty_ID'], truoc, sau, now));
        }
        // trạng thái MST (VietQR) chỉ là làm mới dữ liệu công khai → cập nhật thẳng khi cùng MST
        if (str_(p.ttMst) && str_(p.mst) && str_(p.mst) === str_(d['MST'])) { d['Trạng thái MST'] = str_(p.ttMst); d['Nguồn MST'] = str_(p.nguonMst); }
      }
      idMap[cid] = str_(d['Counterparty_ID']);
      (p.aliases || []).forEach(function (a) {
        var k = _key_(a.raw); if (!k || aliasKeys[k] || k === _key_(d['Tên pháp lý'])) return;
        tg.push({ 'Tên gốc': str_(a.raw), 'Khóa': k, 'Counterparty_ID': d['Counterparty_ID'], 'Trạng thái': direct ? (a.trangThai || 'Máy gộp') : 'Chờ duyệt',
                  'Người': u.username, 'Ngày': now, 'Lô': lotTag });
        aliasKeys[k] = true;
      });
    });
    if (ycNew.length) { var ys = nextSeq_('NEXT_YC', ycNew.length); ycNew.forEach(function (y, i) { y['Req_ID'] = 'YC' + ('00000' + (ys + i)).slice(-5); }); appendRows_('YeuCau', ycNew); }

    // 3) Lô + dòng công nợ (mọi dòng phải trỏ tới 1 đối tác đã khai trong partners)
    lotsIn.forEach(function (l) { (l.rows || []).forEach(function (r) { if (!idMap[str_(r.cid)]) throw new Error('Dòng "' + str_(r.raw) + '" chưa gán mã đối tác.'); }); });
    var cn = [], outLots = [];
    lotsIn.forEach(function (l, i) {
      var id = lotIds[i], rws = l.rows || [];
      var lot = { 'Batch_ID': id, 'CIF': str_(l.cif), 'Tên KHHH': str_(l.tenKH), 'CN': str_(l.cn), 'TK': str_(l.tk).slice(0, 3), 'Kỳ': str_(l.ky), 'Kỳ gốc': str_(l.kyGoc),
        'Tệp': str_(l.file).slice(0, 200), 'Số dòng': rws.length, 'Dòng cân đối': rws.filter(function (r) { return r.bal === 'Cân'; }).length,
        'Trạng thái': direct ? LO_ACTIVE : LO_PENDING, 'Người nạp': u.username, 'Team': u.team, 'Ngày nạp': now,
        'Người duyệt': direct ? u.username : '', 'Ngày duyệt': direct ? now : '', 'Lý do': '', 'Thay thế bởi': '' };
      if (direct) _supersede_(lots, lot);
      lots.push(lot);
      rws.forEach(function (r, j) {
        var o = { 'Batch_ID': id, 'Dòng': j + 1, 'Mã ĐT nội bộ': str_(r.ma), 'Tên đối tác gốc': str_(r.raw), 'Counterparty_ID': idMap[str_(r.cid)] || '',
                  'Cân đối': r.bal === 'Cân' ? 'Cân' : 'Chưa cân', 'Trang': r.trang || '', 'Ghi chú': str_(r.ghiChu) };
        VAL_COLS.forEach(function (c, k) { o[c] = num_((r.vals || [])[k]); });
        cn.push(o);
      });
      if (!kh.some(function (k) { return str_(k['CIF']) === str_(l.cif); })) {
        kh.push({ 'CIF': str_(l.cif), 'MST': str_(l.mstKH), 'Tên khách hàng': str_(l.tenKH), 'ĐVKD': str_(l.cn), 'Team': u.team, 'Người tạo': u.username, 'Ngày tạo': now });
      }
      outLots.push({ id: id, status: lot['Trạng thái'], rows: rws.length });
    });
    try { fillCif_(dts, true); } catch (e) { /* chỉ mục MST nội bộ lỗi/thiếu → không chặn nạp lô */ }
    writeTable_('DoiTac', dts); writeTable_('TenGop', tg); writeTable_('Lo', lots); writeTable_('KHHH', kh);
    appendRows_('CongNo', cn);
    log_(u, direct ? 'Nạp lô (vào thẳng)' : 'Nạp lô (chờ duyệt)', lotTag, cn.length + ' dòng · ' + newDt.length + ' đối tác mới · ' + ycNew.length + ' yêu cầu sửa danh mục');
    return { lots: outLots, idMap: idMap, newPartners: newDt, requests: ycNew.map(function (y) { return y['Req_ID']; }) };
  });
}

/** Lô mới được duyệt → lô cũ cùng KHHH + TK + kỳ chuyển "Thay thế" (không xóa — truy vết được). */
function _supersede_(lots, lot) {
  var key = _lotKey_(lot);
  lots.forEach(function (o) {
    if (o !== lot && str_(o['Trạng thái']) === LO_ACTIVE && _lotKey_(o) === key) { o['Trạng thái'] = LO_REPLACED; o['Thay thế bởi'] = lot['Batch_ID']; }
  });
}

function _newYc_(u, loai, cid, truoc, sau, now) {
  return { 'Req_ID': '', 'Loại': loai, 'Counterparty_ID': cid, 'Trước': JSON.stringify(truoc), 'Sau': JSON.stringify(sau), 'Người đề nghị': u.username,
           'Team': u.team, 'Ngày': now, 'Trạng thái': 'Chờ duyệt', 'Người duyệt': '', 'Ngày duyệt': '', 'Lý do': '' };
}
function _applyDtEdit_(d, sau, u, now) {
  var note = [];
  if (sau.ten !== undefined) { d['Tên pháp lý'] = sau.ten; note.push('tên'); }
  if (sau.mst !== undefined) { d['MST'] = sau.mst; note.push('MST'); d['CIF (nếu là KH TP)'] = ''; try { fillCif_([d], true); } catch (e) { /* không chặn sửa */ } }
  if (sau.tenRutGon !== undefined) d['Tên rút gọn'] = sau.tenRutGon;
  if (sau.nganh !== undefined) d['Ngành'] = sau.nganh;
  if (sau.ghiChu !== undefined) d['Ghi chú'] = sau.ghiChu;
  if (sau.caNhan !== undefined) d['Cá nhân'] = sau.caNhan ? 'Có' : '';
  d['Ngày sửa'] = now;
  if (note.length) d['Ghi chú'] = [str_(d['Ghi chú']), 'Sửa ' + note.join('+') + ' ' + now.slice(0, 10) + ' bởi ' + u.username].filter(Boolean).join(' · ');
}

/* ================= DUYỆT LÔ ================= */
function apiApproveLot_(u, body) {
  return withLock_(function () {
    var lots = rows_('Lo'), id = str_(body.batchId), now = nowIso_();
    var lot = lots.filter(function (l) { return str_(l['Batch_ID']) === id; })[0];
    if (!lot) throw new Error('Không thấy lô ' + id + '.');
    if (str_(lot['Trạng thái']) !== LO_PENDING) throw new Error('Lô ' + id + ' không ở trạng thái chờ duyệt.');
    if (!canApprove_(u, lot['Team'])) throw new Error('FORBIDDEN: chỉ Teamlead cùng team hoặc Admin được duyệt.');
    lot['Người duyệt'] = u.username; lot['Ngày duyệt'] = now;
    var dts = rows_('DoiTac'), tg = rows_('TenGop');
    if (body.ok) {
      lot['Trạng thái'] = LO_ACTIVE; _supersede_(lots, lot);
      dts.forEach(function (d) { if (str_(d['Trạng thái']) === DT_PENDING && _hasLot_(d['Lô tạo'], id)) d['Trạng thái'] = DT_ACTIVE; });
      tg.forEach(function (a) { if (str_(a['Trạng thái']) === 'Chờ duyệt' && _hasLot_(a['Lô'], id)) a['Trạng thái'] = 'Đã duyệt'; });
    } else {
      lot['Trạng thái'] = LO_REJECTED; lot['Lý do'] = str_(body.reason);
      // tối thiểu dữ liệu: bỏ dòng công nợ của lô bị từ chối; đối tác/tên gộp chờ duyệt chỉ của các lô đã từ chối → xóa
      writeTable_('CongNo', rows_('CongNo').filter(function (r) { return str_(r['Batch_ID']) !== id; }));
      var st = {}; lots.forEach(function (l) { st[str_(l['Batch_ID'])] = str_(l['Trạng thái']); });
      var allRejected = function (f) { return str_(f).split(',').every(function (x) { return st[str_(x)] === LO_REJECTED; }); };
      dts = dts.filter(function (d) { return !(str_(d['Trạng thái']) === DT_PENDING && allRejected(d['Lô tạo'])); });
      tg = tg.filter(function (a) { return !(str_(a['Trạng thái']) === 'Chờ duyệt' && allRejected(a['Lô'])); });
    }
    writeTable_('Lo', lots); writeTable_('DoiTac', dts); writeTable_('TenGop', tg);
    log_(u, body.ok ? 'Duyệt lô' : 'Từ chối lô', id, str_(body.reason));
    return { id: id, status: lot['Trạng thái'] };
  });
}

/* ================= DANH MỤC ĐỐI TÁC ================= */
function apiEditDoiTac_(u, body) {
  return withLock_(function () {
    var dts = rows_('DoiTac'), cid = str_(body.cid), now = nowIso_();
    var d = dts.filter(function (x) { return str_(x['Counterparty_ID']) === cid; })[0];
    if (!d) throw new Error('Không thấy đối tác ' + cid + '.');
    var sau = body.sau || {}, truoc = {};
    Object.keys(sau).forEach(function (k) { truoc[k] = { ten: d['Tên pháp lý'], mst: d['MST'], tenRutGon: d['Tên rút gọn'], nganh: d['Ngành'], ghiChu: d['Ghi chú'], caNhan: d['Cá nhân'] === 'Có' }[k]; });
    if (canDirect_(u)) { _applyDtEdit_(d, sau, u, now); writeTable_('DoiTac', dts); log_(u, 'Sửa đối tác', cid, JSON.stringify(sau)); return { applied: true }; }
    var y = _newYc_(u, 'sua-doitac', cid, truoc, sau, now); y['Req_ID'] = 'YC' + ('00000' + nextSeq_('NEXT_YC', 1)).slice(-5);
    appendRows_('YeuCau', [y]); log_(u, 'Đề nghị sửa đối tác', cid, JSON.stringify(sau));
    return { applied: false, request: y['Req_ID'] };
  });
}

function apiMergeDoiTac_(u, body) {
  return withLock_(function () {
    var from = str_(body.from), into = str_(body.into), now = nowIso_();
    if (!from || !into || from === into) throw new Error('Chọn 2 mã đối tác khác nhau để gộp.');
    var ids = rows_('DoiTac').map(function (d) { return str_(d['Counterparty_ID']); });
    if (ids.indexOf(from) < 0 || ids.indexOf(into) < 0) throw new Error('Không thấy mã đối tác.');
    if (canDirect_(u)) { _doMerge_(u, from, into, now); log_(u, 'Gộp đối tác', from + ' → ' + into, ''); return { applied: true }; }
    var y = _newYc_(u, 'gop-doitac', from, { from: from }, { into: into }, now); y['Req_ID'] = 'YC' + ('00000' + nextSeq_('NEXT_YC', 1)).slice(-5);
    appendRows_('YeuCau', [y]); log_(u, 'Đề nghị gộp đối tác', from + ' → ' + into, '');
    return { applied: false, request: y['Req_ID'] };
  });
}
function _doMerge_(u, from, into, now) {
  var dts = rows_('DoiTac'), f = null, t = null;
  dts.forEach(function (d) { if (str_(d['Counterparty_ID']) === from) f = d; if (str_(d['Counterparty_ID']) === into) t = d; });
  if (!str_(t['MST']) && str_(f['MST'])) { t['MST'] = f['MST']; t['Trạng thái MST'] = f['Trạng thái MST']; t['Nguồn MST'] = f['Nguồn MST']; }
  t['Ghi chú'] = [str_(t['Ghi chú']), 'Gộp ' + from + ' ' + now.slice(0, 10) + ' bởi ' + u.username].filter(Boolean).join(' · ');
  writeTable_('DoiTac', dts.filter(function (d) { return d !== f; }));
  var cn = rows_('CongNo'); cn.forEach(function (r) { if (str_(r['Counterparty_ID']) === from) r['Counterparty_ID'] = into; }); writeTable_('CongNo', cn);
  var tg = rows_('TenGop'); tg.forEach(function (a) { if (str_(a['Counterparty_ID']) === from) a['Counterparty_ID'] = into; });
  var k = _key_(f['Tên pháp lý']);
  if (k && !tg.some(function (a) { return str_(a['Khóa']) === k; }) && k !== _key_(t['Tên pháp lý'])) tg.push({ 'Tên gốc': f['Tên pháp lý'], 'Khóa': k, 'Counterparty_ID': into, 'Trạng thái': 'Đã duyệt', 'Người': u.username, 'Ngày': now, 'Lô': '' });
  writeTable_('TenGop', tg);
}

function apiApproveReq_(u, body) {
  return withLock_(function () {
    var ycs = rows_('YeuCau'), id = str_(body.reqId), now = nowIso_();
    var y = ycs.filter(function (r) { return str_(r['Req_ID']) === id; })[0];
    if (!y) throw new Error('Không thấy yêu cầu ' + id + '.');
    if (str_(y['Trạng thái']) !== 'Chờ duyệt') throw new Error('Yêu cầu đã được xử lý.');
    if (!canApprove_(u, y['Team'])) throw new Error('FORBIDDEN: chỉ Teamlead cùng team hoặc Admin được duyệt.');
    if (body.ok) {
      var sau = JSON.parse(y['Sau'] || '{}');
      if (y['Loại'] === 'gop-doitac') _doMerge_(u, str_(y['Counterparty_ID']), str_(sau.into), now);
      else {
        var dts = rows_('DoiTac'), d = dts.filter(function (x) { return str_(x['Counterparty_ID']) === str_(y['Counterparty_ID']); })[0];
        if (!d) throw new Error('Đối tác không còn trong danh mục (có thể đã gộp).');
        _applyDtEdit_(d, sau, u, now); writeTable_('DoiTac', dts);
      }
    }
    ycs = rows_('YeuCau');
    ycs.forEach(function (r) { if (str_(r['Req_ID']) === id) { r['Trạng thái'] = body.ok ? 'Đã duyệt' : 'Từ chối'; r['Người duyệt'] = u.username; r['Ngày duyệt'] = now; r['Lý do'] = str_(body.reason); } });
    writeTable_('YeuCau', ycs);
    log_(u, body.ok ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu', id, str_(body.reason));
    return { id: id, ok: !!body.ok };
  });
}

/* ================= ADMIN ================= */
function _needAdmin_(u) { if (!isAdmin_(u)) throw new Error('FORBIDDEN: chỉ Admin.'); }

function apiSetKhtp_(u, body) {
  _needAdmin_(u);
  return withLock_(function () {
    var rows = (body.rows || []).map(function (r) { return { 'CIF': str_(r.cif), 'MST': str_(r.mst), 'Tên khách hàng': str_(r.ten), 'CN': str_(r.cn) }; })
      .filter(function (r) { return r['CIF'] || r['MST']; });
    writeTable_('KH_TPBank', rows); log_(u, 'Thay danh mục KH TPBank', '', rows.length + ' dòng');
    return { n: rows.length };
  });
}

function apiSetConfig_(u, body) {
  _needAdmin_(u);
  return withLock_(function () {
    var upd = {}, items = body.items || {};
    Object.keys(items).forEach(function (k) { if (CONFIG_ADMIN_EDITABLE.indexOf(k) >= 0) upd[k] = items[k]; });
    setConfig_(upd); log_(u, 'Sửa tham số', Object.keys(upd).join(', '), JSON.stringify(upd));
    return { updated: Object.keys(upd) };
  });
}

function apiEditKhhh_(u, body) {
  return withLock_(function () {
    var kh = rows_('KHHH'), cif = str_(body.cif), s = body.sau || {};
    var k = kh.filter(function (x) { return str_(x['CIF']) === cif; })[0];
    if (!k) throw new Error('Không thấy KHHH ' + cif + '.');
    if (!(isAdmin_(u) || canApprove_(u, k['Team']))) throw new Error('FORBIDDEN: Admin hoặc Teamlead của team quản lý KHHH.');
    var map = { ten: 'Tên khách hàng', mst: 'MST', vietTat: 'Tên viết tắt', nganh: 'Ngành', phanKhuc: 'Phân khúc', dvkd: 'ĐVKD', rm: 'RM/PTKD phụ trách' };
    Object.keys(map).forEach(function (f) { if (s[f] !== undefined) k[map[f]] = str_(s[f]); });
    writeTable_('KHHH', kh); log_(u, 'Sửa KHHH', cif, JSON.stringify(s));
    return { ok: true };
  });
}

/** Xóa toàn bộ dữ liệu 1 KHHH (tất toán / yêu cầu) — Admin. */
function apiDeleteKhhh_(u, body) {
  _needAdmin_(u);
  return withLock_(function () {
    var cif = str_(body.cif);
    var lots = rows_('Lo'), ids = {};
    lots.forEach(function (l) { if (str_(l['CIF']) === cif) ids[str_(l['Batch_ID'])] = true; });
    var cn = rows_('CongNo').filter(function (r) { return !ids[str_(r['Batch_ID'])]; });
    writeTable_('CongNo', cn);
    writeTable_('Lo', lots.filter(function (l) { return !ids[str_(l['Batch_ID'])]; }));
    writeTable_('KHHH', rows_('KHHH').filter(function (k) { return str_(k['CIF']) !== cif; }));
    // Đối tác do chính các lô này tạo mà không còn dòng công nợ nào dùng → xóa kèm tên gộp + yêu cầu sửa của nó (16/10)
    var used = {}; cn.forEach(function (r) { used[str_(r['Counterparty_ID'])] = true; });
    var gone = {}, dts = rows_('DoiTac');
    dts.forEach(function (d) { var id = str_(d['Counterparty_ID']); if (ids[str_(d['Lô tạo'])] && !used[id]) gone[id] = true; });
    var nDt = Object.keys(gone).length;
    if (nDt) {
      writeTable_('DoiTac', dts.filter(function (d) { return !gone[str_(d['Counterparty_ID'])]; }));
      writeTable_('TenGop', rows_('TenGop').filter(function (g) { return !gone[str_(g['Counterparty_ID'])]; }));
      writeTable_('YeuCau', rows_('YeuCau').filter(function (y) { return !gone[str_(y['Counterparty_ID'])]; }));
    }
    log_(u, 'Xóa dữ liệu KHHH', cif, Object.keys(ids).length + ' lô · ' + nDt + ' đối tác chỉ lô này dùng');
    return { lots: Object.keys(ids).length, doiTac: nDt };
  });
}

/** Nhập 1 lần kho Excel v0.1 (công cụ HTML offline) — Admin, chỉ khi DB chưa có đối tác. Giữ nguyên mã DTxxxxx. */
function apiImportKho_(u, body) {
  _needAdmin_(u);
  return withLock_(function () {
    if (rows_('DoiTac').length) throw new Error('DB đã có danh mục đối tác — chỉ nhập kho v0.1 vào DB trống.');
    var now = nowIso_(), day = today_();
    var dts = (body.doiTac || []).map(function (d) {
      return { 'Counterparty_ID': str_(d.id), 'MST': str_(d.mst), 'Tên pháp lý': str_(d.ten), 'Tên rút gọn': str_(d.tenRutGon), 'Cá nhân': d.caNhan ? 'Có' : '',
        'Trạng thái MST': str_(d.ttMst), 'Nguồn MST': str_(d.nguonMst), 'Đã là KHHH': str_(d.daLaKH), 'CIF (nếu là KH TP)': str_(d.cifTP), 'Ngành': '',
        'Ghi chú': str_(d.ghiChu), 'Trạng thái': DT_ACTIVE, 'Lô tạo': 'KHO-v0.1', 'Người tạo': u.username, 'Ngày tạo': now, 'Ngày sửa': '' };
    }).filter(function (d) { return /^DT\d+$/.test(d['Counterparty_ID']); });
    var maxDt = dts.reduce(function (m, d) { return Math.max(m, +d['Counterparty_ID'].slice(2)); }, 0);
    var tg = (body.tenGop || []).map(function (a) { return { 'Tên gốc': str_(a.raw), 'Khóa': _key_(a.raw), 'Counterparty_ID': str_(a.id), 'Trạng thái': str_(a.trangThai) || 'Máy gộp', 'Người': u.username, 'Ngày': now, 'Lô': '' }; });
    var kh = (body.khhh || []).map(function (k) { return { 'CIF': str_(k.cif), 'MST': str_(k.mst), 'Tên khách hàng': str_(k.ten), 'Tên viết tắt': str_(k.vietTat), 'Ngành': str_(k.nganh), 'Phân khúc': str_(k.phanKhuc),
      'ĐVKD': str_(k.dvkd), 'RM/PTKD phụ trách': str_(k.rm), 'Team': u.team, 'Người tạo': u.username, 'Ngày tạo': now }; });
    var groups = {}, order = [];
    (body.congNo || []).forEach(function (r) {
      var g = [str_(r.cif), str_(r.tk).slice(0, 3), str_(r.ky)].join('|');
      if (!groups[g]) { groups[g] = { r: r, rows: [] }; order.push(g); }
      groups[g].rows.push(r);
    });
    var seq = nextSeq_('NEXT_LO', order.length || 1), lots = [], cn = [];
    order.forEach(function (g, i) {
      var G = groups[g], id = 'LO' + day.replace(/-/g, '') + '-' + ('0000' + (seq + i)).slice(-4);
      lots.push({ 'Batch_ID': id, 'CIF': str_(G.r.cif), 'Tên KHHH': str_(G.r.tenKH), 'CN': str_(G.r.cn), 'TK': str_(G.r.tk).slice(0, 3), 'Kỳ': str_(G.r.ky), 'Kỳ gốc': str_(G.r.kyGoc),
        'Tệp': 'Kho v0.1: ' + str_(G.r.nguon).slice(0, 150), 'Số dòng': G.rows.length, 'Dòng cân đối': G.rows.filter(function (x) { return x.bal === 'Cân'; }).length,
        'Trạng thái': LO_ACTIVE, 'Người nạp': u.username, 'Team': u.team, 'Ngày nạp': now, 'Người duyệt': u.username, 'Ngày duyệt': now, 'Lý do': 'Nhập kho v0.1', 'Thay thế bởi': '' });
      G.rows.forEach(function (r, j) {
        var o = { 'Batch_ID': id, 'Dòng': j + 1, 'Mã ĐT nội bộ': str_(r.ma), 'Tên đối tác gốc': str_(r.raw), 'Counterparty_ID': str_(r.id), 'Cân đối': r.bal === 'Cân' ? 'Cân' : 'Chưa cân', 'Trang': r.trang || '', 'Ghi chú': str_(r.ghiChu) };
        VAL_COLS.forEach(function (c, k) { o[c] = num_((r.vals || [])[k]); });
        cn.push(o);
      });
    });
    writeTable_('DoiTac', dts); writeTable_('TenGop', tg); writeTable_('KHHH', kh); writeTable_('Lo', lots); writeTable_('CongNo', cn);
    if (body.khTP && body.khTP.length) writeTable_('KH_TPBank', body.khTP.map(function (r) { return { 'CIF': str_(r.cif), 'MST': str_(r.mst), 'Tên khách hàng': str_(r.ten), 'CN': str_(r.cn) }; }));
    setConfig_({ NEXT_DT: maxDt + 1 });
    log_(u, 'Nhập kho v0.1', '', dts.length + ' đối tác · ' + lots.length + ' lô · ' + cn.length + ' dòng');
    return { doiTac: dts.length, lots: lots.length, congNo: cn.length, tenGop: tg.length, khhh: kh.length };
  });
}

function apiAudit_(u, body) {
  _needAdmin_(u);
  var n = Math.min(+body.limit || 300, 2000);
  return { rows: rows_('NhatKy').slice(-n).reverse() };
}

/** Ghi nhật ký thao tác phía trình duyệt (xem chi tiết KHHH/đối tác, xuất Excel). */
var CLIENT_LOG_ACTIONS = ['Xem KHHH', 'Xem đối tác', 'Xuất Excel', 'Tra cứu', 'Tra MST nội bộ'];
function apiLog_(u, body) {
  var a = str_(body.what);
  if (CLIENT_LOG_ACTIONS.indexOf(a) < 0) throw new Error('Hành động nhật ký không hợp lệ.');
  if (a === 'Xuất Excel' && !canDirect_(u) && body.scope === 'all') throw new Error('FORBIDDEN: chỉ Admin/Teamlead xuất toàn bộ.');
  withLock_(function () { log_(u, a, body.target, body.detail); });
  return { ok: true };
}
