// Kiểm thử backend GAS CN360 trong Node (giả lập) — dữ liệu GIẢ hoàn toàn. Chạy: node test/gas.test.mjs
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEnv } from './gas_harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'sync_gas.mjs')], { stdio: 'inherit' });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
const SECRET = 'test-secret-giong-shtd';
const USERS = [
  { username: 'admin1', role: 'Admin', team: 'Số', password: 'a' },
  { username: 'tl_mn', role: 'Teamlead', team: 'PTKD MN', password: 't' },
  { username: 'tl_mb', role: 'Teamlead', team: 'PTKD MB', password: 't' },
  { username: 'u_mn', role: 'User', team: 'PTKD MN', password: 'u' },
  { username: 'u_mn2', role: 'User', team: 'PTKD MN', password: 'u' },
  { username: 'u_mb', role: 'User', team: 'PTKD MB', password: 'u' },
  { username: 'off', role: 'User', team: 'PTKD MN', password: 'o', active: false },
];
const E = makeEnv({ users: USERS, props: { AUTH_SECRET: SECRET } });
const { call } = E;

console.log('— Khởi tạo + khóa file');
const setup = E.ctx.setupAll();
ok(!!E.props.DB_ID && E.db().getSheets().length === 9, 'setupAll: tạo CN360_DB 9 sheet');
ok(E.db().table('Config').length >= 14, 'Config mặc định = 13_Lists + bộ đếm');
E.fileOf(E.props.DB_ID).editors.push('ai-do@gmail.com'); E.fileOf(E.props.DB_ID).viewers.push('xem@gmail.com'); E.fileOf(E.props.DB_ID).access = 'ANYONE_WITH_LINK';
const g = E.ctx.guardDaily();
ok(g.removed.length === 3 && E.fileOf(E.props.DB_ID).access === 'PRIVATE' && E.fileOf(E.props.DB_ID).editors.join() === E.owner, 'guard: gỡ link công khai + editor + viewer, chỉ còn TK chủ');
ok(E.db().table('NhatKy').some(r => /CẢNH BÁO chia sẻ/.test(r['Hành động'])), 'guard: ghi nhật ký cảnh báo');
ok(E.triggers.length === 1, 'trigger guard hằng ngày');
E.ctx.setupAll();
ok(E.db().table('Config').length === setup.configAdded && E.triggers.length === 1, 'setupAll chạy lại: không nhân đôi config/trigger');

console.log('— Đăng nhập dùng chung SHTD');
const login = (u, p) => call({ action: 'auth-login', username: u, password: p });
const T = {}; USERS.filter(u => u.active !== false).forEach(u => { T[u.username] = login(u.username, u.password).token; });
ok(Object.values(T).every(Boolean), 'đăng nhập 6 TK đúng mật khẩu');
let threw = ''; try { login('u_mn', 'sai'); } catch (e) { threw = e.message; } ok(/Sai mật khẩu/.test(threw), 'sai mật khẩu → lỗi');
threw = ''; try { login('off', 'o'); } catch (e) { threw = e.message; } ok(/vô hiệu/.test(threw), 'TK Active=FALSE → chặn');
const shtdToken = E.ctx.makeToken_('u_mb', 'U MB', 'User', 'PTKD MB');   // token do SHTD cấp (cùng AUTH_SECRET)
ok(call({ action: 'me', token: shtdToken }).data.user.username === 'u_mb', 'SSO: token SHTD dùng thẳng được');
ok(call({ action: 'load', token: shtdToken.slice(0, -2) + 'aa' }).error === 'AUTH_REQUIRED', 'token sửa chữ ký → AUTH_REQUIRED');
ok(call({ action: 'load' }).error === 'AUTH_REQUIRED', 'không token → AUTH_REQUIRED');
const offTok = E.ctx.makeToken_('off', 'Off', 'User', 'PTKD MN');
ok(call({ action: 'load', token: offTok }).error === 'AUTH_REQUIRED', 'TK đã khóa ở SHTD → token cũ cũng bị chặn');
const fakeRole = E.ctx.makeToken_('u_mn', 'x', 'Admin', 'PTKD MN');
ok(call({ action: 'set-config', token: fakeRole, items: { 'Ngưỡng tập trung cao': 0.1 } }).error === 'FORBIDDEN', 'role lấy từ User_Master, không tin role trong token');

