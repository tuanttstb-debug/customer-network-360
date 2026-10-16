// Kiểm thử tra MST/CIF NỘI BỘ — lõi so khớp core/mstmatch.js + backend gas/Mst.gs (giả lập). Dữ liệu GIẢ hoàn toàn.
// Chạy: node test/mst.test.mjs
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { makeEnv } from './gas_harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'sync_gas.mjs')], { stdio: 'inherit' });
const M = createRequire(import.meta.url)('../core/mstmatch.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

/* ================= Lõi so khớp ================= */
console.log('— Chuẩn hóa tên');
ok(M.norm('Cty TNHH TM-DV Giả Lập') === 'CONG TY TNHH THUONG MAI DICH VU GIA LAP', 'viết tắt Cty/TM/DV + bỏ dấu + HOA');
ok(M.norm('CN Cty CP XNK Đông Giả') === 'CHI NHANH CONG TY CO PHAN XUAT NHAP KHAU DONG GIA', 'CN đầu tên = chi nhánh · CP · XNK · Đ→D');
const a1 = M.analyze('CÔNG TY TNHH MỘT THÀNH VIÊN XÂY DỰNG GIẢ LẬP');
ok(a1.core === 'XAY DUNG GIA LAP' && a1.forms === 1, 'tách loại hình TNHH MTV khỏi tên lõi');
ok(M.analyze('Doanh nghiệp tư nhân Giả Bốn').forms === 4 && M.analyze('Chi nhánh Công ty CP Giả').forms === (16 | 2), 'DNTN · chi nhánh + CP');
ok(M.analyze('Cơ khí Giả').core === 'CO KHI GIA', '"CO" đơn lẻ (cơ khí) không bị coi là cổ phần');
ok(M.ed1('THUONG', 'THUONC') && M.ed1('GIALAP', 'GIALAPX') && !M.ed1('ABCD', 'ABXY'), 'sai khác 1 ký tự');
ok(M.isBranchMst('0100000001-001') && !M.isBranchMst('0100000001'), 'nhận MST chi nhánh');

console.log('— Tra theo tên (chỉ mục giả)');
const WORDS = ['AN', 'BINH', 'PHAT', 'THANH', 'HUNG', 'MINH', 'LONG', 'PHUC', 'TAN', 'VIET', 'HOA', 'NAM', 'DAT', 'THINH', 'QUANG', 'KHANG', 'HAI', 'SON', 'TRUNG', 'NGOC'];
const LINES = ['THƯƠNG MẠI DỊCH VỤ', 'XÂY DỰNG', 'SẢN XUẤT', 'ĐẦU TƯ PHÁT TRIỂN', 'VẬN TẢI', 'CÔNG NGHỆ'];
let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); const pk = a => a[Math.floor(rnd() * a.length)];
const entries = [];
for (let i = 0; i < 3000; i++) entries.push([String(2000000000 + i), `CÔNG TY ${pk(['TNHH', 'CỔ PHẦN'])} ${pk(LINES)} ${pk(WORDS)} ${pk(WORDS)} ${pk(WORDS)}`]);
entries.push(['0100000001', 'CÔNG TY TNHH XÂY DỰNG GIẢ LẬP MỘT']);
entries.push(['0100000001-001', 'CHI NHÁNH CÔNG TY TNHH XÂY DỰNG GIẢ LẬP MỘT TẠI HÀ NỘI']);
entries.push(['0100000002', 'CÔNG TY CỔ PHẦN VẬT TƯ GIẢ LẬP HAI']);
entries.push(['0100000003', 'CÔNG TY TNHH VẬT TƯ GIẢ LẬP HAI']);
entries.push(['0100000004', 'CÔNG TY TNHH THÉP GIẢ BA']);
entries.push(['0100000005', 'CÔNG TY TNHH THÉP GIẢ BA']);            // trùng tên y hệt → không tự điền
entries.push(['0100000006', 'CONG TY TNHH THIET BI GIA SAU']);       // tên không dấu (nguồn KH line)
const tsv = '# MST\tTên\n' + entries.map(e => e.join('\t')).join('\n') + '\n';
const I = M.build(M.parseTsv(tsv));
ok(I.N === entries.length, 'parseTsv + build: đủ ' + entries.length + ' dòng (bỏ dòng #)');
const S = q => M.search(I, q, 5);
let r = S('CÔNG TY TNHH XÂY DỰNG GIẢ LẬP MỘT');
ok(r.cands[0].mst === '0100000001' && r.auto, 'nguyên văn → đúng MST + tự điền');
ok(r.cands[1] && r.cands[1].mst === '0100000001-001' && r.cands[1].branch, 'chi nhánh xếp sau công ty mẹ');
r = S('Cty TNHH Xay dung Gia Lap Mot');
ok(r.cands[0].mst === '0100000001' && r.auto, 'viết tắt + không dấu → tự điền đúng');
r = S('Cty TNHH Xay dung Gia Lap Mot tai Ha Noi');
ok(r.cands[0].mst === '0100000001-001' && r.cands[1].mst === '0100000001', 'sổ ghi "… tại Hà Nội" (không chữ "chi nhánh") → chi nhánh tên trùng khít đứng đầu, công ty mẹ kế bên');
r = S('CN Cty TNHH XD Giả Lập Một tại Hà Nội');
ok(r.cands[0].mst === '0100000001-001', 'ghi "CN" → chi nhánh đứng đầu');
r = S('Cty CP Vật tư Giả Lập Hai');
ok(r.cands[0].mst === '0100000002' && r.cands[0].score > r.cands[1].score, 'cùng tên lõi khác loại hình → đúng loại hình (CP) xếp trên');
r = S('Công ty TNHH Vat tu Gia Lap Hai');
ok(r.cands[0].mst === '0100000003', '… và TNHH → bản TNHH');
r = S('Công ty TNHH Thép Giả Ba');
ok(!r.auto && r.cands.slice(0, 2).map(c => c.mst).sort().join() === '0100000004,0100000005', 'trùng tên y hệt 2 MST → KHÔNG tự điền, liệt kê cả 2');
r = S('Cty TNHH Thiết bị Giả Sáu');
ok(r.cands[0].mst === '0100000006', 'tên có dấu khớp dòng không dấu');
r = S('Cty TNHH Xay dung Gia Lap Mọt');
ok(r.cands[0].mst === '0100000001', 'lỗi OCR 1 ký tự → vẫn đúng ứng viên 1');
ok(S('').cands.length === 0 && S('Công ty TNHH').cands.length === 0, 'tên rỗng / chỉ loại hình → không ứng viên');
r = S('Công ty TNHH Hoàn Toàn Không Có Tên Này Zxqw');
ok(!r.auto, 'tên không có trong chỉ mục → không tự điền');

