// Tái hiện tìm KH theo TÊN trên chỉ mục THẬT (ngoài repo) — node tools/probe_kh_name.mjs "<thư mục _build/version>" "<truy vấn>" [cif mong đợi]
// In: (1) dòng K khớp CIF mong đợi · (2) đường hiện tại: tên → chỉ mục 900k (top 15) → MST → có phải KH TPB?
import { createRequire } from 'node:module';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
const require = createRequire(import.meta.url);
const MSTM = require('../core/mstmatch.js');
const [dir, q, cifWant] = process.argv.slice(2);
const gun = f => zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
const cifText = gun('cif_map.tsv.gz');
const K = cifText.split('\n').filter(l => l.startsWith('K\t')).map(l => l.split('\t'));
const mst2cif = new Map(cifText.split('\n').filter(l => /^\d/.test(l)).map(l => { const e = l.split('\t'); return [e[0], e[1]]; }));
console.log('KH line CB:', K.length, 'dòng · MST→CIF:', mst2cif.size);
if (cifWant) { const k = K.find(e => e[1] === cifWant); console.log('Dòng K của CIF', cifWant, '→', k ? JSON.stringify(k.slice(1)) : 'KHÔNG CÓ'); }
let t0 = Date.now();
const I = MSTM.build(MSTM.parseTsv(gun('name_index.tsv.gz')));
console.log('dựng chỉ mục', I.N, 'tên trong', Date.now() - t0, 'ms');
t0 = Date.now();
const r = MSTM.search(I, q, 15, { contain: true });
console.log('đường hiện tại (top 15, ' + (Date.now() - t0) + ' ms):');
r.cands.forEach(c => console.log('  ', c.score.toFixed(2), c.mst, mst2cif.has(c.mst) ? 'KH TPB ' + mst2cif.get(c.mst) : '-', c.name));
