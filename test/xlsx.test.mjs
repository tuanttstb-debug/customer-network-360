// Kiểm thử bộ đọc Excel 131/331 theo cột (core/xlsx131.js) — dữ liệu GIẢ. Chạy: node test/xlsx.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const X = require('../core/xlsx131.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
const allBal = g => g.rows.every(r => r.bal === 'ok');
const totOk = g => g.total && g.total.vals.every((v, j) => v === g.rows.reduce((s, r) => s + r.vals[j], 0));

console.log('— Sổ tổng hợp công nợ theo đối tượng (phần mềm kế toán: Mã TK · Mã ĐT · TK con · dòng Cộng TK · cột cờ)');
{
  const aoa = [
    ['CÔNG TY CP GIẢ LẬP A'], ['Địa chỉ giả'], ['Mã số thuế : 0100000000'], [],
    ['SỔ TỔNG HỢP CÔNG NỢ THEO ĐỐI TƯỢNG'], ['Tài khoản : (131,1311,1312)'], [], [], ['Từ ngày 01/01/26 đến ngày 30/06/26'], [],
    ['TT', 'Mã', 'Mã', 'Tên đối tượng', 'Số dư đầu kỳ (Vnd)', '', 'Phát sinh trong kỳ (Vnd)', '', 'Số dư cuối kỳ (Vnd)'],
    ['', 'TK', 'ĐT', '', 'Nợ', 'Có', 'Nợ', 'Có', 'Nợ', 'Có'], [], [],
    [1, '1311', '0100000001', 'Tổng công ty Xây dựng Giả Một', 1000, 0, 500, 300, 1200, 0, '1'],
    [2, '1311', 100000002, 'CÔNG TY TNHH GIẢ HAI', 0, 0, 200, 200, 0, 0, '1'],
    [3, '1311', '0100000003-001', 'Chi nhánh Giả Ba', 50, 0, 0, 0, 50, 0, '1'],
    [4, '1311', '001099000001', 'NGUYỄN VĂN GIẢ', 0, 0, 10, 10, 0, 0, '1'],
    ['', '1311', '', 'Cộng tài khoản : 1311', 1050, 0, 710, 510, 1250, 0, '2'],
    [1, '1312', 'CTY_GIA1', 'Tổng công ty Xây dựng Giả Một', 0, 400, 100, 0, 0, 300, '1'],
    ['', '1312', '', 'Cộng tài khoản : 1312', 0, 400, 100, 0, 0, 300, '2'],
    [], ['', '', '', 'Tổng cộng', 1050, 400, 810, 510, 1250, 300],
    [], ['', '', '', '', '', '', '', '', 'Ngày 31 tháng 12 năm 2026'], ['', '', '', 'Người lập', '', 'Kế toán trưởng'],
  ];
  const r = X.parse(aoa, { fileName: '131. quý 2.2026.xlsx' });
  const g = r && r[0];
  ok(r && r.length === 1, 'nhận 1 bảng');
  ok(g.header.tk === '131', 'TK 131 từ "Tài khoản : (131,1311,1312)" (' + g.header.tk + ')');
  ok(g.header.ky === '2026-06-30' && g.header.tu === '2026-01-01', 'kỳ năm 2 chữ số 01/01/26 → 30/06/26 (' + g.header.tu + ' → ' + g.header.ky + ')');
  ok(g.rows.length === 5, '5 dòng đối tác, bỏ 2 dòng "Cộng tài khoản" + chữ ký (' + g.rows.length + ')');
  ok(g.rows[0].ten === 'Tổng công ty Xây dựng Giả Một', '"Tổng công ty …" là đối tác, không phải dòng tổng');
  ok(allBal(g), 'mọi dòng cân đối (cột cờ "1/2" không dính vào Dư cuối kỳ Có)');
  ok(totOk(g), 'dòng Tổng cộng khớp 6/6 cột');
  ok(g.rows[0].mstGoc === '0100000001' && g.rows[2].mstGoc === '0100000003-001', 'mã ĐT dạng MST (10 số / 10-3) → gợi ý MST');
  ok(g.rows[1].ma === '0100000002' && g.rows[1].mstGoc === '0100000002', 'mã ĐT kiểu số mất số 0 đầu (9 chữ số) → bù 0');
  ok(g.rows[3].caNhanGoc && !g.rows[3].mstGoc, 'mã 12 số (CCCD) → cá nhân, không coi là MST');
  ok(!g.rows[4].mstGoc && g.rows[4].ma === 'CTY_GIA1', 'mã nội bộ chữ → giữ mã, không gợi ý MST');
  ok(g.rows.every(r => r.tk === '131') && g.rows[4].tkCT === '1312', 'TK dòng = 131, giữ TK con 1312');
}

