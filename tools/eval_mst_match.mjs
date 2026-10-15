// Đo độ khớp tra MST nội bộ (core/mstmatch.js) trên chỉ mục THẬT — chỉ in SỐ TỔNG, không in tên/MST.
// Cách đo: lấy ngẫu nhiên N pháp nhân trong chỉ mục → "làm méo" tên như sổ 131/331 (viết tắt, bỏ dấu, lỗi OCR, bỏ loại hình)
// → tra lại → đúng nếu ứng viên 1 = MST gốc. Quét ngưỡng (điểm, khoảng cách) để chọn ngưỡng tự điền (mục tiêu ≥ 99% đúng).
// Chạy: node tools/eval_mst_match.mjs "D:\Công việc\USMN\Nen\_build\<version>\name_index.tsv.gz" [N=3000]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
const M = createRequire(import.meta.url)('../core/mstmatch.js');

const file = process.argv[2], N = +(process.argv[3] || 3000);
if (!file) { console.error('Thiếu đường dẫn name_index.tsv.gz'); process.exit(1); }
let t = Date.now();
const text = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
const E = M.parseTsv(text);
console.log(`Đọc ${E.length} dòng · ${Date.now() - t} ms`); t = Date.now();
const I = M.build(E);
console.log(`Dựng chỉ mục ${Date.now() - t} ms · từ vựng ${I.vtok.length} · heap ${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB`);

let seed = 20261015;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = a => a[Math.floor(rnd() * a.length)];
const ABBR = [[/CÔNG TY/gi, 'Cty'], [/CỔ PHẦN/gi, 'CP'], [/THƯƠNG MẠI/gi, 'TM'], [/DỊCH VỤ/gi, 'DV'], [/XÂY DỰNG/gi, 'XD'], [/SẢN XUẤT/gi, 'SX'], [/MỘT THÀNH VIÊN/gi, 'MTV'], [/TRÁCH NHIỆM HỮU HẠN/gi, 'TNHH']];
const title = s => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
function soKeToan(s) {
  let x = s;
  for (const [re, r] of ABBR) if (rnd() < 0.6) x = x.replace(re, r);
  if (rnd() < 0.5) x = M.boDau(x);
  return rnd() < 0.5 ? title(x) : x;
}
function ocr(s, n) {
  const a = s.split('');
  const idx = a.map((c, i) => (/[A-Za-zÀ-ỹ]/.test(c) ? i : -1)).filter(i => i > s.length * 0.25);
  for (let k = 0; k < n && idx.length; k++) { const i = pick(idx); a[i] = pick('ACEGHIKLMNOQRTUVY'.split('')); }
  return a.join('');
}
const boLoaiHinh = s => s.replace(/^(CÔNG TY|CHI NHÁNH CÔNG TY|DOANH NGHIỆP TƯ NHÂN)\s+(TNHH|CỔ PHẦN|TRÁCH NHIỆM HỮU HẠN)?\s*(MỘT THÀNH VIÊN)?\s*/i, '');
const VARIANTS = {
  'nguyên văn': s => s,
  'sổ kế toán (viết tắt/bỏ dấu)': soKeToan,
  '+ lỗi OCR 1 ký tự': s => ocr(soKeToan(s), 1),
  '+ lỗi OCR 2 ký tự': s => ocr(soKeToan(s), 2),
  'bỏ loại hình': s => boLoaiHinh(s),
};

const sample = []; for (let i = 0; i < N; i++) sample.push(E[Math.floor(rnd() * E.length)]);
const all = [];
for (const [vn, f] of Object.entries(VARIANTS)) {
  let top1 = 0, top5 = 0, auto = 0, autoOk = 0, ms = 0;
  for (const [mst, name] of sample) {
    const q = f(name), t0 = performance.now(), r = M.search(I, q, 5); ms += performance.now() - t0;
    const c = r.cands, ok1 = c[0] && c[0].mst === mst;
    if (ok1) top1++;
    if (c.some(x => x.mst === mst)) top5++;
    if (r.auto) { auto++; if (ok1) autoOk++; }
    all.push({ s1: c[0] ? c[0].score : 0, s2: c[1] ? c[1].score : 0, ok: !!ok1 });
  }
  console.log(`${vn.padEnd(30)} top1 ${(100 * top1 / N).toFixed(1)}% · trong 5 ứng viên ${(100 * top5 / N).toFixed(1)}% · tự điền ${(100 * auto / N).toFixed(1)}% (đúng ${(100 * autoOk / Math.max(1, auto)).toFixed(2)}%) · ${(ms / N).toFixed(1)} ms/tên`);
}
console.log('\nQuét ngưỡng (toàn bộ biến thể): điểm ≥ · cách ứng viên 2 ≥ → % tự điền · % đúng trong số tự điền');
for (const sc of [0.8, 0.83, 0.86, 0.9]) for (const gap of [0.03, 0.06, 0.1]) {
  const a = all.filter(x => x.s1 >= sc && x.s1 - x.s2 >= gap), ok = a.filter(x => x.ok).length;
  console.log(`  ${sc.toFixed(2)} · ${gap.toFixed(2)} → ${(100 * a.length / all.length).toFixed(1)}% · ${(100 * ok / Math.max(1, a.length)).toFixed(2)}%`);
}
