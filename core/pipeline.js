/* Luồng đọc 1 tệp 131/331 (trình duyệt, offline). Cần: ocr_core.js (pdf.js + tesseract nhúng sẵn), deskew.js, parse131.js.
 * Trang → chọn hướng (OCR thử 4 góc trên ảnh nhỏ) → chỉnh nghiêng → xoá kẻ → OCR cả trang (bố cục, tên)
 *       → OCR từng ô số (chỉ chữ số, 1 dòng) → chọn bản đọc làm dòng cân đối. */
const PIPE = { digit: null, nDigit: 0 };

async function digitScheduler(n, onStatus) {
  if (PIPE.digit && PIPE.nDigit >= n) return PIPE.digit;
  await initTesseract(1, onStatus); // tạo OCR.twURL
  if (!PIPE.digit) PIPE.digit = Tesseract.createScheduler();
  while (PIPE.nDigit < n) {
    onStatus && onStatus('Đang khởi động bộ đọc số ' + (PIPE.nDigit + 1) + '/' + n + '…');
    const w = await Tesseract.createWorker('vie', 1, { workerPath: OCR.twURL, workerBlobURL: false, corePath: 'offline-core.js',
      langPath: 'https://offline.invalid/lang', cacheMethod: 'none', gzip: true });
    await w.setParameters({ tessedit_char_whitelist: '0123456789.,-()', tessedit_pageseg_mode: '7', classify_bln_numeric_mode: '1' });
    PIPE.digit.addWorker(w); PIPE.nDigit++;
  }
  return PIPE.digit;
}

const wordsOf = res => { const out = []; (res.data.blocks || []).forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => l.words.forEach(w => {
  if (w.text.trim()) out.push({ x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0, str: w.text, conf: Math.round(w.confidence) }); })))); return out; };

/** Chọn hướng trang: OCR ảnh thu nhỏ ở các góc, điểm = số từ tin cậy ≥70 có ≥2 ký tự chữ/số */
async function pickRotation(c, sched, hint) {
  const score = async rot => {
    const k = Math.min(1, 1700 / Math.max(c.width, c.height)), s = document.createElement('canvas'); s.width = Math.round(c.width * k); s.height = Math.round(c.height * k);
    const x = s.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, s.width, s.height); x.drawImage(c, 0, 0, s.width, s.height);
    const r = rotateCanvas(s, rot); const res = await sched.addJob('recognize', r, {}, { blocks: true }); r.width = r.height = 0;
    // chỉ đếm từ có ≥3 chữ cái (số/vệt kẻ đọc ngang hay dọc đều ra "từ" → làm nhiễu điểm)
    // + khung từ phải NẰM NGANG: Tesseract vẫn đọc được chữ chạy dọc (khung cao hơn rộng) → không phân biệt được 90°/180° nếu thiếu điều kiện này
    return wordsOf(res).filter(w => w.conf >= 75 && (w.str.match(/\p{L}/gu) || []).length >= 3 && w.w > w.h * 1.5).length;
  };
  const sc = {};
  if (hint !== null && hint !== undefined) { sc[hint] = await score(hint); if (sc[hint] >= 15) return { rot: hint, scores: sc }; }
  for (const r of [0, 90, 270, 180]) if (sc[r] === undefined) sc[r] = await score(r);
  // điểm sát nhau → ưu tiên giữ nguyên (đa số bản scan đặt thẳng); đo mẫu khổ ngang: 0°=183 · 90°=179
  const top = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
  return { rot: sc[0] >= top[1] * 0.9 ? 0 : +top[0], scores: sc };
}