console.log('— Nạp lô (Admin vào thẳng)');
const V = (a, b, c, d, e, f) => [a, b, c, d, e, f];
const lot = (cif, tk, ky, rows, extra) => Object.assign({ cif, tenKH: 'KHHH GIẢ ' + cif, mstKH: '', cn: 'HCM', tk, ky, kyGoc: ky, file: 'gia_lap.xlsx', rows }, extra || {});
const row = (raw, cid, vals, bal = 'Cân') => ({ ma: '', raw, cid, vals, bal, trang: 1, ghiChu: '' });
let r = call({ action: 'submit-batch', token: T.admin1, reqId: 'R1', lots: [lot('900001', '131', '2025-12-31', [
  row('Công ty TNHH Giả Lập Một', 'N1', V(100, 0, 500, 400, 200, 0)),
  row('Cty Giả Lập Một', 'N1', V(10, 0, 0, 0, 10, 0)),
  row('Công ty CP Giả Lập Hai', 'N2', V(0, 0, 300, 100, 200, 0)),
])], partners: [
  { cid: 'N1', isNew: true, mst: '0100000001', ten: 'CÔNG TY TNHH GIẢ LẬP MỘT', aliases: [{ raw: 'Công ty TNHH Giả Lập Một' }, { raw: 'Cty Giả Lập Một', trangThai: 'Đã duyệt' }] },
  { cid: 'N2', isNew: true, mst: '', ten: 'Công ty CP Giả Lập Hai', aliases: [{ raw: 'Công ty CP Giả Lập Hai' }] },
] });
ok(r.status === 'ok' && r.data.lots[0].status === 'Đã duyệt', 'Admin nạp → Đã duyệt');
ok(r.data.idMap.N1 === 'DT00001' && r.data.idMap.N2 === 'DT00002', 'mã DTxxxxx cấp ở server');
const db = () => E.db();
ok(db().table('CongNo').length === 3 && db().table('KHHH').length === 1 && db().table('KHHH')[0]['Team'] === 'Số', 'ghi 3 dòng công nợ + KHHH mới gắn team người nạp');
ok(db().table('TenGop').filter(a => a['Counterparty_ID'] === 'DT00001').length === 0, 'TenGop: biến thể trùng khóa chuẩn hóa ("Cty …" = "Công ty TNHH …") không cần thêm dòng');
const r2 = call({ action: 'submit-batch', token: T.admin1, reqId: 'R1', lots: [lot('900001', '131', '2025-12-31', [row('x', 'N1', V(0, 0, 0, 0, 0, 0))])], partners: [{ cid: 'N1', isNew: true, ten: 'x' }] });
ok(JSON.stringify(r2) === JSON.stringify(r) && db().table('CongNo').length === 3, 'retry cùng reqId → trả kết quả cũ, không ghi lặp');

