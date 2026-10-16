// Đo tìm KH TPBank theo tên (core/khname.js) trên khối K THẬT (ngoài repo) — node tools/probe_khname.mjs "<_build/version>" "<truy vấn>" ...
// In CIF + điểm + tên hệ thống (dữ liệu nội bộ — chỉ chạy trên máy, không dán ra ngoài).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
const require = createRequire(import.meta.url);
const KHN = require('../core/khname.js');
const [dir, ...qs] = process.argv.slice(2);
const text = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'cif_map.tsv.gz'))).toString('utf8');
let t0 = Date.now();
const K = text.split('\n').filter(l => l.startsWith('K\t')).map(l => l.split('\t'));
const byCif = new Map(K.map(e => [e[1], e]));
const lines = K.map(e => KHN.line(e[1], e[5], e[6]));
console.log(lines.length, 'KH · chuẩn hóa', Date.now() - t0, 'ms · ', (lines.join('\n').length / 1e6).toFixed(1), 'MB');
for (const q of qs) {
  t0 = Date.now();
  const r = KHN.search(lines, q, 8);
  console.log(`\n"${q}" → ${r.length} (${Date.now() - t0} ms)`);
  r.forEach(x => { const e = byCif.get(x.cif); console.log('  ', x.score.toFixed(2), x.cif, e[3], '|', e[5], '|', e[6] || ''); });
}