/* ================= Backend GAS ================= */
console.log('— Tải chỉ mục lên (Admin)');
const USERS = [{ username: 'admin1', role: 'Admin', team: 'Số', password: 'a' }, { username: 'tl_mn', role: 'Teamlead', team: 'PTKD MN', password: 't' },
  { username: 'u_mn', role: 'User', team: 'PTKD MN', password: 'u' }];
const E = makeEnv({ users: USERS, props: { AUTH_SECRET: 's' } });
E.ctx.setupAll();
const T = {}; USERS.forEach(u => { T[u.username] = E.call({ action: 'auth-login', username: u.username, password: u.password }).token; });
const call = (u, action, body) => E.call(Object.assign({ action, token: T[u] }, body || {}));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const CIF = '# MST\tCIF\tBRN\tSEG\n0100000001\t90000001\t101\t110000\n0100000006\t90000006,90000007\t102\t110010\n';
function pack(version, nameTsv, cifTsv, partSize) {
  const nameGz = zlib.gzipSync(Buffer.from(nameTsv)), cifGz = zlib.gzipSync(Buffer.from(cifTsv));
  const parts = []; for (let i = 0; i < nameGz.length; i += partSize) parts.push(nameGz.subarray(i, i + partSize));
  const manifest = { version, builtAt: '2026-10-15T17:52:00', source: 'gia_lap.xlsx', counts: { names: 7, cif: 2 },
    files: { name: { file: 'name_index.tsv.gz', bytes: nameGz.length, sha256: sha(nameGz) }, cif: { file: 'cif_map.tsv.gz', bytes: cifGz.length, sha256: sha(cifGz) } } };
  return { nameGz, cifGz, parts, manifest };
}
function upload(u, P) {
  const out = [];
  P.parts.forEach((b, i) => out.push(call(u, 'mst-upload', { version: P.manifest.version, kind: 'name', i, b64: b.toString('base64'), sha256: sha(b) })));
  out.push(call(u, 'mst-upload', { version: P.manifest.version, kind: 'cif', b64: P.cifGz.toString('base64') }));
  out.push(call(u, 'mst-upload', { version: P.manifest.version, kind: 'manifest', parts: P.parts.length, manifest: P.manifest }));
  return out;
}
ok(call('u_mn', 'mst-meta').data.version === null, 'chưa tải chỉ mục → meta version null');
const P1 = pack('20261015-1752', tsv, CIF, 20000);
ok(P1.parts.length >= 2, 'chỉ mục giả cắt thành ' + P1.parts.length + ' mảnh');
ok(upload('tl_mn', P1).every(x => x.error === 'FORBIDDEN'), 'Teamlead tải chỉ mục lên → FORBIDDEN (chỉ Admin)');
const bad = call('admin1', 'mst-upload', { version: '20261015-1752', kind: 'name', i: 0, b64: P1.parts[0].toString('base64'), sha256: 'sai' });
ok(bad.status === 'error' && /sha256/.test(bad.error), 'mảnh hỏng (sha256 lệch) → từ chối');
const miss = call('admin1', 'mst-upload', { version: '20261015-1752', kind: 'manifest', parts: P1.parts.length, manifest: P1.manifest });
ok(miss.status === 'error' && /Thiếu mảnh/.test(miss.error), 'chốt manifest khi chưa đủ mảnh → từ chối');
const up = upload('admin1', P1);
ok(up.every(x => x.status === 'ok'), 'Admin tải lên đủ mảnh + CIF + manifest');
const fid = E.props.MST_FOLDER_ID;
ok(!!fid && E.fileOf(fid).access === 'PRIVATE', 'tạo thư mục Drive riêng tư, ID lưu Script Property');
ok(E.db().table('NhatKy').some(x => x['Hành động'] === 'Tải lên chỉ mục MST nội bộ'), 'nhật ký: tải lên chỉ mục');

