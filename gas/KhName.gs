// ⚠ FILE SINH TỰ ĐỘNG từ core/khname.js (node tools/sync_gas.mjs) — KHÔNG sửa tay.
/* khname.js — tìm KH TPBank theo TÊN trong danh sách KH line CB (chạy ở GAS: gas/KhName.gs sinh từ file này; test Node).
 * Tên hệ thống TPB viết tắt + không dấu ("CTY CPDT VA PTNL MAT TROI BACH KHOA"), tên 900k có dấu đầy đủ → cả 2 chuẩn hóa về
 * cùng dạng: bỏ dấu · HOA · "&" = VA · mở viết tắt (CPDT → CO PHAN DAU TU, PTNL → PHAT TRIEN NANG LUONG…).
 * Truy vấn bỏ loại hình (CONG TY, CO PHAN, TNHH…) → mọi token lõi phải có trong tên (token cuối cho phép gõ dở) → điểm:
 * phủ tên (token lõi truy vấn / token lõi tên) + thưởng cụm liền mạch. Thiếu đúng 1 token (truy vấn ≥ 3 token) → hạng dưới. */
(function (G) {
  'use strict';
  const ABBR = {
    CTY: 'CONG TY', CTCP: 'CONG TY CO PHAN', CTTNHH: 'CONG TY TNHH', TCT: 'TONG CONG TY', CP: 'CO PHAN', CPDT: 'CO PHAN DAU TU',
    MTV: 'MOT THANH VIEN', TNHHMTV: 'TNHH MOT THANH VIEN', DNTN: 'DOANH NGHIEP TU NHAN', HTX: 'HOP TAC XA', LTD: 'TNHH', JSC: 'CO PHAN', COMPANY: 'CONG TY',
    DT: 'DAU TU', PT: 'PHAT TRIEN', NL: 'NANG LUONG', PTNL: 'PHAT TRIEN NANG LUONG', DTPT: 'DAU TU PHAT TRIEN', DTXD: 'DAU TU XAY DUNG', DTTM: 'DAU TU THUONG MAI',
    TM: 'THUONG MAI', DV: 'DICH VU', TMDV: 'THUONG MAI DICH VU', DVTM: 'DICH VU THUONG MAI', XD: 'XAY DUNG', XL: 'XAY LAP', SX: 'SAN XUAT', XNK: 'XUAT NHAP KHAU',
    KD: 'KINH DOANH', KT: 'KY THUAT', TV: 'TU VAN', CK: 'CO KHI', TB: 'THIET BI', VLXD: 'VAT LIEU XAY DUNG', BDS: 'BAT DONG SAN', QT: 'QUOC TE',
    VN: 'VIET NAM', TPHCM: 'THANH PHO HO CHI MINH', HCM: 'HO CHI MINH', HN: 'HA NOI', VPDD: 'VAN PHONG DAI DIEN',
  };
  // loại hình + từ nối — bỏ khỏi phần LÕI (dài trước ngắn sau)
  const FORM = ['TONG CONG TY', 'CONG TY', 'TRACH NHIEM HUU HAN', 'TNHH', 'MOT THANH VIEN', 'CO PHAN', 'DOANH NGHIEP TU NHAN', 'HOP TAC XA', 'CHI NHANH', 'VAN PHONG DAI DIEN', 'VA']
    .map(p => new RegExp('(^| )' + p + '(?= |$)', 'g'));

  function boDau(s) { return String(s == null ? '' : s).replace(/[Đđ]/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  /** Tên → chuỗi token chuẩn (HOA, không dấu, đã mở viết tắt), cách nhau 1 dấu cách. */
  function norm(s) {
    const t = boDau(s).toUpperCase().replace(/&/g, ' VA ').replace(/[^A-Z0-9]+/g, ' ').trim();
    if (!t) return '';
    const w = t.split(' ');
    // "CT CP …" / "CT TNHH …" = CÔNG TY (CT đứng riêng còn là Cần Thơ, công trình → chỉ mở khi theo sau là loại hình)
    return w.map((x, i) => (x === 'CT' && /^(CP|CPDT|TNHH|TNHHMTV|MTV|CO)$/.test(w[i + 1] || '') ? 'CONG TY' : ABBR[x] || x)).join(' ');
  }
  function core(n) { let t = ' ' + n + ' '; FORM.forEach(re => { t = t.replace(re, ' '); re.lastIndex = 0; }); return t.replace(/\s+/g, ' ').trim(); }
  /** Truy vấn → {toks: token lõi (rỗng → dùng mọi token), all} */
  function query(q) {
    const all = norm(q), c = core(all);
    const toks = (c || all).split(' ').filter(Boolean);
    return { all, toks, phrase: toks.join(' ') };
  }
  /** Dòng tên đã chuẩn hóa (1 hoặc nhiều tên ngăn bởi " | ") → điểm 0..1.2 (0 = không khớp; thiếu 1 token → ≤ 0,5 và .partial). */
  function score(Q, line) {
    if (!Q.toks.length) return 0;
    let best = 0, part = false;
    const names = line.split(' | ');
    for (let i = 0; i < names.length; i++) {
      const n = names[i]; if (!n) continue;
      const s = ' ' + n + ' ';
      let miss = 0;
      for (let j = 0; j < Q.toks.length; j++) {
        const t = Q.toks[j], last = j === Q.toks.length - 1;
        if (s.indexOf(' ' + t + ' ') >= 0 || (last && t.length >= 2 && s.indexOf(' ' + t) >= 0)) continue;
        if (++miss > 1) break;
      }
      if (miss > 1 || (miss === 1 && Q.toks.length < 3)) continue;
      const nc = core(n).split(' ').filter(Boolean).length || 1;
      let sc = Math.min(1, (Q.toks.length - miss) / nc);
      if (!miss && (' ' + core(n) + ' ').indexOf(' ' + Q.phrase) >= 0) sc += 0.2;   // cụm liền mạch, đúng thứ tự
      if (miss) sc *= 0.5;
      if (sc > best) { best = sc; part = !!miss; }
    }
    score.partial = part;
    return best;
  }
  /** lines: ["CIF\tTÊN CHUẨN 1 | TÊN CHUẨN 2"] → top k [{cif, score}] (điểm giảm dần, tên ngắn trước khi bằng điểm). */
  function search(lines, q, k) {
    const Q = query(q), out = [];
    if (!Q.toks.length || Q.phrase.replace(/ /g, '').length < 3) return out;
    // lọc nhanh bằng token hiếm nhất (dài nhất) trước khi chấm
    const key = Q.toks.slice().sort((a, b) => b.length - a.length)[0];
    const need = Q.toks.length >= 3 ? null : key;
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i], p = L.indexOf('\t'); if (p < 0) continue;
      const body = L.slice(p + 1);
      if (need && body.indexOf(need) < 0) continue;
      const sc = score(Q, body);
      if (sc > 0) out.push({ cif: L.slice(0, p), score: Math.round(sc * 1000) / 1000, len: body.length, part: score.partial });
    }
    // có KH khớp ĐỦ token → bỏ các KH chỉ khớp thiếu 1 token
    if (out.some(x => !x.part)) for (let i = out.length - 1; i >= 0; i--) if (out[i].part) out.splice(i, 1);
    out.sort((a, b) => b.score - a.score || a.len - b.len);
    return out.slice(0, k || 20).map(x => ({ cif: x.cif, score: x.score }));
  }
  /** Dòng K của bảng KH → "CIF\tTÊN HT | TÊN 900K" (đã chuẩn hóa) */
  function line(cif, tenHT, ten900) { return cif + '\t' + norm(tenHT) + (ten900 ? ' | ' + norm(ten900) : ''); }

  const API = { ABBR, norm, core, query, score, search, line, boDau };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.KHN = API;
})(typeof window !== 'undefined' ? window : globalThis);
