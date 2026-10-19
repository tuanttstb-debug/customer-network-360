'use strict';
/* xlsx_io.js — Xuất Excel (ghi nhật ký; User chỉ xuất KHHH mình nạp) · đọc kho Excel v0.1 để nhập 1 lần · đọc danh mục KH TPBank. SheetJS tải khi cần. */
(function () {
  const S = () => CN.store.S;
  const ws = (h, rows) => XLSX.utils.aoa_to_sheet([h, ...rows]);
  const fname = p => p + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.xlsx';
  async function save(wb, fn, scope, detail) {
    await CN.net.call('log', { what: 'Xuất Excel', target: fn, scope, detail });   // server chặn User xuất toàn bộ
    if (window.__NO_DOWNLOAD) { window.__lastWb = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }); window.__lastWbName = fn; return; }
    XLSX.writeFile(wb, fn);
  }
  const run = fn => async (...a) => { try { CN.ui.busy(true, 'Đang tạo file Excel…'); await CNLoad.ensureXlsx(); await fn(...a); CN.ui.toast('Đã xuất Excel (đã ghi nhật ký)', 'ok'); } catch (e) { CN.ui.toast(e.message, 'err'); } finally { CN.ui.busy(false); } };

  /** Toàn bộ dữ liệu theo phạm vi quyền: Admin/Teamlead = tất cả; User = KHHH có lô do mình nạp. */
  const exportAll = run(async () => {
    const st = S(), all = CN.store.canDirect(), me = st.user.username.toLowerCase();
    const myCif = new Set(st.data.lots.filter(l => l.by.toLowerCase() === me).map(l => l.cif));
    const lots = st.data.lots.filter(l => l.status === 'Đã duyệt' && (all || myCif.has(l.cif))), lotIds = new Map(lots.map(l => [l.id, l]));
    const wb = XLSX.utils.book_new(), dt = new Map(st.data.doiTac.map(d => [d.id, d]));
    XLSX.utils.book_append_sheet(wb, ws(['Kỳ', 'Kỳ gốc', 'CN', 'CIF', 'Tên KHHH', 'TK', 'Mã ĐT nội bộ', 'Tên đối tác gốc', 'Counterparty_ID', 'Tên pháp lý', 'MST đối tác', 'Dư Nợ đầu kỳ', 'Dư Có đầu kỳ', 'Phát sinh Nợ', 'Phát sinh Có', 'Dư Nợ cuối kỳ', 'Dư Có cuối kỳ', 'Cân đối', 'Lô', 'Người nạp'],
      st.data.congNo.filter(c => lotIds.has(c.lot) && !(CN.store.chiCan() && c.bal === 'Chưa cân')).map(c => { const l = lotIds.get(c.lot), d = dt.get(c.id) || {}; return [l.ky, l.kyGoc, l.cn, l.cif, l.tenKH, l.tk, c.ma, c.raw, c.id, d.ten || '', d.mst || '', ...c.vals, c.bal, l.id, l.by]; })), 'CongNo');
    const ids = new Set(st.data.congNo.filter(c => lotIds.has(c.lot)).map(c => c.id));
    XLSX.utils.book_append_sheet(wb, ws(['Counterparty_ID', 'MST', 'Tên pháp lý', 'Cá nhân', 'Trạng thái MST', 'Nguồn MST', 'Đã là KH TPBank', 'Ngành', 'Ghi chú'],
      st.data.doiTac.filter(d => all || ids.has(d.id)).map(d => [d.id, d.mst, d.ten, d.caNhan ? 'Có' : '', d.ttMst, d.nguonMst, st.M.daLaKH.get(d.id) ? 'Có' : 'Không', d.nganh, d.ghiChu])), 'DoiTac');
    XLSX.utils.book_append_sheet(wb, ws(['Tên gốc', 'Counterparty_ID', 'Trạng thái'], st.data.tenGop.filter(a => all || ids.has(a.id)).map(a => [a.raw, a.id, a.trangThai])), 'TenGop');
    XLSX.utils.book_append_sheet(wb, ws(['CIF', 'MST', 'Tên khách hàng', 'Tên viết tắt', 'Ngành', 'Phân khúc', 'ĐVKD', 'RM/PTKD phụ trách', 'Team'],
      st.data.khhh.filter(k => all || myCif.has(k.cif)).map(k => [k.cif, k.mst, k.ten, k.vietTat, k.nganh, k.phanKhuc, k.dvkd, k.rm, k.team])), 'KHHH');
    const E = st.M.edges.filter(e => all || myCif.has(e.cif));
    XLSX.utils.book_append_sheet(wb, ws(['CIF', 'Khách hàng', 'Team', 'Counterparty_ID', 'Đối tác chuẩn hóa', 'MST đối tác', 'Đã là KH TPBank', 'Vai trò suy luận', 'Nguồn bằng chứng', 'PS phải thu', 'Thu hồi/giảm PT', 'Dư PT cuối kỳ', 'Tỷ lệ thu hồi', 'PS phải trả', 'Thanh toán/giảm PP', 'Dư PP cuối kỳ', 'Tỷ lệ thanh toán', 'Tỷ trọng trong hệ', 'Tổng quy mô quan hệ', 'Điểm sức mạnh quan hệ', 'Phân nhóm quan hệ', 'Hạng theo KHHH', 'Hạng theo đối tác'],
      E.map(e => [e.cif, e.tenKH, e.team, e.id, e.ten, e.mst, e.daLaKH ? 'Có' : 'Không', e.role, e.evidence, e.psThu, e.thuHoi, e.duThu, e.tlThuHoi, e.psTra, e.traTien, e.duTra, e.tlTra, e.share, e.scale, Math.round(e.strength * 10) / 10, e.group, e.rankAll, e.rankByDt])), '08_Relationship_Edge');
    oppSheet(wb, all ? st.M.opps : st.M.opps.filter(o => (st.M.byDt.get(o.id) || []).some(e => myCif.has(e.cif))));
    riskSheet(wb, st.M.risks.filter(r => all || myCif.has(r.cif)));
    await save(wb, fname('CN360_DuLieu'), all ? 'all' : 'mine', lots.length + ' lô');
  });
  function oppSheet(wb, opps) {
    XLSX.utils.book_append_sheet(wb, ws(['Hạng', 'Counterparty_ID', 'Đối tác tiềm năng', 'MST', 'Vai trò chính', 'Số KHHH liên kết', 'PS phải thu', 'PS phải trả', 'Tổng quy mô quan hệ', 'KHHH cầu nối', 'CIF cầu nối', 'Team cầu nối', 'ĐVKD cầu nối', 'RM cầu nối', 'Điểm cơ hội', 'Mức ưu tiên', 'Hành động tiếp theo', 'TOI kỳ vọng'],
      opps.map(o => [o.rank, o.id, o.ten, o.mst, o.role, o.nKH, o.psThu, o.psTra, o.scale, o.bridge.tenKH, o.bridge.cif, o.bridge.team, o.bridge.dvkd, o.bridge.rm, Math.round(o.score * 10) / 10, o.priority, o.action, Math.round(o.toi)])), '09_Opportunity');
  }
  function riskSheet(wb, risks) {
    XLSX.utils.book_append_sheet(wb, ws(['Hạng', 'CIF', 'Khách hàng', 'Team', 'Counterparty_ID', 'Đối tác', 'Vai trò suy luận', 'Tỷ trọng', 'Tổng quy mô QH', 'Loại cảnh báo tập trung', 'Mức độ', 'Mắt xích chung', 'PS phải thu 3T gần nhất', 'PS phải thu 3T trước', '% thay đổi', 'Suy giảm đầu ra', 'Đối tác ngừng/tạm HĐ', 'Hành động khuyến nghị'],
      risks.map(r => [r.rank, r.cif, r.tenKH, r.team, r.id, r.ten, r.role, r.share, r.scale, r.type, r.level, r.chain, r.ps3a, r.ps3b, r.chg === null ? '' : r.chg, r.decline, r.stop, r.action])), '11_Risk_Alert');
  }
  /** Sheet Counterparty theo "TEMPLATE - KHHH TPBANK ver 3" (CR Duyên 19/10 · D19/D20): bố cục 2 dòng tiêu đề A–AB y hệt mẫu.
   *  B = MST, chưa có → mã DT (D19) · D = mã CN quản lý CIF đối tác (tra mst-cif lúc xuất; lỗi → để trống) · K–O, T–AB để trống (đợt 2, không SĐT). */
  const CP_GROUPS = [['E1:I1', 'THÔNG TIN PS NỢ - CÓ VỚI KHHH'], ['J1:O1', 'THÔNG TIN KHÁCH HÀNG'], ['P1:S1', 'THÔNG TIN PS VỚI KHHH TẠI TPK'], ['T1:AB1', 'THÔNG TIN CIC']];
  const CP_HEAD = ['STT', 'MST (ID đối tác)', 'CIF đối tác (nếu có)', 'ĐVKD QL đối tác\n(mã số)', 'Tên đối tác', 'KỲ PS', 'TK', 'Tổng DS phát sinh nợ', 'Tổng DS phát sinh có', 'Tổng phát sinh trên KHHH',
    'Doanh thu 2024', 'Doanh số trúng thầu 2025', 'DS xuất nhập khẩu 2024', 'Người đại diện PL', 'SDT di động', 'MST KHHH', 'CIF KHHH', 'TÊN KHHH', 'Tỷ trọng phát sinh trên KHHH',
    'Ngày báo cáo CIC', 'Dư nợ ngắn hạn VND', 'Dư nợ ngắn hạn USD', 'Dư nợ trung-dài hạn VND', 'Dư nợ trung-dài hạn USD', 'Cam kết ngoại bảng VND', 'Cam kết ngoại bảng USD', 'GIA TRI NO QH', 'LS CO PS NQH (YES/NO)'];
  const dmy = ky => (/^(\d{4})-(\d\d)-(\d\d)/.test(ky) ? ky.slice(8, 10) + '/' + ky.slice(5, 7) + '/' + ky.slice(0, 4) : ky);
  function counterpartySheet(rows, cnOf) {
    const top = Array(28).fill(''); CP_GROUPS.forEach(([rg, t]) => { top[XLSX.utils.decode_range(rg).s.c] = t; });
    const aoa = [top, CP_HEAD, ...rows.map((r, i) => [i + 1, r.mst || r.id, r.cifDT, cnOf(r.mst), r.ten, dmy(r.ky), +r.tk || r.tk, r.no, r.co, r.tong, '', '', '', '', '', r.mstKH, r.cif, r.tenKH, 0,
      '', '', '', '', '', '', '', '', ''])];
    const sh = XLSX.utils.aoa_to_sheet(aoa);
    rows.forEach((r, i) => {
      const R = i + 3;
      ['H', 'I', 'J'].forEach(c => { sh[c + R].z = '#,##0'; });
      sh['S' + R] = { t: 'n', v: r.tong ? (r.no + r.co) / r.tong : 0, f: `IF(J${R}=0,0,(H${R}+I${R})/J${R})`, z: '0.00%' };
    });
    sh['!merges'] = CP_GROUPS.map(([rg]) => XLSX.utils.decode_range(rg));
    sh['!cols'] = CP_HEAD.map((h, j) => ({ wch: j === 0 ? 5 : j === 4 || j === 17 ? 40 : Math.max(12, Math.min(22, h.length + 2)) }));
    return sh;
  }
  const exportCounterparty = run(async () => {
    const st = S(), all = CN.store.canDirect(), me = st.user.username.toLowerCase();
    const cifs = all ? null : new Set(st.data.lots.filter(l => l.by.toLowerCase() === me).map(l => l.cif));
    const rows = CNModel.counterparty(st.data, { chiCan: CN.store.chiCan(), cifs });
    if (!rows.length) throw new Error('Chưa có dữ liệu công nợ đã duyệt trong phạm vi của bạn.');
    let map = {};
    try { map = (await CN.mstidx.cif(rows.map(r => r.mst).filter(Boolean), 'Xuất Counterparty')).map; }
    catch (e) { CN.ui.toast('Không tra được ĐVKD đối tác (' + e.message + ') — cột D để trống', 'err'); }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, counterpartySheet(rows, m => (m && map[m] && map[m].cn) || ''), 'Counterparty');
    await save(wb, fname('CN360_Counterparty'), all ? 'all' : 'mine', rows.length + ' dòng' + (CN.store.chiCan() ? ' · chỉ số đã cân' : ''));
  });
  const exportOpps = run(async () => { const wb = XLSX.utils.book_new(); oppSheet(wb, S().M.opps); await save(wb, fname('CN360_CoHoi'), 'view', S().M.opps.length + ' cơ hội'); });
  const exportRisks = run(async () => { const wb = XLSX.utils.book_new(); riskSheet(wb, S().M.risks); await save(wb, fname('CN360_RuiRo'), 'view', S().M.risks.length + ' cảnh báo'); });

  // ---- Đọc file ----
  const objs = (wb, name) => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true }) : []);
  const d10 = v => { if (v instanceof Date) { const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000); return d.toISOString().slice(0, 10); } return String(v || '').slice(0, 10); };
  /** Kho Excel v0.1 (Kho_DoiTac_131_331_*.xlsx) → payload import-kho. */
  async function readKhoV01(file) {
    await CNLoad.ensureXlsx();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    if (!wb.Sheets.DoiTac || !wb.Sheets.CongNo) throw new Error('Không phải file kho v0.1 (cần sheet DoiTac + CongNo).');
    const V = ['Dư Nợ đầu kỳ', 'Dư Có đầu kỳ', 'Phát sinh Nợ', 'Phát sinh Có', 'Dư Nợ cuối kỳ', 'Dư Có cuối kỳ'];
    return {
      doiTac: objs(wb, 'DoiTac').map(r => ({ id: String(r['Counterparty_ID']).trim(), mst: String(r['MST'] || '').trim(), ten: r['Tên pháp lý'], tenRutGon: r['Tên rút gọn'], caNhan: /^(có|x|1|true)$/i.test(String(r['Cá nhân'])),
        ttMst: r['Trạng thái MST'], nguonMst: r['Nguồn MST'], daLaKH: r['Đã là KHHH'], cifTP: r['CIF (nếu là KH TP)'], ghiChu: r['Ghi chú'] })).filter(d => d.id),
      tenGop: objs(wb, 'TenGop').map(r => ({ raw: String(r['Tên gốc']), id: String(r['Counterparty_ID']).trim(), trangThai: r['Trạng thái'] })).filter(a => a.raw && a.id),
      khhh: objs(wb, 'KHHH').map(r => ({ cif: String(r['CIF']).trim(), mst: String(r['MST'] || '').trim(), ten: r['Tên khách hàng'], vietTat: r['Tên viết tắt'], nganh: r['Ngành'], phanKhuc: r['Phân khúc'], dvkd: r['ĐVKD'], rm: r['RM/PTKD phụ trách'] })).filter(k => k.cif),
      khTP: objs(wb, 'KH_TPBank').map(r => ({ cif: String(r['CIF']).trim(), mst: String(r['MST'] || '').trim(), ten: r['Tên khách hàng'], cn: r['CN'] })).filter(k => k.cif || k.mst),
      congNo: objs(wb, 'CongNo').map(r => ({ ky: d10(r['Kỳ']), kyGoc: r['Kỳ gốc'], cn: r['CN'], cif: String(r['CIF']), tenKH: r['Tên KHHH'], tk: String(r['TK']), ma: r['Mã ĐT nội bộ'], raw: r['Tên đối tác gốc'], id: String(r['Counterparty_ID']),
        vals: V.map(h => +r[h] || 0), bal: r['Cân đối'], nguon: r['Nguồn tệp'], trang: r['Trang'], ghiChu: r['Ghi chú'] })).filter(r => r.cif && r.id && /^\d{4}-\d\d-\d\d$/.test(r.ky)),
    };
  }
  /** Danh mục KH tại TPBank: sheet KH_TPBank hoặc sheet đầu có cột CIF/MST. */
  async function readKhTP(file) {
    await CNLoad.ensureXlsx();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const name = wb.SheetNames.find(n => n === 'KH_TPBank') || wb.SheetNames[0];
    const rows = objs(wb, name), pick = (r, re) => { const k = Object.keys(r).find(h => re.test(h)); return k ? String(r[k]).trim() : ''; };
    return rows.map(r => ({ cif: pick(r, /^cif/i), mst: pick(r, /^mst|mã số thuế/i), ten: pick(r, /tên/i), cn: pick(r, /^cn$|chi nhánh|đvkd/i) })).filter(r => r.cif || r.mst);
  }
  CN.xlsx = { exportAll, exportCounterparty, counterpartySheet, exportOpps, exportRisks, readKhoV01, readKhTP };
})();
