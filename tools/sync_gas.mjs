// Đồng bộ lõi dùng chung trình duyệt ↔ GAS (1 nguồn): core/mapping.js → gas/Mapping.gs · core/khname.js → gas/KhName.gs.
// Chạy: node tools/sync_gas.mjs   (test/gas.test.mjs và trước mỗi clasp push)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const [src, dst] of [['mapping.js', 'Mapping.gs'], ['khname.js', 'KhName.gs']]) {
  const out = '// ⚠ FILE SINH TỰ ĐỘNG từ core/' + src + ' (node tools/sync_gas.mjs) — KHÔNG sửa tay.\n' + fs.readFileSync(path.join(ROOT, 'core', src), 'utf8');
  const p = path.join(ROOT, 'gas', dst);
  if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== out) { fs.writeFileSync(p, out); console.log('→ gas/' + dst + ' cập nhật'); }
}