console.log('— Member nạp → chờ duyệt, quyền xem');
r = call({ action: 'submit-batch', token: T.u_mn, reqId: 'R2', lots: [lot('900002', '331', '2025-12-31', [
  row('Công ty TNHH Giả Lập Một', 'DT00001', V(0, 50, 20, 70, 0, 100)),
  row('Công ty TNHH Vật Tư Giả Ba', 'N9', V(0, 0, 10, 40, 0, 30)),
  row('Nguyễn Văn Giả', 'N8', V(0, 0, 5, 5, 0, 0)),
])], partners: [
  { cid: 'DT00001', isNew: false, mst: '0100000001', ten: 'CÔNG TY TNHH GIẢ LẬP MỘT (ĐỔI TÊN)', tenSua: true, ttMst: 'NNT đang hoạt động', nguonMst: 'VietQR 2026-10-13' },
  { cid: 'N9', isNew: true, ten: 'Công ty TNHH Vật Tư Giả Ba', aliases: [] },
  { cid: 'N8', isNew: true, ten: 'Nguyễn Văn Giả', caNhan: true },
] });
const memberLot = r.data.lots[0].id;
ok(r.data.lots[0].status === 'Chờ duyệt' && r.data.requests.length === 1, 'User nạp → Chờ duyệt + đổi tên đối tác cũ thành YÊU CẦU');
ok(db().table('DoiTac').find(d => d['Counterparty_ID'] === 'DT00001')['Tên pháp lý'] === 'CÔNG TY TNHH GIẢ LẬP MỘT', 'User không sửa thẳng được tên đối tác đã có');
ok(db().table('DoiTac').find(d => d['Counterparty_ID'] === 'DT00001')['Trạng thái MST'] === 'NNT đang hoạt động', 'trạng thái MST (VietQR, cùng MST) cập nhật thẳng');
const L = tok => call({ action: 'load', token: tok }).data;
const lMB = L(T.u_mb), lTLMN = L(T.tl_mn), lTLMB = L(T.tl_mb), lMN2 = L(T.u_mn2);
ok(!lMB.lots.some(l => l['Batch_ID'] === memberLot) && !lMB.doiTac.some(d => /Vật Tư Giả Ba/.test(d['Tên pháp lý'])), 'User team khác: không thấy lô chờ + đối tác chờ');
ok(lMB.congNo.length === 3 && lMB.doiTac.length === 2, 'User team khác: thấy đủ dữ liệu ĐÃ DUYỆT của team khác (D09)');
ok(!lMN2.lots.some(l => l['Batch_ID'] === memberLot), 'User cùng team (không phải người nạp): không thấy lô chờ');
ok(lTLMN.lots.some(l => l['Batch_ID'] === memberLot) && lTLMN.pendingForMe === 2, 'Teamlead cùng team: thấy lô chờ, badge = 1 lô + 1 yêu cầu');
ok(lTLMB.pendingForMe === 0, 'Teamlead team khác: badge 0');

console.log('— Duyệt');
ok(call({ action: 'approve-lot', token: T.tl_mb, batchId: memberLot, ok: true }).error === 'FORBIDDEN', 'Teamlead team khác duyệt → FORBIDDEN');
ok(call({ action: 'approve-lot', token: T.u_mn2, batchId: memberLot, ok: true }).error === 'FORBIDDEN', 'User duyệt → FORBIDDEN');
r = call({ action: 'approve-lot', token: T.tl_mn, batchId: memberLot, ok: true });
ok(r.data.status === 'Đã duyệt' && db().table('DoiTac').filter(d => d['Trạng thái'] === 'Chờ duyệt').length === 0, 'Teamlead cùng team duyệt → lô + đối tác mới hoạt động');
ok(L(T.u_mb).congNo.length === 6, 'sau duyệt: team khác thấy thêm 3 dòng');
const yc = L(T.tl_mn).yeuCau.find(y => y['Trạng thái'] === 'Chờ duyệt');
r = call({ action: 'approve-req', token: T.tl_mn, reqId: yc['Req_ID'], ok: true });
ok(r.data.ok && db().table('DoiTac').find(d => d['Counterparty_ID'] === 'DT00001')['Tên pháp lý'] === 'CÔNG TY TNHH GIẢ LẬP MỘT (ĐỔI TÊN)', 'duyệt yêu cầu sửa tên → áp dụng');

console.log('— Thay lô cũ cùng KHHH + TK + kỳ');
r = call({ action: 'submit-batch', token: T.tl_mn, lots: [lot('900001', '131', '2025-12-31', [row('Công ty TNHH Giả Lập Một', 'DT00001', V(100, 0, 600, 400, 300, 0))])], partners: [{ cid: 'DT00001', ten: 'x' }] });
const lots = db().table('Lo');
ok(lots.filter(l => l['CIF'] === '900001' && l['Trạng thái'] === 'Thay thế').length === 1 && lots.find(l => l['Trạng thái'] === 'Thay thế')['Thay thế bởi'] === r.data.lots[0].id, 'lô mới (Teamlead vào thẳng) → lô cũ "Thay thế", truy vết được');
ok(L(T.u_mb).congNo.filter(c => L(T.u_mb).lots.find(l => l['Batch_ID'] === c['Batch_ID'])['CIF'] === '900001').length === 1, 'load: dòng của lô bị thay thế không còn trên dashboard');