console.log('— Bảng mẫu của e2e (tiêu đề "Số phát sinh", không có cột mã)');
{
  const aoa = [['TỔNG HỢP CÔNG NỢ PHẢI THU'], ['Tài khoản: 131; Từ ngày 01/01/2025 đến ngày 31/12/2025'], [],
    ['STT', 'Tên khách hàng', 'Số dư đầu kỳ', '', 'Số phát sinh', '', 'Số dư cuối kỳ', ''], ['', '', 'Nợ', 'Có', 'Nợ', 'Có', 'Nợ', 'Có'],
    [1, 'Công ty Giả Một', 10, 0, 30, 20, 20, 0], [2, 'Nguyễn Văn Giả', 0, 0, 1, 1, 0, 0], ['', 'TỔNG CỘNG', 10, 0, 31, 21, 20, 0]];
  const g = X.parse(aoa, { fileName: 'x.xlsx' })[0];
  ok(g.header.tk === '131' && g.header.ky === '2025-12-31', 'TK 131 · kỳ 31/12/2025');
  ok(g.rows.length === 2 && allBal(g) && totOk(g), '2 dòng cân đối + tổng khớp');
}

console.log('— Tiêu đề 1 dòng, số dạng chữ "1.234.567" / "(1.000)" / "-", không có dòng tổng');
{
  const aoa = [['BÁO CÁO CÔNG NỢ PHẢI TRẢ NHÀ CUNG CẤP'], ['Quý III năm 2025'],
    ['Mã NCC', 'Tên nhà cung cấp', 'Dư Nợ đầu kỳ', 'Dư Có đầu kỳ', 'PS Nợ', 'PS Có', 'Dư Nợ cuối kỳ', 'Dư Có cuối kỳ'],
    ['NCC01', 'Công ty Thép Giả', '-', '1.000.000', '2.500.000', '3.000.000', '-', '1.500.000'],
    ['NCC02', 'Công ty Cát Giả', '(1.000)', '-', '1.000', '-', '-', '-']];
  const g = X.parse(aoa, { fileName: 'ncc.xlsx' })[0];
  ok(g.header.tk === '331', 'TK 331 theo "phải trả"');
  ok(g.header.ky === '2025-09-30' && g.header.tu === '2025-07-01', 'kỳ "Quý III năm 2025" → 01/07–30/09/2025 (' + g.header.kyGoc + ')');
  ok(g.rows.length === 2 && allBal(g), 'số dạng chữ + số âm (x) + "-" đọc đúng, cân đối');
  ok(g.rows[1].vals[0] === -1000, '"(1.000)" = −1.000');
  ok(g.total === null, 'không có dòng tổng → total null');
}

console.log('— Chỉ có Phát sinh + Cuối kỳ (suy đầu kỳ) · kỳ theo tên tệp');
{
  const aoa = [['CÔNG NỢ'], ['STT', 'Mã KH', 'Tên khách hàng', 'Phát sinh', '', 'Số dư cuối kỳ', ''], ['', '', '', 'Nợ', 'Có', 'Nợ', 'Có'],
    [1, 'KH1', 'Công ty Giả Một', 100, 40, 80, 0]];
  const g = X.parse(aoa, { fileName: '131 quý 2.2026.xlsx' })[0];
  ok(g.header.tk === '131' && g.header.ky === '2026-06-30', 'TK + kỳ lấy từ tên tệp "131 quý 2.2026"');
  ok(g.rows[0].vals[0] === 20 && g.rows[0].bal === 'ok', 'đầu kỳ suy = cuối kỳ − phát sinh (20), cân đối');
  ok(g.warn.some(w => /Dư đầu kỳ/.test(w)), 'có cảnh báo suy đầu kỳ');
}

console.log('— 1 sheet có cả 131 và 331 → tách 2 bảng');
{
  const aoa = [['Tổng hợp công nợ'], ['Năm 2025'], ['TK', 'Tên đối tượng', 'Đầu kỳ', '', 'Phát sinh', '', 'Cuối kỳ', ''], ['', '', 'Nợ', 'Có', 'Nợ', 'Có', 'Nợ', 'Có'],
    ['131', 'Công ty Mua Giả', 0, 0, 10, 5, 5, 0], ['331', 'Công ty Bán Giả', 0, 0, 3, 8, 0, 5]];
  const r = X.parse(aoa, {});
  ok(r.length === 2 && r.map(g => g.header.tk).join() === '131,331' && r.every(g => g.rows.length === 1), '2 bảng 131 / 331, mỗi bảng 1 dòng');
  ok(r[0].header.ky === '2025-12-31', 'kỳ "Năm 2025" → 31/12/2025');
}

console.log('— Không phải bảng công nợ');
ok(X.parse([['a', 'b'], [1, 2]], {}) === null, 'bảng lạ → null (dùng đường dự phòng)');
ok(X.cellNum('1.234,56') === 1235 && X.cellNum('12,5') === 13 && X.cellNum('abc') === null && X.cellNum('') === 0, 'cellNum: thập phân làm tròn · chữ → null · trống → 0');

console.log(`\n${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
