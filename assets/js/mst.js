'use strict';
/* mst.js — tra MST từ trình duyệt (giữ nguyên quy tắc v0.1 · D08): chỉ gửi MST hoặc TÊN PHÁP NHÂN ĐỐI TÁC; không gửi KHHH, số tiền, cá nhân.
 * VietQR: MST → tên pháp lý + trạng thái (không khóa). doanhnghiep.vn: tên → ứng viên MST (khóa miễn phí, lưu trên máy này). */
(function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let last = 0;
  async function throttle(ms) { const w = last + ms - Date.now(); if (w > 0) await sleep(w); last = Date.now(); }
  const today = () => new Date().toISOString().slice(0, 10);
  const norm = s => { const d = String(s || '').replace(/[^\d]/g, ''); if (d.length === 13) return d.slice(0, 10) + '-' + d.slice(10); return d.length === 10 ? d : null; };
  async function vietqr(mst) {
    const m = norm(mst); if (!m) return { ok: false, err: 'MST phải 10 số (hoặc 13 số chi nhánh)' };
    await throttle(650);
    try {
      const r = await fetch('https://api.vietqr.io/v2/business/' + m), t = await r.text();
      if (!t) return { ok: false, err: 'không tìm thấy' };
      const j = JSON.parse(t);
      if (j.code !== '00' || !j.data) return { ok: false, err: j.desc || ('mã ' + j.code) };
      return { ok: true, mst: j.data.id, name: j.data.name, short: j.data.shortName, address: j.data.address, status: j.data.status, src: 'VietQR ' + today() };
    } catch (e) { return { ok: false, err: 'Không kết nối được VietQR (mạng chặn?) — ' + e.message }; }
  }
  const key = () => CN.net.LS.get('cn360_dnKey') || '';
  async function search(name) {
    if (!key()) return { ok: false, err: 'Cần khóa doanhnghiep.vn (nhập ở bước ③)' };
    await throttle(2100);
    try {
      const r = await fetch('https://doanhnghiep.vn/api/v1/search?q=' + encodeURIComponent(name), { headers: { 'x-api-key': key() } });
      const remain = r.headers.get('x-ratelimit-remaining-month');
      if (!r.ok) return { ok: false, err: 'doanhnghiep.vn trả lỗi ' + r.status, remain };
      const j = await r.json(), arr = Array.isArray(j) ? j : (j.data || j.results || j.items || j.companies || []);
      const cands = (Array.isArray(arr) ? arr : []).slice(0, 5).map(x => ({ mst: x.mst || x.taxCode || x.tax_code || x.ma_so_thue || x.id, name: x.name || x.ten || x.companyName || x.ten_cong_ty,
        address: x.address || x.dia_chi || '', status: x.status || x.trang_thai || '', src: 'doanhnghiep.vn ' + today() })).filter(c => c.mst);
      return { ok: true, cands, remain };
    } catch (e) { return { ok: false, err: 'Không kết nối được doanhnghiep.vn — ' + e.message }; }
  }
  CN.mst = { vietqr, search, key, setKey: k => CN.net.LS.set('cn360_dnKey', k), norm };
})();
