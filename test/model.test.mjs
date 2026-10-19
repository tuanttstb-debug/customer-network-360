// Kiểm thử mô hình 08–11 (assets/js/model.js) bằng số tính tay theo công thức template — dữ liệu GIẢ. Chạy: node test/model.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.MAP131 = require('../core/mapping.js');
const Mo = require('../assets/js/model.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
const B = 1e9;
const data = {
  config: {},
  khhh: [{ cif: '1', ten: 'KHHH Một Giả', team: 'PTKD MN', dvkd: 'HCM', rm: 'rm1', mst: '0100000099' }, { cif: '2', ten: 'KHHH Hai Giả', team: 'PTKD MB', dvkd: 'HN' }],
  khTP: [{ cif: '9', mst: '0300000003', ten: 'Công ty Cung Cấp Giả' }],
  doiTac: [
    { id: 'DT00001', ten: 'Công ty Người Mua A Giả', mst: '0100000001' }, { id: 'DT00002', ten: 'Công ty Người Mua B Giả', mst: '' },
    { id: 'DT00003', ten: 'Công ty Cung Cấp Giả', mst: '0300000003' }, { id: 'DT00004', ten: 'Nguyễn Văn Giả', caNhan: true },
    { id: 'DT00005', ten: 'Công ty Ngừng Giả', mst: '0500000005', ttMst: 'NNT ngừng hoạt động và đã đóng MST' },
  ],
  lots: [
    { id: 'L1', cif: '1', tk: '131', ky: '2025-06-30', status: 'Đã duyệt', team: 'PTKD MN' },
    { id: 'L2', cif: '1', tk: '131', ky: '2025-12-31', status: 'Đã duyệt', team: 'PTKD MN' },
    { id: 'L3', cif: '1', tk: '331', ky: '2025-12-31', status: 'Đã duyệt', team: 'PTKD MN' },
    { id: 'L4', cif: '2', tk: '131', ky: '2025-12-31', status: 'Đã duyệt', team: 'PTKD MB' },
    { id: 'L5', cif: '2', tk: '131', ky: '2025-12-31', status: 'Chờ duyệt', team: 'PTKD MB' },
    { id: 'L6', cif: '2', tk: '131', ky: '2025-09-30', status: 'Thay thế', team: 'PTKD MB' },
  ],
  congNo: [
    { lot: 'L1', id: 'DT00001', vals: [0, 0, 10 * B, 8 * B, 2 * B, 0] },
    { lot: 'L2', id: 'DT00001', vals: [2 * B, 0, 20 * B, 15 * B, 7 * B, 0] },
    { lot: 'L2', id: 'DT00002', vals: [0, 0, 10 * B, 4 * B, 6 * B, 0] },
    { lot: 'L2', id: 'DT00004', vals: [0, 0, 1 * B, 1 * B, 0, 0] },
    { lot: 'L3', id: 'DT00003', vals: [0, 1 * B, 2 * B, 5 * B, 0, 4 * B] },
    { lot: 'L3', id: 'DT00005', vals: [0, 0, 1 * B, 1 * B, 0, 0] },
    { lot: 'L4', id: 'DT00002', vals: [0, 0, 20 * B, 10 * B, 10 * B, 0] },
    { lot: 'L5', id: 'DT00002', vals: [0, 0, 999 * B, 0, 999 * B, 0] },
    { lot: 'L6', id: 'DT00001', vals: [0, 0, 777 * B, 0, 0, 0] },
  ],
};
const M = Mo.compute(data);
const E = (cif, id) => M.edges.find(e => e.cif === cif && e.id === id);

console.log('— Lọc dữ liệu');
ok(M.report === '2025-12-31', 'ngày báo cáo = kỳ mới nhất của lô đã duyệt');
ok(M.edges.length === 5, '5 quan hệ: bỏ cá nhân + bỏ lô chờ duyệt/thay thế');
ok(!E('1', 'DT00004'), 'đối tác cá nhân không lên mô hình');
ok(E('2', 'DT00002').psThu === 20 * B, 'lô Chờ duyệt / Thay thế không cộng vào số liệu');

console.log('— 08 Relationship Edge');
const a = E('1', 'DT00001');
ok(a.psThu === 30 * B && a.thuHoi === 23 * B, 'PS phải thu = Σ PS Nợ 131 mọi kỳ; thu hồi = Σ PS Có');
ok(a.duThu === 7 * B, 'Dư PT cuối kỳ = số dư lô MỚI NHẤT (31/12), không cộng lô 30/06');
ok(near(a.tlThuHoi, 23 / 30), 'tỷ lệ thu hồi = J/I');
ok(M.months === 6 && a.months === 6, 'số tháng hoạt động = DATEDIF(01/07/2025, 31/12/2025, "m") + 1 = 6');
ok(near(a.share, 30 / 40), 'tỷ trọng = PS phải thu / tổng PS phải thu của KHHH (0,75)');
ok(a.scale === 30 * B, 'tổng quy mô = I + M + S');
const strengthA = Math.min(25, 30 * B / 5e10 * 25) + Math.min(15, 6 / 12 * 15) + Math.min(15, 0.75 / 0.4 * 15) + 0 + 0 + 25 / 10;
ok(near(a.strength, strengthA) && near(a.strength, 40), 'điểm sức mạnh = 15 + 7,5 + 15 + 2,5 = 40 (công thức AE)');
ok(a.group === 'Cần xác minh', 'phân nhóm < 50 → Cần xác minh');
const c = E('1', 'DT00003');
ok(c.psTra === 5 * B && c.traTien === 2 * B && c.duTra === 4 * B, '331: PS phải trả = PS Có, thanh toán = PS Nợ, dư = Dư Có cuối');
ok(c.role === Mo.ROLE_SUP && a.role === Mo.ROLE_BUY, 'vai trò suy luận: 131 → người mua, 331 → nhà cung cấp');
ok(near(c.share, 5 / 6), 'tỷ trọng nhà cung cấp = PS phải trả / tổng PS phải trả');
ok(a.rankAll === 1 && E('1', 'DT00002').rankAll === 2, 'hạng tổng theo KHHH (quy mô giảm dần)');
ok(E('2', 'DT00002').rankByDt === 1 && E('1', 'DT00002').rankByDt === 2, 'hạng theo đối tác giữa các KHHH');

console.log('— Đã là KH TPBank');
ok(!!M.daLaKH.get('DT00003') && !M.daLaKH.get('DT00001'), 'trùng MST danh mục KH TPBank → Đã là KH');

console.log('— 09 Opportunity');
const ob = M.opps.find(o => o.id === 'DT00002');
const sB = Math.min(25, 30 * B / 8e11 * 25) + Math.min(15, 2 / 4 * 15) + 0 + Math.min(10, 6 / 12 * 10) + 0 + 20;
ok(ob && ob.nKH === 2 && ob.scale === 30 * B, 'cơ hội DT00002: 2 KHHH, quy mô 30 tỷ');
ok(near(ob.score, sB), 'điểm cơ hội = ' + sB.toFixed(4) + ' (công thức S)');
ok(ob.priority === 'P3 - Theo dõi' && ob.bridge.cif === '2', 'ưu tiên P3; KHHH cầu nối = quan hệ lớn nhất (CIF 2)');
ok(!M.opps.some(o => o.id === 'DT00003'), 'đối tác đã là KH TPBank không vào danh sách cơ hội');
ok(near(ob.toi, 30 * B * 0.004), 'TOI kỳ vọng = 0,4% quy mô');

console.log('— 10 Reference');
const rb = M.refs.find(r => r.id === 'DT00002');
ok(rb.top.length === 2 && rb.top[0].cif === '2', 'tham chiếu #1 = KHHH quy mô lớn nhất');
ok(near(rb.score, Math.min(40, 20 * B / 5e10 * 40) + Math.min(20, 6 / 12 * 20) + Math.min(20, 2 / 4 * 20) + 20), 'điểm tham chiếu (công thức H)');

console.log('— 11 Risk');
const ra = M.allRisks.find(r => r.cif === '1' && r.id === 'DT00001');
ok(ra.type === 'Tập trung người mua' && ra.level === 'Cao', 'tỷ trọng 0,75 ≥ 0,4 → Tập trung người mua · Cao');
ok(M.allRisks.find(r => r.cif === '1' && r.id === 'DT00002').chain === 'Mắt xích chung hệ sinh thái (2 KH)', 'đối tác chung 2 KHHH → mắt xích chung');
ok(/ngừng hoạt động/.test(M.allRisks.find(r => r.id === 'DT00005').stop), 'đối tác ngừng hoạt động (VietQR) → cảnh báo');
ok(M.risks.every(r => r.flag) && M.risks[0].rank === 1, 'danh sách cảnh báo chỉ gồm dòng có cờ, xếp hạng từ 1');
const D = Mo.compute(Object.assign({}, data, { lots: [
  { id: 'Q1', cif: '1', tk: '131', ky: '2025-08-31', status: 'Đã duyệt' }, { id: 'Q2', cif: '1', tk: '131', ky: '2025-12-31', status: 'Đã duyệt' }],
  congNo: [{ lot: 'Q1', id: 'DT00001', vals: [0, 0, 10 * B, 0, 0, 0] }, { lot: 'Q2', id: 'DT00001', vals: [0, 0, 5 * B, 0, 0, 0] }] }));
const rd = D.allRisks[0];
ok(rd.ps3a === 5 * B && rd.ps3b === 10 * B && near(rd.chg, -0.5) && rd.decline === 'Suy giảm đầu ra', 'suy giảm đầu ra: 3T gần nhất 5 tỷ vs 3T trước 10 tỷ = −50% ≤ −30%');
const cont = Mo.contagion(M, 'DT00002');
ok(cont.length === 2 && cont[0].share >= cont[1].share, 'lây lan: KHHH ảnh hưởng xếp theo tỷ trọng');

console.log('— Tham số');
const M2 = Mo.compute(Object.assign({}, data, { config: { 'Ngưỡng Opportunity P1': 30, 'Ngưỡng tập trung cao': 0.9 } }));
ok(M2.opps.find(o => o.id === 'DT00002').priority === 'P1 - Tiếp cận ngay', 'đổi ngưỡng P1 ở Config → đổi mức ưu tiên');
ok(M2.allRisks.find(r => r.cif === '1' && r.id === 'DT00001').level === 'Trung bình', 'đổi ngưỡng tập trung cao → đổi mức độ');
ok(Mo.datedifM('2025-07-15', '2025-08-14') === 0 && Mo.datedifM('2025-07-15', '2025-08-15') === 1, 'DATEDIF "m" đúng theo ngày');

console.log('— Chỉ số đã cân (D17)');
const dataLech = Object.assign({}, data, { congNo: data.congNo.map(r => (r.lot === 'L2' && r.id === 'DT00002' ? Object.assign({}, r, { bal: 'Chưa cân' }) : r)) });
const Mc = Mo.compute(dataLech, { chiCan: true }), Mk = Mo.compute(dataLech);
ok(Mc.chiCan === true && Mc.anChuaCan === 1, 'bật chiCan → ẩn đúng 1 dòng "Chưa cân" của lô đã duyệt');
ok(!Mc.edges.find(e => e.cif === '1' && e.id === 'DT00002') && Mc.edges.find(e => e.cif === '2' && e.id === 'DT00002'), 'quan hệ chỉ có dòng chưa cân bị bỏ; KHHH khác giữ nguyên');
ok(near(Mc.edges.find(e => e.cif === '1' && e.id === 'DT00001').share, 1), 'tỷ trọng tính lại trên dòng đã cân: 30 / 30 = 1');
ok(Mk.anChuaCan === 0 && Mk.edges.length === M.edges.length && near(Mk.edges.find(e => e.cif === '1' && e.id === 'DT00001').share, 0.75), 'tắt chiCan → như cũ (0,75)');

console.log('— Counterparty template ver 3 (D19)');
const CP = Mo.counterparty(data);
ok(CP.length === 7, '7 dòng = đối tác × KHHH × TK × kỳ của lô đã duyệt (bỏ lô chờ duyệt/thay thế)');
ok(CP.map(r => r.cif + r.tk + r.ky.slice(5, 7)).join(',') === '113106,113112,113112,113112,133112,133112,213112', 'xếp KHHH → TK → kỳ');
const cp1 = CP[1];
ok(cp1.id === 'DT00001' && cp1.no === 20 * B && cp1.co === 15 * B && cp1.tong === 51 * B, 'PS Nợ/Có theo đối tác; J = Σ(Nợ+Có) cả KHHH×TK×kỳ = 35+14+2 = 51 tỷ');
ok(cp1.mst === '0100000001' && cp1.mstKH === '0100000099' && cp1.tenKH === 'KHHH Một Giả', 'MST đối tác + MST/tên KHHH theo danh mục');
ok(CP[2].id === 'DT00002' && CP[2].mst === '' && CP[0].tong === 18 * B, 'đối tác chưa MST giữ mã DT; kỳ 30/06 tổng riêng 18 tỷ');
const CPc = Mo.counterparty(dataLech, { chiCan: true });
ok(CPc.length === 6 && CPc[1].tong === 37 * B, 'chiCan → bỏ dòng chưa cân, J tính lại 35 + 2 = 37 tỷ');
ok(Mo.counterparty(data, { cifs: new Set(['2']) }).length === 1, 'phạm vi User: chỉ KHHH được phép');

console.log(`MODEL: ${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