console.log('— Tải chỉ mục về trình duyệt');
let meta = call('u_mn', 'mst-meta').data;
ok(meta.version === '20261015-1752' && meta.name.parts === P1.parts.length && meta.name.sha256 === sha(P1.nameGz) && meta.uploadedBy === '', 'meta: phiên bản + số mảnh + sha256 (User không thấy người tải lên)');
ok(call('admin1', 'mst-meta').data.uploadedBy === 'admin1', 'Admin thấy người tải lên');
const got = Buffer.concat(P1.parts.map((_, i) => Buffer.from(call('u_mn', 'mst-part', { version: meta.version, i }).data.b64, 'base64')));
ok(sha(got) === sha(P1.nameGz) && zlib.gunzipSync(got).toString() === tsv, 'ghép các mảnh = đúng file gốc (sha256)');
ok(/MST_VERSION/.test(call('u_mn', 'mst-part', { version: 'cu', i: 0 }).error), 'phiên bản cũ → MST_VERSION (trình duyệt tải lại)');
ok(call('u_mn', 'mst-part', { version: meta.version, i: 99 }).status === 'error', 'mảnh ngoài phạm vi → lỗi');
ok(E.call({ action: 'mst-part', version: meta.version, i: 0 }).error === 'AUTH_REQUIRED', 'không token → AUTH_REQUIRED');
ok(E.db().table('NhatKy').some(x => x['Hành động'] === 'Tải chỉ mục MST nội bộ' && x['Người'] === 'u_mn'), 'nhật ký: ai tải chỉ mục');

console.log('— MST → CIF (chỉ server)');
let c = call('u_mn', 'mst-cif', { msts: ['0100000001', '0100000001-001', '0100000002', '0100000006'], context: 'test' }).data;
ok(c.map['0100000001'].cif === '90000001' && c.map['0100000001'].via === 'mst' && c.map['0100000001'].cn === '101', 'MST có CIF → CIF + CN');
ok(c.map['0100000001-001'].via === 'cty-me', 'MST chi nhánh → CIF theo công ty mẹ (đánh dấu)');
ok(!c.map['0100000002'] && c.map['0100000006'].cif === '90000006,90000007', 'không phải KH → không có · 1 MST nhiều CIF → đủ');
ok([...E.cacheStore.keys()].some(k => /^cif:20261015-1752:/.test(k)), 'bảng CIF chia bucket vào cache (≤ 100KB/khóa)');
ok(call('u_mn', 'mst-cif', { msts: Array.from({ length: 1001 }, (_, i) => String(3000000000 + i)) }).status === 'error', '> 1.000 MST/lần → từ chối');
ok(!JSON.stringify(call('u_mn', 'mst-meta').data).includes('90000001'), 'meta không lộ CIF');
ok(E.db().table('NhatKy').some(x => x['Hành động'] === 'Tra CIF nội bộ'), 'nhật ký: tra CIF');