/** Ngưỡng Otsu trên vùng ảnh xám */
function otsu(d) {
  const h = new Array(256).fill(0); let n = 0;
  for (let i = 0; i < d.length; i += 4) { h[Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114)]++; n++; }
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i];
  let sB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) { wB += h[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += t * h[t];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; thr = t; } }
  return thr;
}
/** Cắt ô (x0,y0,x1,y1) từ ảnh xám → phóng k× + nhị phân (Otsu + dthr); trả null nếu gần như không có mực (ô trống) */
function cropCell(gray, x0, y0, x1, y1, k, dthr) {
  k = k || 1.6; dthr = dthr || 0;
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(gray.width, Math.ceil(x1)); y1 = Math.min(gray.height, Math.ceil(y1));
  const w = x1 - x0, h = y1 - y0; if (w < 8 || h < 8) return null;
  const src = gray.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, w, h), d = src.data;
  let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 < 120) ink++;
  if (ink < Math.max(12, w * h * 0.003)) return null;
  const thr = Math.min(200, Math.max(110, otsu(d) + dthr));
  const c = document.createElement('canvas'); c.width = Math.round(w * k) + 24; c.height = Math.round(h * k) + 24;
  const t = document.createElement('canvas'); t.width = w; t.height = h; const tx = t.getContext('2d'); tx.putImageData(src, 0, 0);
  const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(t, 12, 12, w * k, h * k);
  t.width = t.height = 0;
  const im = x.getImageData(0, 0, c.width, c.height), q = im.data;
  for (let i = 0; i < q.length; i += 4) { const v = (q[i] * 0.299 + q[i + 1] * 0.587 + q[i + 2] * 0.114) < thr ? 0 : 255; q[i] = q[i + 1] = q[i + 2] = v; }
  x.putImageData(im, 0, 0);
  return c;
}

/** OCR từng ô số theo bố cục L (dải dòng bù lệch cột L.dy) → [{rows:[[6 chuỗi]], total:[6]|null}] — 1 phần tử/biến thể ảnh */
const CELL_VARIANTS = [{ k: 1.6, dthr: 0 }, { k: 2.4, dthr: 18 }, { k: 2.0, dthr: -14 }];

/** OCR ô tên theo dải dòng (tên đọc cả trang hay lẫn vệt kẻ/ghép nhầm dòng) → chuỗi tên/dòng */
async function ocrNames(gray, L, words, sched) {
  const sttX = L.sttMode ? (() => { const xs = []; L.rows.forEach(r => { const w = words.find(w => /^[^\p{L}\d]{0,2}\d{1,3}[^\p{L}\d]*$/u.test(w.str.trim()) && w.x < L.moneyLeft * 0.25 && w.y + w.h / 2 > r.bandTop && w.y + w.h / 2 < r.bandBot); if (w) xs.push(w.x + w.w); }); xs.sort((a, b) => a - b); return xs.length ? xs[xs.length >> 1] : null; })() : null;
  const leftW = words.filter(w => w.x + w.w < L.moneyLeft && w.y > L.hdrY);
  const x0 = sttX !== null ? sttX + L.mh * 0.4 : Math.max(0, Math.min(...leftW.map(w => w.x)) - L.mh * 0.5);
  const out = [];
  await Promise.all(L.rows.map((r, i) => {
    const x1 = L.moneyLeft, y0 = Math.max(0, r.bandTop), y1 = Math.min(gray.height, r.bandBot);
    if (x1 - x0 < 20 || y1 - y0 < 8) return Promise.resolve();
    const c = document.createElement('canvas'); c.width = Math.round(x1 - x0) + 20; c.height = Math.round(y1 - y0) + 20;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(gray, x0, y0, x1 - x0, y1 - y0, 10, 10, x1 - x0, y1 - y0);
    binarize(c, 165);
    return sched.addJob('recognize', c, {}, { text: true }).then(res => { out[i] = (res.data.text || '').replace(/\s+/g, ' ').trim(); c.width = c.height = 0; });
  }));
  return out;
}
/** opts: {variants:[chỉ số CELL_VARIANTS], rows:[chỉ số dòng] (mặc định tất cả), total:true|false} — bản đọc của biến thể không chạy để chuỗi rỗng */
async function ocrCells(gray, L, dsched, opts) {
  opts = opts || {};
  const pad = L.colW * 0.06, dy = L.dy || L.colR.map(() => 0);
  const vis = opts.variants || CELL_VARIANTS.map((_, i) => i), rowIdx = opts.rows || L.rows.map((_, i) => i);
  const jobs = [];
  const reads = CELL_VARIANTS.map(() => ({ rows: L.rows.map(() => Array(6).fill('')), total: L.total ? Array(6).fill('') : null }));
  const one = (r, pick) => L.colR.forEach((xr, ci) => vis.forEach(vi => { const v = CELL_VARIANTS[vi];
    const c = cropCell(gray, xr - L.colW, r.bandTop + 1 + dy[ci], xr + pad, r.bandBot - 1 + dy[ci], v.k, v.dthr);
    if (!c) return;
    jobs.push(dsched.addJob('recognize', c, {}, { text: true }).then(res => { pick(reads[vi])[ci] = (res.data.text || '').replace(/\s+/g, ''); c.width = c.height = 0; }));
  }));
  rowIdx.forEach(i => one(L.rows[i], rd => rd.rows[i]));
  if (L.total && opts.total !== false) one(L.total, rd => rd.total);
  await Promise.all(jobs);
  reads.jobs = jobs.length;
  return reads;
}