console.log('— Từ chối + mã song song');
r = call({ action: 'submit-batch', token: T.u_mn, lots: [lot('900003', '131', '2025-06-30', [row('Công ty Giả Bốn', 'DT00099', V(0, 0, 1, 1, 0, 0))])], partners: [{ cid: 'DT00099', isNew: true, ten: 'Công ty Giả Bốn' }] });
const rej = r.data.lots[0].id, dtBon = r.data.idMap.DT00099;
ok(dtBon !== 'DT00099' && /^DT0000\d$/.test(dtBon), 'mã client tự sinh không được dùng — server cấp mã thật');
call({ action: 'approve-lot', token: T.tl_mn, batchId: rej, ok: false, reason: 'sai kỳ' });
ok(!db().table('CongNo').some(c => c['Batch_ID'] === rej) && !db().table('DoiTac').some(d => d['Counterparty_ID'] === dtBon), 'từ chối → xóa dòng công nợ + đối tác chờ chỉ của lô đó');
ok(db().table('Lo').find(l => l['Batch_ID'] === rej)['Lý do'] === 'sai kỳ', 'lô từ chối giữ lý do');
const a = call({ action: 'submit-batch', token: T.u_mn, lots: [lot('900004', '131', '2025-06-30', [row('Công ty Năm Giả', 'Z', V(0, 0, 1, 1, 0, 0))])], partners: [{ cid: 'Z', isNew: true, ten: 'Công ty Năm Giả' }] });
const b = call({ action: 'submit-batch', token: T.u_mb, lots: [lot('900005', '131', '2025-06-30', [row('Công ty Sáu Giả', 'Z', V(0, 0, 1, 1, 0, 0))])], partners: [{ cid: 'Z', isNew: true, ten: 'Công ty Sáu Giả' }] });
ok(a.data.idMap.Z !== b.data.idMap.Z, '2 người cùng gửi mã tạm "Z" khác đối tác → 2 mã khác nhau');
const c2 = call({ action: 'submit-batch', token: T.admin1, lots: [lot('900006', '331', '2025-06-30', [row('CTY TNHH GIA LAP MOT (DOI TEN)', 'Q', V(0, 0, 1, 1, 0, 0))])], partners: [{ cid: 'Q', isNew: true, ten: 'CTY TNHH GIA LAP MOT (DOI TEN)' }] });
ok(c2.data.idMap.Q === 'DT00001', 'đối tác "mới" trùng tên chuẩn hóa đối tác đã có → server gộp về mã cũ');
ok(call({ action: 'submit-batch', token: T.admin1, lots: [lot('9', '131', '2025-06-30', [row('a', 'NOPE', V(0, 0, 0, 0, 0, 0))])], partners: [] }).status === 'error', 'dòng chưa gán đối tác → từ chối cả lệnh');
ok(call({ action: 'submit-batch', token: T.admin1, lots: [lot('9', '141', '2025-06-30', [row('a', 'A', V(0, 0, 0, 0, 0, 0))])], partners: [{ cid: 'A', isNew: true, ten: 'a' }] }).status === 'error', 'TK khác 131/331 → lỗi');

console.log('— Danh mục: sửa/gộp');
r = call({ action: 'edit-doitac', token: T.u_mb, cid: 'DT00002', sau: { mst: '0300000002' } });
ok(r.data.applied === false && /^YC/.test(r.data.request), 'User sửa MST → yêu cầu');
ok(call({ action: 'approve-req', token: T.tl_mn, reqId: r.data.request, ok: true }).error === 'FORBIDDEN', 'yêu cầu team MB: Teamlead MN không duyệt được');
ok(call({ action: 'approve-req', token: T.tl_mb, reqId: r.data.request, ok: true }).data.ok && db().table('DoiTac').find(d => d['Counterparty_ID'] === 'DT00002')['MST'] === '0300000002', 'Teamlead MB duyệt → MST cập nhật');
const nBefore = db().table('DoiTac').length;
r = call({ action: 'merge-doitac', token: T.admin1, from: a.data.idMap.Z, into: 'DT00002' });
ok(r.data.applied && db().table('DoiTac').length === nBefore - 1 && db().table('CongNo').every(c => c['Counterparty_ID'] !== a.data.idMap.Z), 'Admin gộp → dòng công nợ chuyển mã, mã cũ bỏ');
ok(db().table('TenGop').some(t => t['Tên gốc'] === 'Công ty Năm Giả' && t['Counterparty_ID'] === 'DT00002'), 'gộp → thêm tên gộp để lần sau tự nhận');