console.log('— Tự điền CIF vào danh mục đối tác');
const V = (a, b, c2, d, e, f) => [a, b, c2, d, e, f];
const row = (raw, cid) => ({ ma: '', raw, cid, vals: V(0, 0, 10, 5, 5, 0), bal: 'Cân', trang: 1, ghiChu: '' });
let s = call('tl_mn', 'submit-batch', { reqId: 'S1', lots: [{ cif: '900001', tenKH: 'KHHH GIẢ', mstKH: '', cn: 'HCM', tk: '131', ky: '2025-12-31', kyGoc: '', file: 'x.xlsx', rows: [row('Cty Giả Lập Một', 'N1'), row('Cty Vật tư Giả', 'N2')] }],
  partners: [{ cid: 'N1', isNew: true, mst: '0100000001', ten: 'CÔNG TY TNHH XÂY DỰNG GIẢ LẬP MỘT', nguonMst: 'Nội bộ TPBank 20261015-1752', aliases: [] }, { cid: 'N2', isNew: true, mst: '0100000002', ten: 'CÔNG TY CỔ PHẦN VẬT TƯ GIẢ LẬP HAI', aliases: [] }] });
ok(s.status === 'ok', 'nạp lô có đối tác MST nội bộ');
let dts = E.db().table('DoiTac');
const d1 = dts.find(d => d['MST'] === '0100000001'), d2 = dts.find(d => d['MST'] === '0100000002');
ok(d1['CIF (nếu là KH TP)'] === '90000001' && d2['CIF (nếu là KH TP)'] === '' && d1['Nguồn MST'] === 'Nội bộ TPBank 20261015-1752', 'lưu lô → server tự điền CIF cho đối tác là KH TPBank, giữ nguồn MST');
s = call('tl_mn', 'edit-doitac', { reqId: 'S2', cid: d2['Counterparty_ID'], sau: { mst: '0100000006' } });
ok(E.db().table('DoiTac').find(d => d['Counterparty_ID'] === d2['Counterparty_ID'])['CIF (nếu là KH TP)'] === '90000006,90000007', 'sửa MST → CIF cập nhật theo MST mới');
call('tl_mn', 'edit-doitac', { reqId: 'S3', cid: d2['Counterparty_ID'], sau: { mst: '0100000002' } });
ok(E.db().table('DoiTac').find(d => d['Counterparty_ID'] === d2['Counterparty_ID'])['CIF (nếu là KH TP)'] === '', 'đổi sang MST không phải KH → xóa CIF cũ');
// Đối tác cũ (trước khi có chỉ mục) chưa có CIF → đối chiếu hàng loạt
const dbDt = E.db().sheet('DoiTac'), H = dbDt.data[0], ci = H.indexOf('CIF (nếu là KH TP)');
dbDt.data.forEach((rw, i) => { if (i && rw[H.indexOf('MST')] === '0100000001') rw[ci] = ''; });
ok(call('u_mn', 'sync-cif', { reqId: 'S4' }).error === 'FORBIDDEN', 'User đối chiếu CIF hàng loạt → FORBIDDEN');
const sy = call('tl_mn', 'sync-cif', { reqId: 'S5' }).data;
ok(sy.updated === 1 && E.db().table('DoiTac').find(d => d['MST'] === '0100000001')['CIF (nếu là KH TP)'] === '90000001', 'Teamlead đối chiếu CIF → điền lại 1 đối tác');

