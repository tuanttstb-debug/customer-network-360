// Đồng bộ lõi dùng chung trình duyệt ↔ GAS: core/mapping.js → gas/Mapping.gs (1 nguồn khóa tên chuẩn hóa).
// Chạy: node tools/sync_gas.mjs   (test/gas.test.mjs và trước mỗi clasp push)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(ROOT, 'core', 'mapping.js'), 'utf8');
const out = '// ⚠ FILE SINH TỰ ĐỘNG từ core/mapping.js (node tools/sync_gas.mjs) — KHÔNG sửa tay.\n' + src;
const dst = path.join(ROOT, 'gas', 'Mapping.gs');
if (!fs.existsSync(dst) || fs.readFileSync(dst, 'utf8') !== out) { fs.writeFileSync(dst, out); console.log('→ gas/Mapping.gs cập nhật'); }