/**
 * Đọc 1 trang PDF (hoặc canvas ảnh) → kết quả trang.
 * opts: {scale=3, sched (tesseract vie), dsched (chữ số), hint (góc trang trước), onStatus}
 */
async function readPage(src, opts) {
  const scale = opts.scale || 3;
  let c;
  if (src.pdf) {
    const pg = await src.pdf.getPage(src.no), vp = pg.getViewport({ scale });
    c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise; pg.cleanup();
  } else c = src.canvas;
  opts.onStatus && opts.onStatus('nhận hướng trang…');
  const { rot, scores } = await pickRotation(c, opts.sched, opts.hint);
  let img = rotateCanvas(c, rot);
  const skew = estimateSkew(img);
  img = rotateSmall(img, -skew);
  const gray = cleanLines(img);                    // xoá kẻ đậm, giữ ảnh xám cho bước đọc ô
  const bin = document.createElement('canvas'); bin.width = gray.width; bin.height = gray.height;
  bin.getContext('2d').drawImage(gray, 0, 0); binarize(bin, 165); // bỏ kẻ/nền xám nhạt cho bước đọc bố cục (190 còn sót kẻ xám của bảng kiểm toán)
  opts.onStatus && opts.onStatus('đọc bố cục bảng…');
  const res = await opts.sched.addJob('recognize', bin, {}, { blocks: true, text: true });
  const words = wordsOf(res);
  const L = P131.layout(words, { pageW: bin.width });
  bin.width = bin.height = 0;
  opts.onStatus && opts.onStatus('đọc từng ô số (' + L.rows.length + ' dòng)…');
  P131.columnOffsets(L, words);
  const fw = P131.cellsFromWords(L, words);
  let cr = [];
  if (L.colR.length === 6) {
    // 2 biến thể đầu cho mọi ô; biến thể 3 chỉ cho dòng chưa cân đối (tiết kiệm ~1/3 thời gian)
    cr = await ocrCells(gray, L, opts.dsched, { variants: [0, 1] });
    const bad = L.rows.map((_, i) => i).filter(i => P131.resolveRow([cr[0].rows[i], cr[1].rows[i], fw.rows[i]]).bal !== 'ok');
    let jobs = cr.jobs;
    if (bad.length) {
      opts.onStatus && opts.onStatus('đọc lại ' + bad.length + ' dòng chưa cân đối…');
      const c3 = await ocrCells(gray, L, opts.dsched, { variants: [2], rows: bad, total: true });
      cr[2] = c3[2]; jobs += c3.jobs;
    }
    cr.jobs = jobs;
  }
  opts.onStatus && opts.onStatus('đọc tên đối tác…');
  const names = await ocrNames(gray, L, words, opts.sched);
  const rows = L.rows.map((r, i) => {
    const row = Object.assign({}, r, P131.resolveRow([...cr.map(c => c.rows[i]), fw.rows[i]]));
    row.tenOcrTrang = r.ten;
    if (names[i]) { const s = P131.splitLeft(names[i].split(' ')); if ((s.ten || '').replace(/[^\p{L}]/gu, '').length >= 4) { row.ten = s.ten; row.ma = row.ma || s.ma; row.tk = row.tk || s.tk; } }
    return row;
  });
  const total = L.total ? Object.assign({}, L.total, P131.resolveTotal([...cr.map(c => c.total), fw.total], rows)) : null;
  // ảnh thu nhỏ để người duyệt xem dòng gốc
  const k = Math.min(1, 1400 / gray.width), th = document.createElement('canvas'); th.width = Math.round(gray.width * k); th.height = Math.round(gray.height * k);
  th.getContext('2d').drawImage(gray, 0, 0, th.width, th.height);
  const thumb = th.toDataURL('image/jpeg', 0.8); th.width = th.height = 0;
  const out = { no: src.no || 1, rot, scores, skew, conf: Math.round(res.data.confidence || 0), header: L.header, colR: L.colR, colW: L.colW, moneyLeft: L.moneyLeft,
    rows, total, warn: L.warn, dy: L.dy, thumb, thumbK: k, W: gray.width, H: gray.height, words, cellReads: cr, nCellJobs: cr.jobs || 0 };
  gray.width = gray.height = 0;
  return out;
}
