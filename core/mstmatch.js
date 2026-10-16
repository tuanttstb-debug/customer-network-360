/* mstmatch.js — tra MST theo TÊN pháp nhân trong chỉ mục nội bộ (file nội bộ TPBank ~870k pháp nhân).
 * Dùng chung: Web Worker trình duyệt (assets/js/mstidx.worker.js) · test Node (test/mstmatch.test.mjs) · đo ngưỡng (tools/eval_mst_match.mjs).
 * KHÔNG chứa dữ liệu — chỉ logic. Chỉ mục nạp từ TSV "MST<TAB>Tên" (build bằng tools/build_mst_index.py, file nằm NGOÀI repo).
 *
 * Cách khớp: chuẩn hóa (bỏ dấu, HOA, mở viết tắt CTY/CP/TM/DV/XD…) → tách LOẠI HÌNH (TNHH/CP/DNTN/CN…) khỏi TÊN LÕI
 * → chỉ mục ngược token tên lõi (trọng số IDF) → ứng viên → điểm = 0,55·Jaccard có trọng số + 0,45·Dice 2-ký-tự (chịu lỗi OCR)
 * ± loại hình (khác loại hình trừ điểm; chi nhánh xếp sau khi tên gốc không ghi "chi nhánh"). Token lạ (lỗi OCR) → token gần nhất (sai 1 ký tự). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M; else root.MSTM = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Ngưỡng tự điền — đo bằng tools/eval_mst_match.mjs (xem AI_CONTEXT/PHUONG_AN_TRA_MST_NOI_BO.md §6)
  const AUTO = { score: 0.86, gap: 0.10 };

  const ABBR = {
    CTY: 'CONG TY', CTCP: 'CONG TY CO PHAN', CTTNHH: 'CONG TY TNHH', CP: 'CO PHAN', TNHHMTV: 'TNHH MOT THANH VIEN', MTV: 'MOT THANH VIEN',
    TM: 'THUONG MAI', DV: 'DICH VU', TMDV: 'THUONG MAI DICH VU', DVTM: 'DICH VU THUONG MAI', XD: 'XAY DUNG', SX: 'SAN XUAT', XNK: 'XUAT NHAP KHAU',
    DNTN: 'DOANH NGHIEP TU NHAN', HTX: 'HOP TAC XA', KD: 'KINH DOANH', VN: 'VIET NAM', TPHCM: 'THANH PHO HO CHI MINH', HCM: 'HO CHI MINH',
    TCT: 'TONG CONG TY', VPDD: 'VAN PHONG DAI DIEN', LTD: 'TNHH', JSC: 'CO PHAN', COMPANY: 'CONG TY',
    // viết tắt kiểu tên hệ thống TPB ("CTY CPDT VA PTNL …") — 16/10
    CPDT: 'CO PHAN DAU TU', DT: 'DAU TU', PT: 'PHAT TRIEN', NL: 'NANG LUONG', PTNL: 'PHAT TRIEN NANG LUONG', DTPT: 'DAU TU PHAT TRIEN', DTXD: 'DAU TU XAY DUNG',
    XL: 'XAY LAP', KT: 'KY THUAT', TV: 'TU VAN', CK: 'CO KHI', TB: 'THIET BI', VLXD: 'VAT LIEU XAY DUNG', BDS: 'BAT DONG SAN', QT: 'QUOC TE',
  };
  // Cụm loại hình — dài trước ngắn sau; bit dùng so loại hình hai bên
  const F = { TNHH: 1, CP: 2, DNTN: 4, HTX: 8, CN: 16, VPDD: 32, TCT: 64, CTY: 128 };
  const MAIN = F.TNHH | F.CP | F.DNTN | F.HTX;
  const FORMS = [
    ['TONG CONG TY', F.TCT], ['CONG TY TNHH MOT THANH VIEN', F.TNHH], ['TNHH MOT THANH VIEN', F.TNHH], ['CONG TY TNHH', F.TNHH], ['TNHH', F.TNHH],
    ['CONG TY CO PHAN', F.CP], ['CO PHAN', F.CP], ['DOANH NGHIEP TU NHAN', F.DNTN], ['HOP TAC XA', F.HTX],
    ['CHI NHANH', F.CN], ['VAN PHONG DAI DIEN', F.VPDD], ['CONG TY', F.CTY],
  ].map(([p, b]) => [new RegExp('(^| )' + p + '(?= |$)', 'g'), b]);

  function boDau(s) {
    return String(s || '').replace(/[Đđ]/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  /** Chuẩn hóa: bỏ dấu, HOA, ký tự lạ → khoảng trắng, mở viết tắt. */
  function norm(s) {
    let t = boDau(s).toUpperCase().replace(/&/g, ' VA ').replace(/[^A-Z0-9]+/g, ' ').trim();
    if (!t) return '';
    const ws = t.split(' ');
    return ws.map((w, i) => (w === 'CN' && i === 0 ? 'CHI NHANH' : w === 'CT' && /^(CP|CPDT|TNHH|MTV)$/.test(ws[i + 1] || '') ? 'CONG TY' : ABBR[w] || w)).join(' ');
  }
  /** Tên → { core: 'TEN LOI', toks: [...], forms: bitmask } */
  function analyze(s) {
    let t = norm(s), forms = 0;
    for (const [re, b] of FORMS) {
      if (re.test(t)) { forms |= b; t = t.replace(re, ' '); }
      re.lastIndex = 0;
    }
    const toks = t.split(' ').filter(Boolean);
    return { core: toks.join(' '), toks, forms };
  }
  const isBranchMst = m => /-\d{3}$/.test(String(m || ''));

  function bigrams(s) {
    const x = s.replace(/ /g, ''), m = new Map();
    for (let i = 0; i < x.length - 1; i++) { const g = x.substr(i, 2); m.set(g, (m.get(g) || 0) + 1); }
    return { m, n: Math.max(0, x.length - 1) };
  }
  function dice(a, b) {
    if (!a.n || !b.n) return a.n === b.n ? 1 : 0;
    let inter = 0;
    a.m.forEach((c, g) => { const d = b.m.get(g); if (d) inter += Math.min(c, d); });
    return (2 * inter) / (a.n + b.n);
  }
  /** a, b khác nhau đúng 1 thao tác (thay/thêm/bớt 1 ký tự)? */
  function ed1(a, b) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1 || a === b) return false;
    let i = 0, j = 0, diff = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diff > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return diff + (la - i) + (lb - j) <= 1;
  }

  /** Dựng chỉ mục từ danh sách [mst, tên]. ~870k dòng ≈ vài giây (chạy trong Worker). */
  function build(entries, onProgress) {
    const N = entries.length, mst = new Array(N), name = new Array(N), forms = new Uint8Array(N);
    const vocab = new Map(), vtok = [], df = [];
    const docOff = new Int32Array(N + 1), docTok = [];
    for (let i = 0; i < N; i++) {
      const [m, nm] = entries[i];
      mst[i] = m; name[i] = nm;
      const a = analyze(nm); forms[i] = a.forms;
      const seen = new Set();
      for (const t of a.toks) {
        let id = vocab.get(t);
        if (id === undefined) { id = vtok.length; vocab.set(t, id); vtok.push(t); df.push(0); }
        if (!seen.has(id)) { seen.add(id); df[id]++; docTok.push(id); }
      }
      docOff[i + 1] = docTok.length;
      if (onProgress && i % 100000 === 0) onProgress(i / N);
    }
    const dt = Int32Array.from(docTok);
    // Chỉ mục ngược dạng CSR: postOff[tok] … postOff[tok+1]
    const V = vtok.length, postOff = new Int32Array(V + 1);
    for (let v = 0; v < V; v++) postOff[v + 1] = postOff[v] + df[v];
    const fill = postOff.slice(0, V), post = new Int32Array(dt.length);
    for (let i = 0; i < N; i++) for (let k = docOff[i]; k < docOff[i + 1]; k++) post[fill[dt[k]]++] = i;
    const idf = new Float64Array(V);
    for (let v = 0; v < V; v++) idf[v] = Math.log(1 + N / df[v]);
    // Từ vựng theo độ dài → tìm token gần (lỗi OCR 1 ký tự) nhanh
    const byLen = new Map();
    vtok.forEach((t, v) => { if (t.length >= 4) { if (!byLen.has(t.length)) byLen.set(t.length, []); byLen.get(t.length).push(v); } });
    if (onProgress) onProgress(1);
    return { N, mst, name, forms, vocab, vtok, df: Int32Array.from(df), idf, docOff, docTok: dt, postOff, post, byLen };
  }

  /** TSV "MST\tTên" (dòng đầu có thể là tiêu đề #) → [[mst, tên]] */
  function parseTsv(text) {
    const out = [];
    let i = 0;
    while (i < text.length) {
      let j = text.indexOf('\n', i); if (j < 0) j = text.length;
      const line = text.slice(i, j); i = j + 1;
      if (!line || line[0] === '#') continue;
      const k = line.indexOf('\t'); if (k < 0) continue;
      out.push([line.slice(0, k), line.slice(k + 1).replace(/\r$/, '')]);
    }
    return out;
  }

  const RETRIEVE_DF = 30000, RETRIEVE_GROUPS = 3, MAX_CAND = 300, DICE_TOP = 60;
  function nearTok(I, t) {
    const res = [];
    for (const L of [t.length - 1, t.length, t.length + 1]) {
      const arr = I.byLen.get(L); if (!arr) continue;
      for (const v of arr) if (ed1(t, I.vtok[v])) res.push(v);
    }
    return res.sort((a, b) => I.df[b] - I.df[a]).slice(0, 3);
  }

  /** Tên → tối đa `k` ứng viên {mst, name, score, branch} + auto (đủ chắc để tự điền).
   *  opts.contain (ô tìm KH): người gõ một phần tên → tên chứa ĐỦ mọi token lõi được cộng điểm (không áp cho tự điền MST đối tác). */
  function search(I, q, k, opts) {
    k = k || 5; opts = opts || {};
    const a = analyze(q);
    if (!a.toks.length) return { cands: [], auto: false };
    // token truy vấn → [{id, w}] (token lạ → token gần, trọng số 0,8)
    const qt = [];
    const seenQ = new Set();
    for (const t of a.toks) {
      if (seenQ.has(t)) continue; seenQ.add(t);
      const id = I.vocab.get(t);
      if (id !== undefined) qt.push({ ids: [id], w: I.idf[id], f: 1 });
      else if (t.length >= 4) { const n = nearTok(I, t); if (n.length) qt.push({ ids: n, w: Math.max(...n.map(v => I.idf[v])), f: 0.8 }); else qt.push({ ids: [], w: Math.log(1 + I.N), f: 0 }); }
      else qt.push({ ids: [], w: Math.log(1 + I.N), f: 0 });
    }
    // Ứng viên: cộng điểm theo token hiếm; toàn token phổ biến → giao các danh sách
    const acc = new Map();
    let used = 0;
    // Lấy ứng viên từ 2 nhóm token hiếm nhất (df ≤ RETRIEVE_DF) — đủ tìm cả khi 1 token bị lỗi OCR, không quét token phổ biến
    const minDf = x => Math.min(...x.ids.map(v => I.df[v]));
    const rare = qt.filter(x => x.ids.length && minDf(x) <= RETRIEVE_DF).sort((u, v) => minDf(u) - minDf(v)).slice(0, RETRIEVE_GROUPS);
    for (const x of rare) for (const v of x.ids) {
      if (I.df[v] > RETRIEVE_DF) continue;
      used++;
      for (let p = I.postOff[v]; p < I.postOff[v + 1]; p++) { const d = I.post[p]; acc.set(d, (acc.get(d) || 0) + x.w * x.f); }
    }
    if (!used) {
      const ids = qt.filter(x => x.ids.length).map(x => x.ids[0]).sort((u, v) => I.df[u] - I.df[v]);
      if (!ids.length) return { cands: [], auto: false };
      const first = ids[0];
      for (let p = I.postOff[first]; p < I.postOff[first + 1]; p++) {
        const d = I.post[p];
        let all = true;
        for (let j = 1; j < ids.length && all; j++) { let hit = false; for (let q2 = I.docOff[d]; q2 < I.docOff[d + 1]; q2++) if (I.docTok[q2] === ids[j]) { hit = true; break; } all = hit; }
        if (all) acc.set(d, 1);
      }
    }
    let cand = [...acc.keys()];
    if (cand.length > MAX_CAND) {
      // Chấm sơ bộ bằng MỌI token (kể cả token phổ biến bị bỏ khi lấy ứng viên) rồi mới cắt — tránh cắt ngẫu nhiên khi nhiều ứng viên đồng điểm
      const qIds = new Map(); qt.forEach(x => x.ids.forEach(v => qIds.set(v, x.w * x.f)));
      const pre = cand.map(d => {
        let s = 0, wd = 0;
        for (let p = I.docOff[d]; p < I.docOff[d + 1]; p++) { const v = I.docTok[p], w = qIds.get(v); wd += I.idf[v]; if (w !== undefined) s += w; }
        return [d, s / Math.max(1e-9, wd + 1)];
      });
      cand = pre.sort((x, y) => y[1] - x[1]).slice(0, MAX_CAND).map(x => x[0]);
    }
    const qb = bigrams(a.core), wq = qt.reduce((s, x) => s + x.w, 0);
    // Vòng 1: Jaccard có trọng số cho mọi ứng viên → giữ DICE_TOP · Vòng 2: + Dice 2-ký-tự trên tên lõi (dựng lại từ token, không chuẩn hóa lại tên)
    const wjOf = cand.map(d => {
      let wd = 0, inter = 0;
      const dset = new Set();
      for (let p = I.docOff[d]; p < I.docOff[d + 1]; p++) { const v = I.docTok[p]; dset.add(v); wd += I.idf[v]; }
      let full = true;
      for (const x of qt) { const hit = x.ids.find(v => dset.has(v)); if (hit !== undefined) inter += Math.min(x.w, I.idf[hit]) * x.f; if (hit === undefined || x.f !== 1) full = false; }
      return [d, inter / Math.max(1e-9, wq + wd - inter), opts.contain && full];
    }).sort((x, y) => (y[2] - x[2]) || (y[1] - x[1])).slice(0, DICE_TOP);   // contain: tên chứa đủ token lõi xếp trước khi cắt
    const scored = wjOf.map(([d, wj, full]) => {
      const core = []; for (let p = I.docOff[d]; p < I.docOff[d + 1]; p++) core.push(I.vtok[I.docTok[p]]);
      let s = 0.55 * wj + 0.45 * dice(qb, bigrams(core.join(' ')));
      const fq = a.forms & MAIN, fd = I.forms[d] & MAIN;
      if (fq && fd) s += fq & fd ? 0.02 : -0.08;
      const br = (I.forms[d] & F.CN) || isBranchMst(I.mst[d]);
      if (br && !(a.forms & F.CN)) s -= 0.06;
      if (!br && (a.forms & F.CN)) s -= 0.03;
      if (full) s += 0.25;
      return { mst: I.mst[d], name: I.name[d], score: Math.max(0, Math.min(1, s)), branch: !!br };
    }).sort((x, y) => y.score - x.score || (x.branch - y.branch));
    const top = scored.slice(0, k);
    const auto = !!top.length && top[0].score >= AUTO.score && (top.length < 2 || top[0].score - top[1].score >= AUTO.gap);
    return { cands: top, auto };
  }

  return { AUTO, norm, analyze, boDau, build, parseTsv, search, ed1, isBranchMst };
});
