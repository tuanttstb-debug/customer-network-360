// ⚠ FILE SINH TỰ ĐỘNG từ core/mapping.js (node tools/sync_gas.mjs) — KHÔNG sửa tay.
/* Khâu B — mã đối tác duy nhất + gộp tên (thuần JS, chạy được trong Node để test).
 * Quy tắc (YEU_CAU §5 R5–R8): bảng Tên gộp (người duyệt) → trùng MST → trùng tên chuẩn hóa = tự gộp ·
 * giống 85–99% hoặc tên cụt khớp tiền tố = GỢI Ý chờ người duyệt · < 85% = đối tác mới.
 * Không tự gộp khi khác số hiệu ("… Số 1" ≠ "… Số 2", "319" ≠ "479"). Cá nhân/hộ KD → nhãn riêng, không tra MST ra ngoài. */
(function (G) {
  'use strict';
  const NA = s => String(s == null ? '' : s).normalize('NFC').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();

  // Lỗi OCR hay gặp ở tiền tố pháp nhân (sau khi bỏ dấu)
  const OCR_FIX = [[/\bG[O0]NG\s*TY\b/g, 'CONG TY'], [/\bC[O0]NG\s*1Y\b/g, 'CONG TY'], [/\bC[O0]NGTY\b/g, 'CONG TY'], [/\bC[O0]\s*PHAN\b/g, 'CO PHAN'], [/\bG[O0]\s*PHAN\b/g, 'CO PHAN'],
    [/\bTNHHTHUONG\b/g, 'TNHH THUONG'], [/\bCONG Y\b/g, 'CONG TY'], [/\bT[O0]NG\s*CONG\s*TY\b/g, 'TONG CONG TY']];
  // Hình thức pháp lý: bỏ khi so khớp (giữ TỔNG, TẬP ĐOÀN, CHI NHÁNH, BAN… vì đổi nghĩa pháp nhân)
  const FORM = /\b(CONG TY|CTY|CT|TNHH|TRACH NHIEM HUU HAN|CO PHAN|CP|CTCP|MTV|MOT THANH VIEN|HAI THANH VIEN( TRO LEN)?|DNTN|DOANH NGHIEP TU NHAN|JSC|CO LTD|LTD|CORP|CORPORATION)\b/g;
  const ABBR = [[/\bXD\b/g, 'XAY DUNG'], [/\bTM\b/g, 'THUONG MAI'], [/\bDV\b/g, 'DICH VU'], [/\bSX\b/g, 'SAN XUAT'], [/\bDT\b/g, 'DAU TU'], [/\bXNK\b/g, 'XUAT NHAP KHAU'],
    [/\bPT\b/g, 'PHAT TRIEN'], [/\bBQL\b/g, 'BAN QUAN LY'], [/\bBQLDA\b/g, 'BAN QUAN LY DU AN'], [/\bQLDA\b/g, 'QUAN LY DU AN'], [/\bVT\b/g, 'VAT TU'], [/\bKT\b/g, 'KY THUAT'], [/\bCN\b/g, 'CHI NHANH'],
    [/\bHTX\b/g, 'HOP TAC XA'], [/\bTP\b/g, 'THANH PHO'], [/\bTPHCM\b/g, 'THANH PHO HO CHI MINH'], [/\bHCM\b/g, 'HO CHI MINH'], [/\bVN\b/g, 'VIET NAM']];
  const ORG_RE = /\b(CONG TY|CTY|CTCP|TNHH|CO PHAN|TONG CONG TY|TAP DOAN|BAN QUAN LY|BAN QLDA|BQL|BQLDA|CHI NHANH|HOP TAC XA|HTX|VIEN|DNTN|DOANH NGHIEP|TRUNG TAM|NGAN HANG|LIEN DOANH|XI NGHIEP|NHA MAY|TRUONG|BENH VIEN|SO |UBND|UY BAN|CUC |KHO BAC|BAO HIEM|HIEP HOI|CORP|JSC|LTD|GROUP|HOLDING|INVEST|CONSTRUCTION|ENGINEERING)\b/;

  function key(raw) {
    let s = NA(raw).replace(/[^A-Z0-9&]+/g, ' ').replace(/\s+/g, ' ').trim();
    OCR_FIX.forEach(([a, b]) => { s = s.replace(a, b); });
    ABBR.forEach(([a, b]) => { s = s.replace(a, b); });
    s = s.replace(FORM, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }
  const digits = s => (NA(s).match(/\d+/g) || []).join(',');
  function isPerson(raw) {
    const s = NA(raw).replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || ORG_RE.test(s + ' ')) return false;
    const w = s.split(' ');
    return w.length >= 2 && w.length <= 5 && !/\d/.test(raw);
  }

  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let p = Array.from({ length: n + 1 }, (_, j) => j), c = new Array(n + 1);
    for (let i = 1; i <= m; i++) { c[0] = i; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); [p, c] = [c, p]; }
    return p[n];
  }
  /** Độ giống 0..1 giữa 2 tên gốc → {s, why} */
  function similarity(a, b) {
    const ka = key(a), kb = key(b);
    if (!ka || !kb) return { s: 0, why: 'rỗng' };
    if (ka === kb) return { s: 1, why: 'trùng tên chuẩn hóa' };
    const da = digits(a), db = digits(b);
    const charR = 1 - lev(ka, kb) / Math.max(ka.length, kb.length);
    // OCR hay dính/tách chữ ("KẾBDC") → so thêm bản bỏ khoảng trắng
    const na = ka.replace(/ /g, ''), nb = kb.replace(/ /g, ''), nsR = 1 - lev(na, nb) / Math.max(na.length, nb.length);
    const ta = new Set(ka.split(' ')), tb = new Set(kb.split(' '));
    const inter = [...ta].filter(t => tb.has(t)).length, tokR = (2 * inter) / (ta.size + tb.size);
    let s = Math.max(charR, nsR * 0.99, tokR * 0.98), why = 'giống ' + Math.round(s * 100) + '%';
    // tên cụt (bảng in cắt chữ): tên ngắn ≥ 12 ký tự là tiền tố tên dài
    const [sh, lg] = na.length <= nb.length ? [na, nb] : [nb, na];
    if (sh.length >= 12 && lg.startsWith(sh)) { s = Math.max(s, 0.93); why = 'tên có thể bị cắt — khớp phần đầu'; }
    if (da !== db) { s = Math.min(s, 0.8); why += ' · khác số hiệu (' + (da || '–') + ' / ' + (db || '–') + ')'; }
    return { s: Math.round(s * 1000) / 1000, why };
  }

  const pad = n => 'DT' + String(n).padStart(5, '0');
  /**
   * Kho = {doiTac:[{id, mst, ten, tenRutGon, caNhan, ...}], alias:[{raw, key, id, trangThai:'Đã duyệt'|'Máy gộp'}]}
   * names = [{raw, mst?}] → [{raw, id|null, kind:'alias'|'mst'|'trung-ten'|'goi-y'|'moi'|'ca-nhan', cand:[{id, ten, s, why}]}]
   * opts: {auto=1 (trùng chuẩn hóa), suggest=0.85}
   */
  function assign(names, kho, opts) {
    opts = Object.assign({ suggest: 0.85 }, opts || {});
    const dt = kho.doiTac, aliasByKey = new Map(), byMst = new Map(), byKey = new Map();
    kho.alias.forEach(a => aliasByKey.set(a.key || key(a.raw), a.id));
    dt.forEach(d => { if (d.mst) byMst.set(String(d.mst).trim(), d.id); const k = key(d.ten); if (k && !byKey.has(k)) byKey.set(k, d.id); });
    let seq = dt.reduce((m, d) => { const x = /^DT(\d+)$/.exec(d.id || ''); return x ? Math.max(m, +x[1]) : m; }, 0);
    const newIn = []; // đối tác mới tạo trong lô này (để gộp các tên trùng nhau trong cùng lô)
    const out = names.map(n => {
      const raw = String(n.raw || '').trim(), k = key(raw);
      const r = { raw, key: k, id: null, kind: null, cand: [] };
      if (!raw) { r.kind = 'rong'; return r; }
      if (aliasByKey.has(k)) { r.id = aliasByKey.get(k); r.kind = 'alias'; return r; }
      if (n.mst && byMst.has(String(n.mst).trim())) { r.id = byMst.get(String(n.mst).trim()); r.kind = 'mst'; return r; }
      if (byKey.has(k)) { r.id = byKey.get(k); r.kind = 'trung-ten'; return r; }
      const pool = [...dt.map(d => ({ id: d.id, ten: d.ten })), ...newIn];
      r.cand = pool.map(d => Object.assign({ id: d.id, ten: d.ten }, similarity(raw, d.ten))).filter(c => c.s >= opts.suggest).sort((a, b) => b.s - a.s).slice(0, 3);
      const nk = newIn.find(d => key(d.ten) === k);
      if (nk) { r.id = nk.id; r.kind = 'trung-ten'; return r; }
      if (isPerson(raw)) r.caNhan = true;
      // chưa khớp chắc → cấp mã mới; nếu có gợi ý thì đánh dấu chờ duyệt (người chọn gộp hoặc giữ mới)
      seq++; r.id = pad(seq); r.kind = r.cand.length ? 'goi-y' : (r.caNhan ? 'ca-nhan' : 'moi');
      newIn.push({ id: r.id, ten: raw });
      return r;
    });
    return out;
  }

  const API = { key, isPerson, similarity, assign, pad, NA };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.MAP131 = API;
})(typeof window !== 'undefined' ? window : globalThis);
