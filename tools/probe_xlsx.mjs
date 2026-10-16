// Đo bộ đọc Excel MỚI (core/xlsx131.js) trên tệp thật NGOÀI repo — chỉ in số đếm/cờ, không in tên KH.
// Chạy: node tools/probe_xlsx.mjs "<tệp.xlsx>" ...
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const XLSX = require('../vendor/xlsx.full.min.js');
const X131 = require('../core/xlsx131.js');
for (const f of process.argv.slice(2)) {
  const name = f.split(/[\\/]/).pop();
  const wb = XLSX.read(fs.readFileSync(f), { type: 'buffer', cellDates: true });
  let found = false;
  for (const sn of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true });
    const res = X131.parse(aoa, { fileName: name });
    if (!res) continue;
    found = true;
    res.forEach(g => {
      const rs = g.rows, ok = rs.filter(r => r.bal === 'ok').length;
      const sums = [0, 1, 2, 3, 4, 5].map(j => rs.reduce((s, r) => s + (r.vals[j] || 0), 0));
      const totOk = g.total ? g.total.vals.map((v, j) => v === sums[j]) : null;
      console.log(`${name} [${sn}] TK ${g.header.tk} · kỳ ${g.header.ky} (${g.header.kyGoc}) · cột ${JSON.stringify(g.cols)} · dòng ${rs.length} · cân ${ok}/${rs.length} · tổng ${g.total ? totOk.filter(Boolean).length + '/6 khớp' + (g.total.fromSubs ? ' (từ Cộng TK)' : '') : 'không có'} · MST từ mã ${rs.filter(r => r.mstGoc).length} · CCCD ${rs.filter(r => r.caNhanGoc).length} · TK con ${[...new Set(rs.map(r => r.tkCT))].join('/')}`);
      g.warn.forEach(w => console.log('   ⚠', w));
      rs.filter(r => r.bal !== 'ok').slice(0, 5).forEach(r => console.log('   lệch dòng Excel', r.xlsRow, 'diff', r.diff));
    });
  }
  if (!found) console.log(name, '→ KHÔNG nhận ra bảng');
}
