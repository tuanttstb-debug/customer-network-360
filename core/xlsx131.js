/* Đọc bảng "Tổng hợp công nợ" 131/331 từ EXCEL theo cấu trúc cột (không qua bố cục OCR) — thuần JS, không DOM (chạy được trong Node để test).
 * Vào: mảng 2 chiều (SheetJS sheet_to_json header:1, raw:true, cellDates:true). Ra: [{header, rows, total, warn, tkSet}] — mỗi phần tử 1 TK (131/331).
 * Nhận cột theo tiêu đề: nhóm (đầu kỳ · phát sinh · cuối kỳ) × (Nợ · Có), tiêu đề 1–3 dòng, ô gộp (merge) để trống được.
 * Dòng "Cộng tài khoản …"/"Cộng nhóm" bỏ qua; "Tổng cộng" = dòng tổng (không có thì lấy tổng các dòng "Cộng").
 * Cột "Mã ĐT/KH/NCC" có dạng MST (10 số hoặc 10-3) → gợi ý MST đối tác; 12 số (CCCD) → đánh dấu cá nhân. */
(function (G) {
  'use strict';
  const SIGN = [1, -1, 1, -1, -1, 1]; // ĐKN − ĐKC + PSN − PSC − (CKN − CKC) = 0
  const str = v => (v == null ? '' : v instanceof Date ? '' : String(v)).normalize('NFC').replace(/\s+/g, ' ').trim();
  const na = v => str(v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const words = v => na(v).replace(/[^a-z0-9]+/g, ' ').trim();

  /* ---------- Số trong ô ---------- */
  /** Ô → số nguyên (VND) | 0 (trống, "-") | null (không phải số) */
  function cellNum(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
    let s = str(v).replace(/\s/g, '');
    if (!s || /^[-–—.,]+$/.test(s)) return 0;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/^[-–—]/.test(s)) { neg = true; s = s.replace(/^[-–—]+/, ''); }
    if (!/^\d[\d.,]*$/.test(s)) return null;
    let n, m;
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) n = +s.replace(/[.,]/g, '');                                   // "1.234.567" — phân cách nghìn (VND)
    else if ((m = s.match(/^(\d{1,3}(?:([.,])\d{3})+)([.,])(\d{1,2})$/)) && m[2] !== m[3]) n = Math.round(+(m[1].replace(/[.,]/g, '') + '.' + m[4]));   // "1.234,56"
    else if (/^\d+[.,]\d{1,2}$/.test(s)) n = Math.round(+s.replace(',', '.'));                          // "1234,5"
    else if (/^\d+$/.test(s)) n = +s;
    else return null;
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  }

  /* ---------- Tiêu đề: TK, kỳ ---------- */
  const iso = (d, m, y) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const yy = y => (String(y).length === 2 ? 2000 + +y : +y);
  const validD = (d, m, y) => d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2100;
  const lastDay = (m, y) => new Date(y, m, 0).getDate();
  const dateOf = d => iso(d.getDate(), d.getMonth() + 1, d.getFullYear());
  /** text (đã bỏ dấu) + ngày dạng Date trong vùng tiêu đề + tên tệp → {tk, tu, den, ky, kyGoc} */
  function parseMeta(text, dates, fileName) {
    const t = words(text), f = words(fileName || '');
    const h = { tk: null, tu: null, den: null, ky: null, kyGoc: '' };
    let m = na(text).match(/tai kho\S*\s*[:;.]?\s*\(?\s*(\d{3,4})/);
    if (m) h.tk = m[1].slice(0, 3);
    else if (/phai thu|cong no khach hang/.test(t)) h.tk = '131';
    else if (/phai tra|nha cung cap/.test(t)) h.tk = '331';
    if (!h.tk) { const mf = f.match(/(?:^| )(131|331)(?: |$)/); if (mf) h.tk = mf[1]; else if (/phai thu/.test(f)) h.tk = '131'; else if (/phai tra/.test(f)) h.tk = '331'; }
    const D = '(\\d{1,2})\\s*[/.-]\\s*(\\d{1,2})\\s*[/.-]\\s*(\\d{4}|\\d{2})(?!\\d)';
    const raw = na(text);
    m = raw.match(new RegExp('tu ngay\\s*' + D + '.{0,20}?den ngay\\s*' + D));
    if (m && validD(+m[1], +m[2], yy(m[3])) && validD(+m[4], +m[5], yy(m[6]))) { h.tu = iso(+m[1], +m[2], yy(m[3])); h.den = iso(+m[4], +m[5], yy(m[6])); h.kyGoc = m[0].replace(/\s+/g, ' '); }
    if (!h.den) {
      const ds = [...raw.matchAll(new RegExp(D, 'g'))].map(x => [+x[1], +x[2], yy(x[3])]).filter(x => validD(...x));
      const dd = (dates || []).map(d => [d.getDate(), d.getMonth() + 1, d.getFullYear()]).filter(x => validD(...x));
      const all = ds.concat(dd);
      if (all.length >= 2) { h.tu = iso(...all[0]); h.den = iso(...all[1]); } else if (all.length === 1) h.den = iso(...all[0]);
    }
    const src = t + ' | ' + f;
    if (!h.den && (m = src.match(/quy\s*(i{1,3}|iv|[1-4])\D{0,8}?(20\d{2})/))) {
      const q = { i: 1, ii: 2, iii: 3, iv: 4 }[m[1]] || +m[1], y = +m[2];
      h.tu = iso(1, q * 3 - 2, y); h.den = iso(lastDay(q * 3, y), q * 3, y); h.kyGoc = 'Quý ' + q + '/' + y;
    }
    if (!h.den && (m = src.match(/thang\s*(\d{1,2})\s*(?:nam|[/.-])?\s*(20\d{2})/))) { const mo = +m[1], y = +m[2]; if (mo >= 1 && mo <= 12) { h.tu = iso(1, mo, y); h.den = iso(lastDay(mo, y), mo, y); h.kyGoc = 'Tháng ' + mo + '/' + y; } }
    if (!h.den && (m = src.match(/nam\s*(20\d{2})/))) { h.tu = m[1] + '-01-01'; h.den = m[1] + '-12-31'; h.kyGoc = 'Năm ' + m[1]; }
    if (h.den) h.ky = h.den;
    if (!h.kyGoc && h.tu && h.den) h.kyGoc = h.tu + ' → ' + h.den; else if (!h.kyGoc && h.den) h.kyGoc = h.den;
    return h;
  }

  /* ---------- Tiêu đề cột ---------- */
  const PER = [['dk', /dau ky|dau nam|dau thang|dau quy|ky truoc|du dau|ton dau/], ['ps', /phat sinh|\bps\b|trong ky/], ['ck', /cuoi ky|cuoi nam|cuoi thang|cuoi quy|du cuoi|ton cuoi/]];
  const sideOf = s => { const w = ' ' + words(s) + ' '; const no = / no /.test(w), co = / co /.test(w); return no && !co ? 'no' : co && !no ? 'co' : null; };
  const perOf = s => { const w = words(s); const p = PER.find(([, re]) => re.test(w)); return p ? p[0] : null; };
  /** Thử khối tiêu đề kết thúc ở dòng e, cao span dòng → {map:{dkNo:c,…}, texts[], score} */
  function tryHeader(aoa, e, span) {
    const s0 = e - span + 1; if (s0 < 0) return null;
    const width = Math.max(...aoa.slice(s0, e + 1).map(r => (r || []).length), 0);
    const texts = Array(width).fill('').map((_, c) => {
      const parts = [];
      for (let r = s0; r <= e; r++) {
        let v = str((aoa[r] || [])[c]);
        // ô gộp ngang ở dòng trên (nhóm "Số dư đầu kỳ" trải 2 cột) → kế thừa ô trái gần nhất có chữ, chỉ cho nhóm kỳ
        if (!v && r < e) { for (let k = c - 1; k >= 0 && k >= c - 3; k--) { const u = str((aoa[r] || [])[k]); if (u) { if (perOf(u)) v = u; break; } } }
        if (v) parts.push(v);
      }
      return parts.join(' | ');
    });
    const map = {}; let n = 0;
    texts.forEach((t, c) => {
      const last = str((aoa[e] || [])[c]), side = sideOf(last) || sideOf(t), per = perOf(t);
      if (!side) return;
      const k = (per || '?') + (side === 'no' ? 'No' : 'Co');
      if (map[k] === undefined) { map[k] = c; n++; }
    });
    // Không có nhãn kỳ nhưng đủ 6 cột Nợ/Có theo thứ tự → đầu kỳ · phát sinh · cuối kỳ
    if (map['?No'] !== undefined) {
      const cols = texts.map((t, c) => (sideOf(str((aoa[e] || [])[c])) ? c : -1)).filter(c => c >= 0);
      if (cols.length === 6) { ['dkNo', 'dkCo', 'psNo', 'psCo', 'ckNo', 'ckCo'].forEach((k, i) => { map[k] = cols[i]; }); }
      delete map['?No']; delete map['?Co'];
    }
    const keys = ['dkNo', 'dkCo', 'psNo', 'psCo', 'ckNo', 'ckCo'].filter(k => map[k] !== undefined);
    return keys.length >= 4 ? { map, texts, n: keys.length, e, s0 } : null;
  }
  const filled = r => (r || []).filter(v => str(v)).length >= 2;   // dòng tiêu đề cột có ≥ 2 ô; dòng tên báo cáo/kỳ chỉ 1 ô
  /** Khối tiêu đề: dòng e đầu tiên nhận đủ nhiều cột tiền nhất; khối gồm các dòng có chữ liền trên (tối đa 3) để lấy nhãn Mã/TK/Tên */
  function findHeader(aoa) {
    let best = null;
    for (let e = 0; e < Math.min(aoa.length, 60); e++) {
      let span = 1; while (span < 3 && e - span >= 0 && filled(aoa[e - span])) span++;
      let h = null; for (let s = span; s >= 1 && !h; s--) h = tryHeader(aoa, e, s);
      if (h && (!best || h.n > best.n)) best = h;
      if (best && best.n === 6 && e > best.e) break;   // đủ 6 cột → dừng ở khối đầu tiên
    }
    return best;
  }

  /* ---------- Dòng ---------- */
  // "Tổng công ty …" là TÊN đối tác, không phải dòng tổng
  const TOTAL_RE = /^(tong cong(?! ty)\b|tong so\b|cong phat sinh\b|cong so phat sinh\b|tong\s*$)/;
  const SUB_RE = /^cong( (tai khoan|tk|nhom|so|chi tiet)\b| \d|$)|^tong (tai khoan|tk|nhom)\b/;
  const MST_RE = /^\d{10}(-\d{3})?$/, CCCD_RE = /^\d{12}$/;
  function maOf(v) {
    if (typeof v === 'number' && Number.isInteger(v) && v > 0) { const s = String(v); return s.length === 9 ? '0' + s : s; }   // Excel nuốt số 0 đầu MST
    return str(v);
  }

  /** aoa → [{header, rows, total, warn}] (theo TK) hoặc null nếu không nhận ra bảng */
  function parse(aoa, opts) {
    opts = opts || {};
    aoa = (aoa || []).map(r => r || []);
    const H = findHeader(aoa); if (!H) return null;
    const warn = [];
    const M = H.map, money = ['dkNo', 'dkCo', 'psNo', 'psCo', 'ckNo', 'ckCo'];
    const firstMoney = Math.min(...money.filter(k => M[k] !== undefined).map(k => M[k]));
    // cột trái
    const T = H.texts.map(words);
    const left = T.map((t, c) => c).filter(c => c < firstMoney);
    const find = re => left.find(c => re.test(T[c]));
    const sttC = find(/^(s ?tt|tt|so tt|so thu tu)\b/);
    const tkC = find(/\btk\b|tai khoan|so hieu/);
    const maC = left.filter(c => c !== tkC && /\bma\b/.test(T[c])).sort((a, b) => (/dt|doi tuong|kh|khach|ncc|nha cung|doi tac/.test(T[b]) ? 1 : 0) - (/dt|doi tuong|kh|khach|ncc|nha cung|doi tac/.test(T[a]) ? 1 : 0))[0];
    let tenC = left.find(c => c !== maC && c !== tkC && !/\bma\b/.test(T[c]) && /\bten\b|doi tuong|khach hang|nha cung cap|doi tac|dien giai/.test(T[c]));
    const body = aoa.slice(H.e + 1);
    if (tenC === undefined) {   // không có chữ "Tên" → cột chữ dài nhất bên trái vùng tiền
      let bestL = 0; left.filter(c => c !== sttC && c !== tkC && c !== maC).forEach(c => { const L = body.slice(0, 200).reduce((s, r) => s + (typeof r[c] === 'string' ? str(r[c]).length : 0), 0); if (L > bestL) { bestL = L; tenC = c; } });
    }
    if (tenC === undefined) return null;

    const rows = [], subs = [], loose = []; let total = null;
    for (let i = 0; i < body.length; i++) {
      const r = body[i];
      const ten = str(r[tenC]), ma = maC !== undefined ? maOf(r[maC]) : '', tkv = tkC !== undefined ? str(r[tkC]).replace(/\D/g, '') : '';
      const nums = money.map(k => (M[k] === undefined ? 0 : cellNum(r[M[k]])));
      const has = money.some(k => M[k] !== undefined && str(r[M[k]]) !== '' && r[M[k]] != null);
      const label = words(left.map(c => (typeof r[c] === 'string' ? r[c] : '')).filter(Boolean).join(' ')) || words(ten);
      const lt = words(ten) || label;
      if (TOTAL_RE.test(lt) || TOTAL_RE.test(label)) { if (has) { total = { ten: 'TỔNG CỘNG', vals: nums.map(v => v || 0), row: H.e + 2 + i }; break; } continue; }
      if (SUB_RE.test(lt) || SUB_RE.test(label)) { if (has) subs.push(nums.map(v => v || 0)); continue; }
      if (!has) continue;                               // dòng nhóm / chữ ký / trống
      if (!ten && !ma) { loose.push(nums.map(v => v || 0)); continue; }
      if (nums.some(v => v === null)) warn.push('Dòng ' + (H.e + 2 + i) + ': có ô không phải số — kiểm tra lại.');
      const row = { stt: sttC !== undefined ? (parseInt(str(r[sttC]), 10) || null) : null, ma, ten: ten || ma, tkCT: tkv, tk: tkv ? tkv.slice(0, 3) : '', vals: nums, xlsRow: H.e + 2 + i };
      if (MST_RE.test(ma)) row.mstGoc = ma; else if (CCCD_RE.test(ma)) row.caNhanGoc = true;
      rows.push(row);
    }
    // thiếu cột đầu kỳ (bảng chỉ có PS + CK) → suy đầu kỳ để dòng cân đối
    const miss = money.filter(k => M[k] === undefined);
    if (miss.length) {
      if (miss.every(k => /^dk/.test(k))) {
        warn.push('Bảng không có cột Dư đầu kỳ — máy suy ra = Dư cuối kỳ − Phát sinh.');
        const fill = v => { const net = (v[4] - v[5]) - (v[2] - v[3]); v[0] = net > 0 ? net : 0; v[1] = net < 0 ? -net : 0; };
        rows.forEach(r => fill(r.vals)); if (total) fill(total.vals); subs.forEach(fill);
      } else warn.push('Thiếu cột ' + miss.join(', ') + ' — kiểm tra lại tiêu đề bảng.');
    }
    if (!total && subs.length) { total = { ten: 'TỔNG CỘNG', vals: money.map((_, j) => subs.reduce((s, v) => s + v[j], 0)), fromSubs: true }; warn.push('Không có dòng "Tổng cộng" — dùng tổng các dòng "Cộng tài khoản".'); }
    if (!total && loose.length) {
      const sums = money.map((_, j) => rows.reduce((s, r) => s + (r.vals[j] || 0), 0));
      const hit = loose.find(v => v.every((x, j) => x === sums[j])); if (hit) total = { ten: 'TỔNG CỘNG', vals: hit };
    }
    // meta: chữ phía trên bảng + ngày dạng Date + tên tệp
    const top = aoa.slice(0, H.e + 1);
    const meta = parseMeta(top.map(r => r.map(str).filter(Boolean).join(' ')).join(' \n '), top.flat().filter(v => v instanceof Date), opts.fileName);
    const tkRows = [...new Set(rows.map(r => r.tk).filter(t => /^(131|331)$/.test(t)))];
    if (!meta.tk && tkRows.length === 1) meta.tk = tkRows[0];
    rows.forEach(r => { if (!/^(131|331)$/.test(r.tk)) r.tk = meta.tk || r.tk; });
    const cols = { stt: sttC, ma: maC, tk: tkC, ten: tenC, money: money.map(k => M[k]) };
    // 1 sheet có cả 131 và 331 → tách theo TK
    const groups = tkRows.length > 1 ? tkRows : [meta.tk || ''];
    return groups.map(tk => {
      const rs = tkRows.length > 1 ? rows.filter(r => r.tk === tk) : rows;
      return { header: Object.assign({}, meta, { tk: tk || meta.tk }), rows: rs.map(finish), total: tkRows.length > 1 ? null : (total ? finish(total) : null), warn: warn.slice(), cols, headerRow: H.e + 1 };
    });
  }
  function finish(r) {
    const vals = r.vals.map(v => (v === null ? null : v));
    const diff = vals.some(v => v === null) ? null : vals.reduce((s, v, i) => s + SIGN[i] * v, 0);
    return Object.assign({}, r, { cells: vals.map(v => (v === null ? '' : String(v))), vals, status: vals.map(v => (v === null ? 'bad' : 'ok')), bal: diff === null ? 'thieu' : diff === 0 ? 'ok' : 'lech', diff, page: 1, bandTop: 0, bandBot: 0 });
  }

  const API = { parse, cellNum, parseMeta, findHeader };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.X131 = API;
})(typeof window !== 'undefined' ? window : globalThis);