console.log('— Admin: tham số, KH TPBank, xóa KHHH, nhật ký');
ok(call({ action: 'set-config', token: T.tl_mn, items: { 'Ngưỡng tập trung cao': 0.5 } }).error === 'FORBIDDEN', 'Teamlead sửa tham số → FORBIDDEN');
r = call({ action: 'set-config', token: T.admin1, items: { 'Ngưỡng tập trung cao': 0.5, NEXT_DT: 1 } });
ok(r.data.updated.join() === 'Ngưỡng tập trung cao' && L(T.u_mb).config['Ngưỡng tập trung cao'] === 0.5, 'Admin sửa tham số; NEXT_DT không sửa được qua API');
ok(!('NEXT_DT' in L(T.u_mb).config), 'load không lộ bộ đếm nội bộ');
ok(call({ action: 'set-khtp', token: T.admin1, rows: [{ cif: '700001', mst: '0100000001', ten: 'Giả', cn: 'HN' }] }).data.n === 1, 'Admin thay danh mục KH TPBank');
ok(call({ action: 'log', token: T.u_mb, what: 'Xuất Excel', scope: 'all' }).error === 'FORBIDDEN', 'User xuất toàn bộ → chặn');
ok(call({ action: 'log', token: T.u_mb, what: 'Xem KHHH', target: '900001' }).data.ok, 'ghi nhật ký xem KHHH');
ok(call({ action: 'log', token: T.u_mb, what: 'Xóa sạch' }).status === 'error', 'hành động nhật ký lạ → từ chối');
ok(call({ action: 'audit', token: T.tl_mn }).error === 'FORBIDDEN' && call({ action: 'audit', token: T.admin1 }).data.rows.length > 5, 'nhật ký: chỉ Admin xem');
r = call({ action: 'delete-khhh', token: T.admin1, cif: '900002' });
ok(r.data.lots === 1 && !db().table('KHHH').some(k => k['CIF'] === '900002') && !db().table('Lo').some(l => l['CIF'] === '900002'), 'Admin xóa toàn bộ dữ liệu 1 KHHH');

console.log('— Nhập kho v0.1 (DB trống)');
const E2 = makeEnv({ users: USERS, props: { AUTH_SECRET: SECRET } }); E2.ctx.setupAll();
const tA = E2.call({ action: 'auth-login', username: 'admin1', password: 'a' }).token;
r = E2.call({ action: 'import-kho', token: tA, doiTac: [{ id: 'DT00007', ten: 'Công ty Bảy Giả', mst: '0100000007' }, { id: 'DT00012', ten: 'Công ty Mười Hai Giả' }], tenGop: [{ raw: 'Cty Bảy Giả', id: 'DT00007', trangThai: 'Đã duyệt' }],
  khhh: [{ cif: '800001', ten: 'KHHH Giả Tám' }], congNo: [
    { ky: '2025-12-31', kyGoc: '2025', cn: 'HCM', cif: '800001', tenKH: 'KHHH Giả Tám', tk: '131', raw: 'Cty Bảy Giả', id: 'DT00007', vals: [1, 0, 2, 1, 2, 0], bal: 'Cân', nguon: 'a.pdf' },
    { ky: '2025-12-31', kyGoc: '2025', cn: 'HCM', cif: '800001', tenKH: 'KHHH Giả Tám', tk: '331', raw: 'Công ty Mười Hai Giả', id: 'DT00012', vals: [0, 1, 1, 2, 0, 2], bal: 'Cân', nguon: 'b.pdf' }] });
ok(r.data.doiTac === 2 && r.data.lots === 2 && r.data.congNo === 2, 'nhập kho: 2 đối tác · 2 lô (theo KHHH+TK+kỳ) · 2 dòng');
const n3 = E2.call({ action: 'submit-batch', token: tA, lots: [lot('800001', '131', '2026-06-30', [row('Công ty Mới Giả', 'N', V(0, 0, 1, 1, 0, 0))])], partners: [{ cid: 'N', isNew: true, ten: 'Công ty Mới Giả' }] });
ok(n3.data.idMap.N === 'DT00013', 'sau nhập kho: mã mới tiếp nối DT00013 (không trùng mã cũ)');
ok(E2.call({ action: 'import-kho', token: tA, doiTac: [{ id: 'DT00001', ten: 'x' }] }).status === 'error', 'nhập kho lần 2 vào DB đã có dữ liệu → chặn');

console.log(`GAS: ${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