console.log('— KHHH nội bộ (khối K trong tệp CIF): tìm theo CIF/MST/ứng viên tên · mã CN theo BLOCK · chuẩn hóa khi lưu');
{
  const CIFK = CIF + '# K\tCIF\tMST\tBRN\tSEG\tTên\n'
    + 'K\t90000001\t0100000001\t001\t110000\tCÔNG TY CỔ PHẦN XÂY DỰNG GIẢ LẬP MỘT\n'
    + 'K\t90000006\t0100000006\t015\t110010\tCÔNG TY TNHH THÉP GIẢ SÁU\n'
    + 'K\t90000007\t0100000006\t002\t110010\tCÔNG TY TNHH THÉP GIẢ SÁU (HĐ CŨ)\n'
    + 'K\t90000008\t\t001\t110000\tCÔNG TY TNHH CHƯA CÓ MST GIẢ\n';
  const P3 = pack('20261016-0900', tsv, CIFK, 50000);
  P3.manifest.dvkd = { '001': '001-HKM-Hoàn Kiếm', '015': '015-TTKD_LTT-TTKD Lê Trọng Tấn (đã sáp nhập → 046)', 'x1': 'bỏ' };
  ok(upload('admin1', P3).every(x => x.status === 'ok'), 'tải lên bản có khối KH + bảng ĐVKD');
  const cache = E.ctx.CacheService.getScriptCache();
  ok(!!cache.getAll(['kh:20261016-0900:01'])['kh:20261016-0900:01'], 'tải lên → hâm sẵn cache KH theo bucket CIF (nén)');
  ok(call('u_mn', 'mst-cif', { msts: ['0100000001'] }).data.map['0100000001'].cif === '90000001', 'khối K không làm hỏng tra MST→CIF');
  E.ctx._khMem_ = null;   // lượt sau đọc từ cache, không đọc tệp
  const r1 = call('u_mn', 'kh-find', { q: '90000001', context: 'test' }).data, f1 = r1.items;
  ok(r1.src === 'cache', 'lượt tra đọc từ cache (không đọc lại tệp): src=' + r1.src);
  ok(f1.length === 1 && f1[0].mst === '0100000001' && f1[0].cn === '001-HKM-Hoàn Kiếm' && f1[0].ten === 'CÔNG TY CỔ PHẦN XÂY DỰNG GIẢ LẬP MỘT', 'CIF → đúng 1 KH + MST + tên có dấu + CN "001-HKM-Hoàn Kiếm" (đọc từ cache)');
  const f2 = call('u_mn', 'kh-find', { q: '0100000006' }).data.items;
  ok(f2.length === 2 && f2.map(x => x.cif).sort().join() === '90000006,90000007', 'MST → mọi CIF của MST đó');
  ok(f2.find(x => x.cif === '90000007').cn === '002 (ngoài BLOCK 2026)' && /sáp nhập → 046/.test(f2.find(x => x.cif === '90000006').cn), 'mã CN ngoài BLOCK / đã sáp nhập hiện rõ');
  const f3 = call('u_mn', 'kh-find', { msts: ['0100000009', '0100000006', '0100000001'] }).data.items;
  ok(f3.map(x => x.cif).join() === '90000006,90000007,90000001', 'tên (tra trên máy) → MST ứng viên → chỉ MST là KH TPBank, giữ thứ tự ứng viên');
  ok(call('u_mn', 'kh-find', { q: '90000008' }).data.items[0].mst === '', 'KH chưa có MST vẫn tìm được theo CIF');
  ok(call('u_mn', 'kh-find', { q: 'Cty Giả' }).status === 'error', 'gửi TÊN lên server → từ chối (tên tra trên máy)');
  ok(call('u_mn', 'kh-find', { q: '12' }).status === 'error', '< 3 số → lỗi');
  ok(E.call({ action: 'kh-find', q: '90000001' }).error === 'AUTH_REQUIRED', 'kh-find không token → AUTH_REQUIRED');
  ok(E.db().table('NhatKy').some(r => r['Hành động'] === 'Tìm KHHH nội bộ'), 'nhật ký: tìm KHHH nội bộ');
  ok(!E.ctx.mstManifest_().dvkd.x1, 'manifest: chỉ nhận mã ĐVKD 3 số');

  // Lưu lô: tên · MST · CN theo dữ liệu TPB, ghi đè ô người gõ
  let sb = call('tl_mn', 'submit-batch', { reqId: 'K1', lots: [{ cif: '90000001', tenKH: 'cty gõ tay sai', mstKH: '999', cn: 'HCM', tk: '131', ky: '2025-12-31', kyGoc: '', file: 'k.xlsx', rows: [row('Cty K', 'K1')] }],
    partners: [{ cid: 'K1', isNew: true, mst: '', ten: 'CÔNG TY TNHH K GIẢ', aliases: [] }] });
  const khk = E.db().table('KHHH').find(k => k['CIF'] === '90000001'), lok = E.db().table('Lo').find(l => l['CIF'] === '90000001');
  ok(sb.status === 'ok' && khk['Tên khách hàng'] === 'CÔNG TY CỔ PHẦN XÂY DỰNG GIẢ LẬP MỘT' && khk['MST'] === '0100000001' && khk['ĐVKD'] === '001-HKM-Hoàn Kiếm', 'lưu lô → KHHH mới theo dữ liệu chuẩn TPB (không theo ô gõ tay)');
  ok(lok['Tên KHHH'] === 'CÔNG TY CỔ PHẦN XÂY DỰNG GIẢ LẬP MỘT' && lok['CN'] === '001-HKM-Hoàn Kiếm', 'lô ghi tên + CN chuẩn');
  // KHHH cũ (nhập tay) → chuẩn hóa: chỉ MST · Tên · ĐVKD, cột khác giữ
  const sh = E.db().sheet('KHHH'), HH = sh.data[0];
  const old = HH.map(h => ({ 'CIF': '90000006', 'MST': '', 'Tên khách hàng': 'thep gia sau', 'Ngành': 'Thép', 'ĐVKD': 'HN', 'Team': 'PTKD MN', 'Người tạo': 'x' }[h] || ''));
  sh.data.push(old);
  ok(call('u_mn', 'sync-khhh', { reqId: 'K2' }).error === 'FORBIDDEN', 'User chuẩn hóa KHHH → FORBIDDEN');
  const sk = call('tl_mn', 'sync-khhh', { reqId: 'K3' }).data;
  const k6 = E.db().table('KHHH').find(k => k['CIF'] === '90000006');
  ok(sk.updated >= 1 && k6['Tên khách hàng'] === 'CÔNG TY TNHH THÉP GIẢ SÁU' && k6['MST'] === '0100000006' && /^015-TTKD_LTT/.test(k6['ĐVKD']) && k6['Ngành'] === 'Thép' && k6['Người tạo'] === 'x',
    'chuẩn hóa KHHH → MST · Tên · ĐVKD theo TPB, Ngành/Người tạo giữ nguyên');}

