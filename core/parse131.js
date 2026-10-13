/* Lõi phân tích bảng "Tổng hợp công nợ" 131/331 từ toạ độ từ OCR — thuần JS, không DOM (chạy được trong Node để test).
 * Bố cục: dòng neo theo cột trái (STT · mã · tên · TK), 6 cột tiền theo mép phải số (số căn phải):
 *   ĐK Nợ · ĐK Có · PS Nợ · PS Có · CK Nợ · CK Có.
 * Giá trị ô lấy từ 1 hoặc nhiều "bản đọc" (OCR cả trang · OCR từng ô) → chọn tổ hợp làm dòng cân đối. */
(function (G) {
  'use strict';
  const COLS = ['dkNo', 'dkCo', 'psNo', 'psCo', 'ckNo', 'ckCo'];
  const COL_LABEL = ['Dư đầu kỳ Nợ', 'Dư đầu kỳ Có', 'Phát sinh Nợ', 'Phát sinh Có', 'Dư cuối kỳ Nợ', 'Dư cuối kỳ Có'];
  const SIGN = [1, -1, 1, -1, -1, 1]; // ĐKN − ĐKC + PSN − PSC − (CKN − CKC) = 0

  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  const strip = s => String(s == null ? '' : s).normalize('NFC').trim();
  const noAccent = s => strip(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

  /* ---------- Số kiểu Việt Nam ---------- */
  function fixDigits(s) {
    return strip(s)
      .replace(/[)\]|}]+$/, '').replace(/^[(\[|{]+(?=\d)/, '')          // vạch kẻ sót dính 2 đầu số
      .replace(/[⁄\/]/g, ',').replace(/[’'`´]/g, ',')
      .replace(/(?<=\d)[Oo](?=[\d.,]|$)|(?<=^|[.,])[Oo](?=\d)/g, '0')
      .replace(/(?<=\d)[lI|](?=[\d.,]|$)|(?<=^|[.,])[lI|](?=\d)/g, '1')
      .replace(/[“”"_~:;¡!]/g, '').replace(/\s+/g, '');
  }
  /** Chuỗi ô số → {v, ok, blank}. "-", rỗng → 0. Phân cách nghìn . hoặc , ; (x) = âm. ok=false: đọc được số nhưng nhóm chữ số sai (nghi ngờ). */
  function parseNum(raw) {
    // số âm dạng (x) phải nhận trước khi fixDigits cắt ngoặc (ngoặc lẻ = vạch kẻ sót)
    const paren = /^\s*\(\s*[\d.,\s]+\)\s*$/.test(String(raw == null ? '' : raw));
    let s = fixDigits(raw);
    if (!s || /^[-–—.,]+$/.test(s)) return { v: 0, ok: true, blank: !s };
    let neg = paren;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/^[-–—]/.test(s)) { neg = true; s = s.replace(/^[-–—]+/, ''); }
    s = s.replace(/^[.,]+|[.,]+$/g, '');
    if (!/^\d[\d.,]*$/.test(s)) return { v: null, ok: false };
    const g = s.split(/[.,]+/), v0 = +g.join('');
    const v = neg ? -v0 : v0;
    const okGroups = g.length === 1 ? g[0].length <= 15 : (g[0].length <= 3 && g.slice(1).every(x => x.length === 3));
    return { v, ok: Number.isFinite(v) && okGroups };
  }
  function numericish(str) {
    const s = strip(str); if (!s) return false;
    const d = (s.match(/\d/g) || []).length; if (!d) return false;
    const letters = (s.match(/[A-Za-zÀ-ỹ]/g) || []).length;
    return d >= letters * 2;
  }

  /* ---------- Tiêu đề: TK, kỳ ---------- */
  function parseHeader(text) {
    const t = noAccent(text).replace(/\s+/g, ' ');
    const h = { tk: null, tu: null, den: null, ky: null, loai: null };
    let m = t.match(/tai kho\S*\s*[:;.]?\s*(\d{3,4})/i); if (m) h.tk = m[1];
    if (/phai thu/i.test(t)) h.loai = '131'; else if (/phai tra/i.test(t)) h.loai = '331';
    if (!h.tk && h.loai) h.tk = h.loai;
    if (h.tk && !h.loai) h.loai = h.tk.slice(0, 3);
    const D = '(\\d{1,2})\\s*[/.-]\\s*(\\d{1,2})\\s*[/.-]\\s*(\\d{4})';
    const iso = (d, mo, y) => y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    m = t.match(new RegExp('tu ngay\\s*' + D + '.{0,14}?den ngay\\s*' + D, 'i'));
    if (m) { h.tu = iso(m[1], m[2], m[3]); h.den = iso(m[4], m[5], m[6]); }
    else if ((m = t.match(/nam\s*(20\d{2})/i))) { h.tu = m[1] + '-01-01'; h.den = m[1] + '-12-31'; }
    else if ((m = t.match(/(?:thang|ky)\s*(\d{1,2})\s*[/.-]\s*(20\d{2})/i))) { const last = new Date(+m[2], +m[1], 0).getDate(); h.tu = iso(1, m[1], m[2]); h.den = iso(last, m[1], m[2]); }
    else {
      // OCR làm hỏng chữ "Từ ngày … đến ngày" → lấy các ngày hợp lệ bất kỳ trong vùng tiêu đề: 2 ngày = từ/đến, 1 ngày = đến
      const ds = [...t.matchAll(new RegExp(D, 'g'))].map(x => [+x[1], +x[2], +x[3]]).filter(([d, mo, y]) => d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100);
      if (ds.length >= 2) { h.tu = iso(...ds[0]); h.den = iso(...ds[1]); } else if (ds.length === 1) h.den = iso(...ds[0]);
    }
    if (h.den) h.ky = h.den;
    return h;
  }

  /* ---------- Gom dòng ---------- */
  function toLines(words) {
    const mh = med(words.map(w => w.h)) || 20;
    // "từ" cao bất thường (vết dấu, vạch dọc, chữ ký) làm phình dòng → dải dòng chồng nhau → bỏ khi gom dòng
    words = words.filter(w => w.h <= mh * 2.5);
    const ws = [...words].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x), lines = [];
    ws.forEach(w => {
      const cy = w.y + w.h / 2, L = lines[lines.length - 1];
      if (L && Math.abs(L.cy - cy) <= 0.55 * mh) { L.words.push(w); L.cy = (L.cy * (L.words.length - 1) + cy) / L.words.length; L.y0 = Math.min(L.y0, w.y); L.y1 = Math.max(L.y1, w.y + w.h); }
      else lines.push({ cy, y0: w.y, y1: w.y + w.h, words: [w] });
    });
    lines.forEach(L => { L.words.sort((a, b) => a.x - b.x); L.text = L.words.map(w => w.str).join(' '); });
    return lines;
  }
  const TOTAL_RE = /^(tong cong(?!\s*ty)|tong so|cong phat sinh|so dong|cong)(\s*[:=]|\s*\d|\s*$)/i;
  const STT_RE = /^[^\p{L}\d]{0,2}\d{1,3}[^\p{L}\d]*$/u; // "12" "12." "„5" "2“" (OCR dính dấu)
  const isTotalText = s => { const t = noAccent(s).replace(/[^a-z0-9 =:]/gi, ' ').replace(/\s+/g, ' ').trim(); return TOTAL_RE.test(t) || /\btong cong\b(?!\s*ty)|\bso dong\s*=/i.test(t); };
  const isNoCo = s => /^(n[oợọơóòởỡ]|c[oóòôọơố]|g[oóô])[.:|]?$/i.test(strip(s));
  // Tiền tố pháp nhân → mốc tách "mã nội bộ" đứng trước tên
  // Tiền tố pháp nhân — so NGUYÊN TOKEN (bỏ dấu, chỉ chữ); riêng công ty/tổng cho phép dính chữ sau ("CôngTyĐiệnLực").
  // (bản cũ dùng tiền tố chuỗi → "SOL" khớp "Sở" → mã nội bộ lọt vào tên)
  const PREFIX_SET = new Set(['cong', 'gong', 'cty', 'ctcp', 'ctyc', 'tong', 'ban', 'bql', 'bqlda', 'chi', 'htx', 'vien', 'dntn', 'doanh', 'trung', 'ngan', 'hop', 'xi', 'nha', 'truong', 'benh', 'so', 'ubnd', 'uy', 'lien', 'tap']);
  const PREFIX_TOKEN = s => { const t = noAccent(s).toLowerCase().replace(/[^a-z]/g, ''); return t && (PREFIX_SET.has(t) || /^(cong|gong|cty|ctcp|tongcong)/.test(t)) ? t : null; };

  function clusterEdges(edges, tol) {
    const s = [...edges].sort((a, b) => a - b), out = [];
    s.forEach(e => { const g = out[out.length - 1]; if (g && e - g.max <= tol) { g.v.push(e); g.max = e; } else out.push({ v: [e], max: e }); });
    return out.map(g => ({ x: med(g.v), n: g.v.length, min: g.v[0], max: g.max }));
  }

  /** Bóc phần trái của dòng: STT · mã nội bộ · tên · TK */
  function splitLeft(tokens) {
    let stt = null, ma = null, tk = null;
    const t = tokens.map(strip).filter(s => s && !/^[|_—–\-=.,:;'"`~^*\[\]()]+$/.test(s));
    if (t.length && STT_RE.test(t[0])) { stt = parseInt(t[0], 10); t.shift(); }
    // TK ở đuôi (vd "… HOLDING 131")
    while (t.length && /^(131|331|1311|1312|3311|3312|1388|3388)[.,]?$/.test(t[t.length - 1].replace(/[^\d]/g, '') + '') && /^\d+[.,]?$/.test(t[t.length - 1])) tk = tk || t.pop().replace(/[^\d]/g, '');
    if (t.length) { const last = t[t.length - 1]; const m = last.match(/^(.*\D)(131|331)$/); if (m && m[1].length > 2) { t[t.length - 1] = m[1]; tk = tk || m[2]; } }
    // đuôi tên dính mảnh số TK do OCR (vd "… BEES 13", "… DING 1") — chỉ bỏ khi là mảnh của 131/331, không đụng số trong tên ("Tổng công ty 319", "Dự án 85")
    // mã nội bộ: các token trước tiền tố pháp nhân đầu tiên (tối đa 3 token, có '_' hoặc toàn hoa ngắn)
    const pi = t.findIndex(s => PREFIX_TOKEN(s));
    if (pi > 0 && pi <= 3) { const head = t.slice(0, pi).join(''); if (/[_.]|^[A-Z0-9©Œœ]{2,}$/.test(head) || pi <= 2) { ma = head.replace(/^[©Œœ]/, 'C').replace(/^G(?=T[_.])/, 'C'); t.splice(0, pi); } }
    else if (pi < 0 && t.length > 1 && /[_]/.test(t[0])) { ma = t.shift(); }
    // đuôi tên dính mảnh số TK do OCR ("… BEES 13", "… DING 1", "… SOI 151") — chỉ với tên pháp nhân và chỉ mảnh của 131/331 (không đụng "Tổng công ty 319", "Dự án 85")
    while (t.length > 2 && /^(1|3|13|31|33|131|331|151)$/.test(t[t.length - 1]) && t.some(PREFIX_TOKEN)) t.pop();
    // bỏ ký hiệu rác ở 2 đầu tên — dùng lớp Unicode (\W của JS coi chữ có dấu "ả", "Á", "ỹ" là ký hiệu → từng cắt "Nguyễn Văn Giả" thành "… Gi", 2026-10-13)
    const ten = t.join(' ').replace(/^[^\p{L}\p{N}(]+/u, '').replace(/[^\p{L}\p{N})]+$/u, '').replace(/\s+/g, ' ').trim();
    return { stt, ma, ten, tk };
  }

  /**
   * Bố cục trang từ words OCR cả trang → {header, colR[6], colW, moneyLeft, rows[{y0,y1,bandTop,bandBot,stt,ma,ten,tk}], total, warn}
   */
  function layout(words, opts) {
    opts = opts || {};
    const warn = [];
    const W = words.filter(w => strip(w.str));
    const mh = med(W.map(w => w.h)) || 20, cw = mh * 0.55;
    const lines = toLines(W);
    const header = parseHeader(lines.slice(0, 10).map(l => l.text).join(' '));

    // Đáy tiêu đề bảng: dòng cuối trong 15 dòng đầu chứa chữ tiêu đề cột
    let hdrEnd = -1;
    lines.slice(0, 15).forEach((L, i) => { const t = noAccent(L.text).toLowerCase(); const nc = L.words.filter(w => isNoCo(w.str)).length;
      if (nc >= 3 || /ten (khach|nha|doi)|ma (khach|nha)|so du dau|so phat sinh|so du cuoi|\bstt\b/.test(t)) hdrEnd = i; });
    const noCo = hdrEnd >= 0 ? lines.slice(0, hdrEnd + 1).flatMap(L => L.words.filter(w => isNoCo(w.str))) : [];

    // Cột tiền: mép phải token số dưới tiêu đề (≥1 chữ số; số tiền căn phải)
    const yHdr = hdrEnd >= 0 ? lines[hdrEnd].y1 : 0;
    const numTok = W.filter(w => w.y > yHdr - 2 && numericish(w.str) && (strip(w.str).replace(/\D/g, '').length >= 4 || /^[0-]$/.test(strip(w.str))));
    const cl = clusterEdges(numTok.map(w => w.x + w.w), Math.max(8, cw * 1.8)).filter(c => c.n >= 2);
    // cột TK (131/331) và STT là cụm số nhỏ → chỉ lấy cụm có số ≥4 chữ số
    const big = cl.filter(c => numTok.some(w => Math.abs(w.x + w.w - c.x) <= cw * 2 && strip(w.str).replace(/\D/g, '').length >= 4));
    // 6 cột tiền cách đều: lấy cụm phải nhất làm CK Có, tìm bước g khớp nhiều cụm nhất, bắt cột vào lưới đều
    // (cột trống vẫn có vị trí; cụm lệch lưới — số tràn, vệt — bị loại)
    let colR = [];
    if (big.length >= 2) {
      const x6 = big[big.length - 1].x, pageW = opts.pageW || 3000;
      const near = (x, tol) => { let b = null; big.forEach(c => { if (Math.abs(c.x - x) <= tol && (!b || c.n > b.n)) b = c; }); return b; };
      const score = g => { let s = 0, hit = 0; for (let k = 1; k <= 5; k++) { const c = near(x6 - k * g, g * 0.15); if (c) { s += c.n; hit++; } } return s + hit * 3; };
      let bestG = 0, bestS = -1;
      big.slice(0, -1).forEach(c => { for (let k = 1; k <= 5; k++) { const g = (x6 - c.x) / k; if (g < cw * 7 || g > pageW / 4.5) continue; const s = score(g); if (s > bestS) { bestS = s; bestG = g; } } });
      if (bestG) {
        // tinh chỉnh g theo các cụm đã bắt được (hồi quy qua gốc x6)
        let num = 0, den = 0; for (let k = 1; k <= 5; k++) { const c = near(x6 - k * bestG, bestG * 0.15); if (c) { num += k * (x6 - c.x); den += k * k; } }
        const g = den ? num / den : bestG;
        // cột phải nhất toàn số 0 (vd Dư cuối kỳ Có) không vào "big" → nếu có cụm bất kỳ đúng 1 bước bên phải thì dịch lưới sang phải
        let xr = x6; for (let s = 0; s < 2; s++) { const c = cl.find(q => Math.abs(q.x - (xr + g)) <= g * 0.15); if (c) xr = c.x; else break; }
        const nearAny = (x, tol) => { let b = null; cl.forEach(c => { if (Math.abs(c.x - x) <= tol && (!b || c.n > b.n)) b = c; }); return b; };
        colR = [5, 4, 3, 2, 1, 0].map(k => { const c = k ? (near(xr - k * g, g * 0.15) || nearAny(xr - k * g, g * 0.15)) : nearAny(xr, g * 0.15); return c ? c.x : xr - k * g; });
      }
    }
    if (colR.length < 6 && noCo.length >= 6) {
      const nc = noCo.map(w => w.x + w.w / 2).sort((a, b) => a - b).slice(-6), gap = (nc[5] - nc[0]) / 5;
      colR = nc.map(c => c + gap * 0.42);
      warn.push('Cột tiền suy theo vị trí chữ Nợ/Có ở tiêu đề.');
    }
    if (colR.length < 6) warn.push('Chỉ nhận được ' + colR.length + '/6 cột tiền — cần kiểm tra bố cục.');
    const gap = colR.length > 1 ? (colR[colR.length - 1] - colR[0]) / (colR.length - 1) : 300;
    const colW = gap * 0.92;
    const moneyLeft = colR.length ? colR[0] - colW : (opts.pageW || 2000) * 0.5;

    // Dòng neo: chữ bên trái vùng tiền, dưới tiêu đề
    const left = lines.filter((L, i) => i > hdrEnd).map(L => ({ ...L, lw: L.words.filter(w => w.x + w.w * 0.5 < moneyLeft) }))
      .map(L => ({ ...L, ltext: L.lw.map(w => w.str).join(' ') })).filter(L => /[\p{L}\d]/u.test(L.ltext));
    const sttMode = left.filter(L => STT_RE.test(strip(L.lw[0] && L.lw[0].str))).length >= Math.max(3, left.length * 0.4);
    const rows = []; let total = null, stop = false;
    left.forEach(L => {
      if (stop) return;
      const letters = (L.ltext.match(/\p{L}/gu) || []).length;
      if (isTotalText(L.ltext)) { total = { y0: L.y0, y1: L.y1, ten: 'TỔNG CỘNG', isTotal: true, lines: [L] }; stop = true; return; }
      const startsStt = STT_RE.test(strip(L.lw[0].str));
      const prev = rows[rows.length - 1];
      const cont = prev && (sttMode ? !startsStt : (/^[a-zà-ỹ(]/.test(strip(L.lw[0].str)) && letters >= 2)) && L.y0 - prev.y1 < mh * 1.6;
      if (cont) { prev.lines.push(L); prev.y1 = Math.max(prev.y1, L.y1); return; }
      if (letters < 3 && !startsStt) return; // rác (dấu, vệt)
      rows.push({ y0: L.y0, y1: L.y1, lines: [L] });
    });
    // Ký/đóng dấu dưới bảng: dòng neo cách dòng trước quá xa → dừng
    const rgap = med(rows.slice(1).map((r, i) => r.y0 - rows[i].y0)) || mh * 2;
    for (let i = 1; i < rows.length; i++) if (rows[i].y0 - rows[i - 1].y1 > rgap * 3) { rows.length = i; break; }
    // Dải dòng theo TÂM dòng (giữa dòng chữ đầu và cuối của dòng neo) — bền hơn mép trên/dưới khi có vệt nhiễu
    const cyOf = r => (Math.min(...r.lines.map(L => L.cy)) + Math.max(...r.lines.map(L => L.cy))) / 2;
    rows.forEach(r => { r.cy = cyOf(r); });
    if (total) total.cy = cyOf(total);
    const halfGap = (rgap || mh * 2) / 2;
    rows.forEach((r, i) => {
      Object.assign(r, splitLeft(r.lines.flatMap(L => L.lw.map(w => w.str))));
      const up = i ? (rows[i - 1].cy + r.cy) / 2 : r.cy - Math.max(halfGap, (r.cy - r.y0) + mh * 0.3);
      const dn = i + 1 < rows.length ? (r.cy + rows[i + 1].cy) / 2 : (total ? (r.cy + total.cy) / 2 : r.cy + Math.max(halfGap, (r.y1 - r.cy) + mh * 0.3));
      r.bandTop = Math.round(up); r.bandBot = Math.round(dn);
      delete r.lines;
    });
    if (total) { const last = rows[rows.length - 1]; total.bandTop = Math.round(last ? (last.cy + total.cy) / 2 : total.cy - halfGap); total.bandBot = Math.round(total.cy + halfGap * 1.2); delete total.lines; }
    return { header, colR, colW, moneyLeft, rows, total, warn, mh, sttMode, hdrY: yHdr };
  }

  /** Độ lệch dọc từng cột tiền so với dòng neo bên trái (trang scan cong/nghiêng dư): trung vị (tâm số − tâm dòng gần nhất).
   *  Ghi vào L.dy[6]; cột thiếu mẫu → nội suy tuyến tính theo x. */
  function columnOffsets(L, words) {
    const rc = L.rows.map(r => (r.y0 + r.y1) / 2);
    const rg = L.rows.length > 1 ? med(L.rows.slice(1).map((r, i) => r.y0 - L.rows[i].y0)) : L.mh * 2;
    const per = L.colR.map(() => []);
    words.forEach(w => { if (!numericish(w.str) || strip(w.str).replace(/\D/g, '').length < 4) return;
      const re = w.x + w.w; let ci = -1, bd = 1e9; L.colR.forEach((x, i) => { const d = Math.abs(x - re); if (d < bd) { bd = d; ci = i; } });
      if (ci < 0 || bd > L.colW * 0.4) return;
      const cy = w.y + w.h / 2; let best = 1e9; rc.forEach(y => { if (Math.abs(cy - y) < Math.abs(best)) best = cy - y; });
      if (Math.abs(best) < rg * 0.6) per[ci].push(best); });
    let dy = per.map(a => (a.length >= 2 ? med(a) : null));
    const known = dy.map((v, i) => (v === null ? null : [L.colR[i], v])).filter(Boolean);
    if (known.length >= 2) { const n = known.length, mx = known.reduce((s, p) => s + p[0], 0) / n, my = known.reduce((s, p) => s + p[1], 0) / n;
      const b = known.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / (known.reduce((s, p) => s + (p[0] - mx) ** 2, 0) || 1);
      dy = dy.map((v, i) => (v === null ? Math.round(my + b * (L.colR[i] - mx)) : Math.round(v))); }
    else dy = dy.map(v => (v === null ? (known.length ? Math.round(known[0][1]) : 0) : Math.round(v)));
    // lệch nhỏ (< 15% khoảng dòng) coi như 0 để không cắt hụt ô
    L.dy = dy.map(v => (Math.abs(v) < rg * 0.15 ? 0 : v));
    return L.dy;
  }

  /** Bản đọc từ words cả trang: gán token số vào (dòng, cột) theo dải dòng (đã bù lệch cột) + mép phải */
  function cellsFromWords(L, words) {
    const dy = L.dy || L.colR.map(() => 0);
    const pick = r => {
      const cells = Array(6).fill('');
      words.forEach(w => { if (!numericish(w.str) || w.x + w.w < L.moneyLeft) return;
        const re = w.x + w.w; let bi = -1, bd = 1e9; L.colR.forEach((x, i) => { const d = Math.abs(x - re); if (d < bd) { bd = d; bi = i; } });
        if (bi < 0 || bd > L.colW * 0.5) return;
        const cy = w.y + w.h / 2 - dy[bi]; if (cy < r.bandTop || cy > r.bandBot) return;
        cells[bi] += strip(w.str); });
      return cells;
    };
    return { rows: L.rows.map(pick), total: L.total ? pick(L.total) : null };
  }

  /** Chốt 1 dòng từ các bản đọc ô: cands[k][col] = chuỗi. Chọn bản/tổ hợp làm dòng cân đối. */
  function resolveRow(cands) {
    const P = cands.map(c => c.map(s => (s ? parseNum(s) : { v: 0, ok: true, blank: true })));
    const val = (k, i) => P[k][i].v;
    const balanced = pick => pick.every((k, i) => val(k, i) !== null) && pick.reduce((s, k, i) => s + SIGN[i] * val(k, i), 0) === 0;
    const n = cands.length;
    // ưu tiên: bản đầu (đọc từng ô) → các bản khác → tổ hợp theo ô
    for (let k = 0; k < n; k++) { const pick = Array(6).fill(k); if (balanced(pick)) return build(pick, 'ok'); }
    if (n > 1 && n <= 4) {
      const total = Math.pow(n, 6);
      for (let m = 0; m < total; m++) { const pick = []; let x = m; for (let i = 0; i < 6; i++) { pick.push(x % n); x = Math.floor(x / n); } if (balanced(pick)) return build(pick, 'ok', true); }
    }
    // không cân: lấy theo ô bản "tốt" nhất (ok > blank > bad), ưu tiên bản 0
    const pick = Array(6).fill(0).map((_, i) => { for (let k = 0; k < n; k++) if (P[k][i].ok && !P[k][i].blank) return k; for (let k = 0; k < n; k++) if (P[k][i].ok) return k; return 0; });
    return build(pick, pick.some((k, i) => val(k, i) === null) ? 'thieu' : 'lech');
    function build(pick, bal, mixed) {
      const cells = pick.map((k, i) => cands[k][i] || ''), vals = pick.map((k, i) => val(k, i));
      // cả 6 ô trống ở MỌI bản đọc → "cân đối" chỉ là giả (thường do dải dòng lệch) → đánh dấu cần xem
      if (bal === 'ok' && P.every(p => p.every(x => x.blank))) bal = 'trong';
      const status = pick.map((k, i) => { const p = P[k][i]; if (bal === 'ok') return p.blank ? 'blank' : 'ok'; return p.v === null ? 'bad' : p.blank ? 'blank' : p.ok ? 'ok' : 'bad'; });
      const diff = vals.some(v => v === null) ? null : vals.reduce((s, v, i) => s + SIGN[i] * v, 0);
      // các bản đọc bất đồng ở ô nào → đánh dấu cần xem khi dòng chưa cân
      const disagree = Array(6).fill(0).map((_, i) => new Set(P.map(p => p[i].v)).size > 1);
      return { cells, vals, status, bal, diff, mixed: !!mixed, disagree, src: pick };
    }
  }
  /** Ô đáng ngờ duy nhất → giá trị làm dòng cân đối (gợi ý, người xác nhận) */
  function suggestFix(r) {
    if (r.bal === 'ok' || r.diff === null) return null;
    let sus = r.status.map((s, i) => (s !== 'ok' ? i : -1)).filter(i => i >= 0);
    if (sus.length !== 1) sus = r.disagree ? r.disagree.map((d, i) => (d ? i : -1)).filter(i => i >= 0) : [];
    if (sus.length !== 1) return null;
    const i = sus[0], others = r.vals.reduce((s, v, j) => (j === i ? s : s + SIGN[j] * (v || 0)), 0), x = -others * SIGN[i];
    return x >= 0 ? { col: i, value: x } : null;
  }
  /** Dòng tổng: mỗi cột chọn bản đọc bằng đúng tổng các dòng (nếu có) — tổng khớp = xác nhận cả cột */
  function resolveTotal(cands, rows) {
    const sums = COLS.map((_, i) => rows.reduce((s, r) => s + (r.vals[i] || 0), 0));
    const cells = [], vals = [], status = [], match = [];
    COLS.forEach((_, i) => {
      const P = cands.map(c => (c && c[i] ? parseNum(c[i]) : { v: null, ok: false }));
      let k = P.findIndex(p => p.v === sums[i]);
      if (k < 0 && sums[i] === 0) k = P.findIndex(p => p.v === 0 || p.v === null);
      if (k >= 0) { cells.push(cands[k][i] || '0'); vals.push(sums[i]); status.push('ok'); match.push(true); return; }
      k = P.findIndex(p => p.ok && p.v !== null); if (k < 0) k = 0;
      cells.push((cands[k] && cands[k][i]) || ''); vals.push(P[k].v); status.push(P[k].v === null ? 'bad' : 'lech'); match.push(false);
    });
    return { cells, vals, status, match, sums };
  }
  function checkTotals(rows, total) {
    if (!total) return null;
    return COLS.map((c, i) => { const sum = rows.reduce((s, r) => s + (r.vals[i] || 0), 0); const t = total.vals[i]; return { col: c, sum, total: t, ok: t !== null && sum === t }; });
  }

  const API = { COLS, COL_LABEL, SIGN, parseNum, numericish, parseHeader, toLines, layout, splitLeft, columnOffsets, cellsFromWords, resolveRow, resolveTotal, suggestFix, checkTotals, isTotalText, noAccent, fixDigits };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.P131 = API;
})(typeof window !== 'undefined' ? window : globalThis);
