'use strict';
/* store.js — dữ liệu trong BỘ NHỚ trang (không localStorage/IndexedDB — A4): tải từ GAS theo quyền → chuẩn hóa → mô hình.
 * Đóng tab là hết dữ liệu trên máy. */
(function () {
  const S = { user: null, raw: null, data: null, M: null, loadedAt: null, pendingForMe: 0 };
  const s = v => (v === null || v === undefined ? '' : String(v).trim());
  const d10 = v => s(v).slice(0, 10);
  const VALS = ['Dư Nợ đầu kỳ', 'Dư Có đầu kỳ', 'Phát sinh Nợ', 'Phát sinh Có', 'Dư Nợ cuối kỳ', 'Dư Có cuối kỳ'];

  function normalize(r) {
    const khhh = r.khhh.map(k => ({ cif: s(k['CIF']), mst: s(k['MST']), ten: s(k['Tên khách hàng']), vietTat: s(k['Tên viết tắt']), nganh: s(k['Ngành']), phanKhuc: s(k['Phân khúc']),
      dvkd: s(k['ĐVKD']), rm: s(k['RM/PTKD phụ trách']), team: s(k['Team']) })).filter(k => k.cif);
    const doiTac = r.doiTac.map(d => ({ id: s(d['Counterparty_ID']), mst: s(d['MST']), ten: s(d['Tên pháp lý']), tenRutGon: s(d['Tên rút gọn']), caNhan: s(d['Cá nhân']) === 'Có',
      ttMst: s(d['Trạng thái MST']), nguonMst: s(d['Nguồn MST']), cifTP: s(d['CIF (nếu là KH TP)']), nganh: s(d['Ngành']), ghiChu: s(d['Ghi chú']), status: s(d['Trạng thái']) || 'Hoạt động',
      lotTag: s(d['Lô tạo']), by: s(d['Người tạo']) })).filter(d => d.id);
    const tenGop = r.tenGop.map(a => ({ raw: s(a['Tên gốc']), key: s(a['Khóa']), id: s(a['Counterparty_ID']), trangThai: s(a['Trạng thái']) })).filter(a => a.raw && a.id);
    tenGop.forEach(a => { if (!a.key && window.MAP131) a.key = MAP131.key(a.raw); });
    const khTP = r.khTP.map(k => ({ cif: s(k['CIF']), mst: s(k['MST']), ten: s(k['Tên khách hàng']), cn: s(k['CN']) }));
    const lots = r.lots.map(l => ({ id: s(l['Batch_ID']), cif: s(l['CIF']), tenKH: s(l['Tên KHHH']), cn: s(l['CN']), tk: s(l['TK']).slice(0, 3), ky: d10(l['Kỳ']), kyGoc: s(l['Kỳ gốc']), file: s(l['Tệp']),
      n: +l['Số dòng'] || 0, nOk: +l['Dòng cân đối'] || 0, status: s(l['Trạng thái']), by: s(l['Người nạp']), team: s(l['Team']), at: s(l['Ngày nạp']), approver: s(l['Người duyệt']),
      approvedAt: s(l['Ngày duyệt']), reason: s(l['Lý do']) }));
    const congNo = r.congNo.map(c => ({ lot: s(c['Batch_ID']), line: +c['Dòng'] || 0, ma: s(c['Mã ĐT nội bộ']), raw: s(c['Tên đối tác gốc']), id: s(c['Counterparty_ID']), vals: VALS.map(h => +c[h] || 0), bal: s(c['Cân đối']), page: c['Trang'] }));
    const yeuCau = r.yeuCau.map(y => ({ id: s(y['Req_ID']), loai: s(y['Loại']), cid: s(y['Counterparty_ID']), truoc: safeJson(y['Trước']), sau: safeJson(y['Sau']), by: s(y['Người đề nghị']), team: s(y['Team']),
      at: s(y['Ngày']), status: s(y['Trạng thái']), approver: s(y['Người duyệt']), reason: s(y['Lý do']) }));
    return { khhh, doiTac, tenGop, khTP, lots, congNo, yeuCau, config: r.config || {} };
  }
  function safeJson(v) { try { return JSON.parse(v || '{}'); } catch (e) { return {}; } }

  async function load() {
    const r = await CN.net.call('load', {}, { timeoutMs: CN.CONFIG.READ_TIMEOUT_MS });
    S.raw = null; S.user = r.user; S.pendingForMe = r.pendingForMe || 0; S.version = r.version;
    S.data = normalize(r); S.loadedAt = new Date();
    S.M = CNModel.compute(S.data, { chiCan: chiCan() });
    return S;
  }
  /* Công tắc "Chỉ số đã cân" (D17): mặc định BẬT, nhớ theo máy — chỉ là tùy chọn hiển thị, không phải dữ liệu KH. */
  const chiCan = () => CN.net.LS.get('cn360_chi_can') !== '0';
  function setChiCan(on) { CN.net.LS.set('cn360_chi_can', on ? '1' : '0'); if (S.data) S.M = CNModel.compute(S.data, { chiCan: !!on }); }

  const role = () => (S.user ? S.user.role : '');
  const isAdmin = () => role() === 'Admin';
  const canDirect = () => role() === 'Admin' || role() === 'Teamlead';
  const canApprove = team => isAdmin() || (role() === 'Teamlead' && String(team || '') === String(S.user.team || ''));
  const dtById = id => S.data.doiTac.find(d => d.id === id);
  const khByCif = cif => S.data.khhh.find(k => k.cif === cif);
  /** Kho cho MAP131.assign ở bước gộp: đối tác + tên gộp đang thấy được. */
  const khoForMapping = () => ({ doiTac: S.data.doiTac.map(d => ({ id: d.id, mst: d.mst, ten: d.ten, caNhan: d.caNhan, ttMst: d.ttMst, nguonMst: d.nguonMst })), alias: S.data.tenGop.map(a => ({ raw: a.raw, key: a.key, id: a.id })) });

  CN.store = { S, load, chiCan, setChiCan, normalize, isAdmin, canDirect, canApprove, dtById, khByCif, khoForMapping, role };
})();