console.log('— Thay phiên bản · bảo vệ · gỡ');
const P2 = pack('20261101-0900', tsv.replace('GIẢ BA', 'GIẢ BA MỚI'), CIF, 50000);
ok(upload('admin1', P2).every(x => x.status === 'ok'), 'tải lên phiên bản mới');
const names = E.folders.get(fid).files.map(f => E.blobs.get(f).name);
ok(names.every(n => n === 'manifest.json' || n.startsWith('20261101-0900.')) && call('u_mn', 'mst-meta').data.version === '20261101-0900', 'chỉ còn file phiên bản mới; meta đổi phiên bản');
const someFile = E.folders.get(fid).files[0];
E.fileOf(someFile).viewers.push('ai-do@gmail.com'); E.fileOf(fid).access = 'ANYONE_WITH_LINK';
const g = E.ctx.guardDaily();
ok(E.fileOf(someFile).viewers.length === 0 && E.fileOf(fid).access === 'PRIVATE' && g.removed.length >= 2, 'guard hằng ngày gỡ chia sẻ thư mục + file chỉ mục');
ok(call('tl_mn', 'mst-remove', { reqId: 'S6' }).error === 'FORBIDDEN', 'Teamlead gỡ chỉ mục → FORBIDDEN');
ok(call('admin1', 'mst-remove', { reqId: 'S7' }).status === 'ok' && call('u_mn', 'mst-meta').data.version === null, 'Admin gỡ → mọi người hết chỉ mục');
ok(call('u_mn', 'mst-cif', { msts: ['0100000001'] }).data.version === null, 'tra CIF khi đã gỡ → rỗng, không lỗi');
s = call('tl_mn', 'submit-batch', { reqId: 'S8', lots: [{ cif: '900003', tenKH: 'KHHH GIẢ 3', mstKH: '', cn: 'HCM', tk: '331', ky: '2025-12-31', kyGoc: '', file: 'y.xlsx', rows: [row('Cty Mới', 'N1')] }],
  partners: [{ cid: 'N1', isNew: true, mst: '0100000009', ten: 'CÔNG TY TNHH MỚI GIẢ', aliases: [] }] });
ok(s.status === 'ok', 'không có chỉ mục → nạp lô vẫn chạy bình thường');

console.log(`MST: ${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
