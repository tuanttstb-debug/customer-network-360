// E2E trên Chrome thật (headless): FE (index.html) ⇄ backend THẬT gas/*.gs chạy trong giả lập Node (test/gas_harness.mjs).
// Trang phục vụ ở http://cn360.test/ (chặn request → đọc file repo) · GAS URL → harness · VietQR → giả lập · mọi request khác bị chặn và đếm.
// Dữ liệu GIẢ hoàn toàn. Chạy: node test/e2e.mjs [thư mục ảnh chụp]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { makeEnv } from './gas_harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'sync_gas.mjs')], { stdio: 'inherit' });
const AN = path.resolve(ROOT, '../../AIOS/08_Work/P-aius001-binh-dan-hoa-ai/dao-tao/cong-cu-an-danh');
const puppeteer = createRequire(AN + '/package.json')('puppeteer-core');
const XLSX = createRequire(path.resolve(ROOT, '../../AIOS/08_Work/W-2610-he-sinh-thai-131-331/tool/package.json'))('xlsx');   // SheetJS bản Node (cùng 0.18.5 với vendor/)
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const SHOTS = process.argv[2] || null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const TMP = fs.mkdtempSync(path.join(process.env.CLAUDE_TMP || os.tmpdir(), 'cn360e2e-'));
const GAS = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8').match(/GAS_URL:\s*'([^']+)'/)[1];
const BASE = 'http://cn360.test/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.gz': 'application/gzip', '.json': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

const USERS = [
  { username: 'admin1', displayName: 'Admin Giả', role: 'Admin', team: 'Số', password: 'a' },
  { username: 'tl_mn', displayName: 'Teamlead MN Giả', role: 'Teamlead', team: 'PTKD MN', password: 't' },
  { username: 'u_mn', displayName: 'Thành Viên MN Giả', role: 'User', team: 'PTKD MN', password: 'u' },
  { username: 'u_mb', displayName: 'Thành Viên MB Giả', role: 'User', team: 'PTKD MB', password: 'u' },
];
const env = makeEnv({ users: USERS, props: { AUTH_SECRET: 'e2e-secret' } }); env.ctx.setupAll();

// Excel giả lập: bảng tổng hợp công nợ phải thu, tên giả, 1 lỗi chính tả (gợi ý gộp) + 1 cá nhân
const fake = [
  ['TỔNG HỢP CÔNG NỢ PHẢI THU'], ['Tài khoản: 131; Từ ngày 01/01/2025 đến ngày 31/12/2025'], [],
  ['STT', 'Tên khách hàng', 'Số dư đầu kỳ', '', 'Số phát sinh', '', 'Số dư cuối kỳ', ''], ['', '', 'Nợ', 'Có', 'Nợ', 'Có', 'Nợ', 'Có'],
  [1, 'Công ty TNHH Xây dựng Giả Lập Một', 1000000000, 0, 30000000000, 20000000000, 11000000000, 0],
  [2, 'Công ty CP Vật tư Giả Lập Hai', 0, 0, 8000000000, 6000000000, 2000000000, 0],
  [3, 'Cty CP Vat tu Gia Lap Haii', 0, 0, 2000000000, 1000000000, 1000000000, 0],
  [4, 'Nguyễn Văn Giả', 0, 0, 100000000, 100000000, 0, 0],
  ['', 'TỔNG CỘNG', 1000000000, 0, 40100000000, 27100000000, 14000000000, 0],
];
const wb0 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet(fake), 'S1');
const XL = path.join(TMP, 'gia_lap_131.xlsx'); XLSX.writeFile(wb0, XL);
// 331 cho KHHH thứ 2 (team MB) — chung đối tác "Giả Lập Một"
const fake2 = [['TỔNG HỢP CÔNG NỢ PHẢI TRẢ'], ['Tài khoản: 331; Từ ngày 01/01/2025 đến ngày 31/12/2025'], [],
  ['STT', 'Tên nhà cung cấp', 'Số dư đầu kỳ', '', 'Số phát sinh', '', 'Số dư cuối kỳ', ''], ['', '', 'Nợ', 'Có', 'Nợ', 'Có', 'Nợ', 'Có'],
  [1, 'CÔNG TY TNHH XÂY DỰNG GIẢ LẬP MỘT', 0, 500000000, 4000000000, 5000000000, 0, 1500000000],
  [2, 'Công ty TNHH Thép Giả Ba', 0, 0, 1000000000, 3000000000, 0, 2000000000],
  ['', 'TỔNG CỘNG', 0, 500000000, 5000000000, 8000000000, 0, 3500000000]];
const wb2 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(fake2), 'S1');
const XL2 = path.join(TMP, 'gia_lap_331.xlsx'); XLSX.writeFile(wb2, XL2);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 0, args: ['--no-first-run', '--unsafely-treat-insecure-origin-as-secure=' + BASE.slice(0, -1)] });   // prod chạy https (github.io) → crypto.subtle cần secure context
const ext = [], errs = [], csp = [];
let vqrName = 'CÔNG TY TRÁCH NHIỆM HỮU HẠN XÂY DỰNG GIẢ LẬP MỘT';
async function newPage(curEnv) {
  const page = await (await browser.createBrowserContext()).newPage();   // mỗi người dùng 1 hồ sơ riêng (localStorage tách biệt)
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', async r => {
    const u = r.url();
    try {
      if (u.startsWith(BASE)) {
        const p = path.join(ROOT, decodeURIComponent(new URL(u).pathname));
        if (!fs.existsSync(p) || !p.startsWith(ROOT)) return r.respond({ status: 404, body: 'nf' });
        return r.respond({ status: 200, contentType: MIME[path.extname(p)] || 'application/octet-stream', body: fs.readFileSync(p) });
      }
      if (u.startsWith(GAS)) {
        if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
        let out; try { out = curEnv.call(JSON.parse(r.postData())); } catch (e) { out = { status: 'error', error: e.message }; }
        return r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(out) });
      }
      if (u.startsWith('https://api.vietqr.io/')) {
        return r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ code: '00', data: { id: u.split('/').pop(), name: vqrName, address: 'Địa chỉ giả', status: 'NNT đang hoạt động (đã được cấp GCN ĐKT)' } }) });
      }
      if (/^(data|blob):/.test(u)) return r.continue();
      ext.push(u); return r.abort();
    } catch (e) { console.error('intercept', e); try { r.abort(); } catch (_) {} }
  });
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(t)) errs.push(t); if (/Content Security Policy|Refused to/.test(t)) csp.push(t); });
  return page;
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); };
const waitReady = page => page.waitForFunction(() => window.__cnReady && !document.getElementById('busy').classList.contains('on'), { timeout: 30000 });
const idle = page => page.waitForFunction(() => !document.getElementById('busy').classList.contains('on'), { timeout: 60000 });
async function login(page, u, p) {
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.waitForSelector('#lgUser', { visible: true });
  await page.type('#lgUser', u); await page.type('#lgPass', p); await page.click('#lgBtn');
  await waitReady(page);
}
const go = async (page, h) => { await page.evaluate(h2 => { location.hash = h2; }, h); await page.waitForFunction(h2 => location.hash === h2, {}, h); await new Promise(r => setTimeout(r, 150)); await idle(page); };
const text = (page, sel) => page.$eval(sel, e => e.innerText);
const modalYes = async page => { await page.waitForSelector('#modal.on #askYes', { visible: true }); await page.click('#askYes'); await idle(page); };

try {
  console.log('— Đăng nhập + quyền xem');
  let page = await newPage(env);
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  ok(await page.$eval('#loginOverlay', e => getComputedStyle(e).display !== 'none'), 'chưa đăng nhập → màn đăng nhập');
  await page.type('#lgUser', 'u_mn'); await page.type('#lgPass', 'sai'); await page.click('#lgBtn');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('lgErr')).display !== 'none');
  ok(/Sai mật khẩu/.test(await text(page, '#lgErr')), 'sai mật khẩu → báo lỗi tại form');
  await login(page, 'u_mn', 'u');
  ok(/Thành Viên MN Giả/.test(await text(page, '#userPill')), 'đăng nhập User → hiện tên + vai trò');
  ok(/Chưa có dữ liệu/.test(await text(page, '#view')), 'DB trống → hướng dẫn bắt đầu');
  ok(await page.evaluate(() => { try { return Object.keys(localStorage).every(k => /^(cn360_auth_v1|cn360_theme|cn360_dnKey|shtd_auth_v1)$/.test(k)); } catch (e) { return false; } }), 'localStorage chỉ có phiên/tùy chọn — không lưu dữ liệu KH (A4)');

  console.log('— Nạp dữ liệu (User → gửi duyệt)');
  await go(page, '#/nap');
  await page.type('#npCif', '900001'); await page.type('#npCn', 'HCM'); await page.type('#npTen', 'KHHH GIẢ LẬP MỘT');
  await (await page.$('#npFiles')).uploadFile(XL);
  await page.click('#npRead');
  await page.waitForFunction(() => window.__lastRead, { timeout: 60000 });
  ok(!(await page.evaluate(() => window.__lastRead.error)), 'đọc Excel 131 giả lập');
  await page.waitForSelector('.batch');
  const rv = await page.evaluate(() => { const N = CN.views.nap._state; return { tk: N.batches[0].tk, ky: N.batches[0].ky, n: N.batches[0].rows.length, ok: N.batches[0].rows.filter(r => r.bal === 'ok').length }; });
  ok(rv.tk === '131' && rv.ky === '2025-12-31' && rv.n === 4 && rv.ok === 4, `② nhận TK 131 · kỳ 31/12/2025 · 4/4 dòng cân đối (${JSON.stringify(rv)})`);
  await shot(page, '01_nap_duyet');
  await page.click('#npToMap'); await page.waitForSelector('table.map');
  const kinds = await page.evaluate(() => CN.views.nap._state.assign.map(a => a.kind));
  ok(kinds[0] === 'moi' && kinds[2] === 'goi-y' && kinds[3] === 'ca-nhan', '③ đối tác mới · gợi ý gộp ("Haii") · cá nhân (' + kinds.join(',') + ')');
  await page.click('tr[data-i="2"] input[type=radio]:not([value=new])'); await page.waitForSelector('table.map');
  ok(await page.evaluate(() => { const a = CN.views.nap._state.assign; return a[2].choice === a[1].id; }), 'chọn gộp "Haii" vào "Giả Lập Hai"');
  await page.$eval('tr[data-i="0"] input[data-f=mst]', e => { e.value = '0101234567'; e.dispatchEvent(new Event('change')); });
  await page.click('tr[data-i="0"] [data-act=vqr]');
  await page.waitForFunction(() => CN.views.nap._state.assign[0].tenNote, { timeout: 10000 });
  ok(/Tên đã cập nhật theo dữ liệu VietQR/.test(await text(page, 'tr[data-i="0"] .tnote')), 'Kiểm MST (VietQR giả) → cập nhật tên + cảnh báo inline');
  ok(await page.$('tr[data-i="3"] [data-act=vqr]') === null, 'cá nhân: không có nút tra MST');
  await shot(page, '02_nap_doitac');
  await page.click('#npToSave'); await page.waitForSelector('#npSave');
  ok(/Gửi teamlead duyệt/.test(await text(page, '#npSave')), '④ User: nút "Gửi teamlead duyệt"');
  await page.click('#npSave');
  await page.waitForFunction(() => window.__lastSubmit, { timeout: 30000 }); await idle(page);
  const sub = await page.evaluate(() => window.__lastSubmit);
  ok(sub.lots[0].status === 'Chờ duyệt' && sub.newPartners.length === 3, 'gửi → lô Chờ duyệt, 3 đối tác mới (gộp "Haii", cá nhân riêng)');
  ok(env.db().table('TenGop').some(t => t['Tên gốc'] === 'Cty CP Vat tu Gia Lap Haii' && t['Trạng thái'] === 'Chờ duyệt'), 'tên gộp tay chờ duyệt cùng lô');
  ok(env.db().table('DoiTac').find(d => d['MST'] === '0101234567')['Tên pháp lý'] === vqrName, 'tên theo VietQR lưu vào danh mục');
  await page.waitForFunction(() => location.hash.startsWith('#/duyet'));
  ok(/Chờ duyệt/.test(await text(page, '#view')), 'chuyển sang Lô & duyệt — thấy lô mình chờ duyệt');

  console.log('— User team khác không thấy lô chờ');
  const pMB = await newPage(env); await login(pMB, 'u_mb', 'u');
  ok(await pMB.evaluate(() => CN.store.S.data.lots.length === 0 && CN.store.S.data.doiTac.length === 0), 'User MB: không thấy lô + đối tác chờ duyệt của MN');

  console.log('— Teamlead duyệt');
  const pTL = await newPage(env); await login(pTL, 'tl_mn', 't');
  ok(/1/.test(await pTL.$eval('.nav-badge', e => e.textContent)), 'badge "Lô & duyệt" = 1 mục chờ');
  await go(pTL, '#/duyet');
  await pTL.click('#dyLots [data-a=ok]');
  await pTL.waitForSelector('#modal.on');
  ok(/4\/4 dòng/.test(await text(pTL, '#modal')), 'xem lô trước khi duyệt: số dòng + cân đối');
  await shot(pTL, '03_duyet_modal');
  await modalYes(pTL);
  await pTL.waitForFunction(() => CN.store.S.data.lots.every(l => l.status === 'Đã duyệt'));
  ok(env.db().table('Lo')[0]['Trạng thái'] === 'Đã duyệt' && env.db().table('DoiTac').every(d => d['Trạng thái'] === 'Hoạt động'), 'duyệt → lô + đối tác hoạt động');

  console.log('— Teamlead nạp thẳng KHHH 2 (331, đối tác chung)');
  await go(pTL, '#/nap');
  await pTL.type('#npCif', '900002'); await pTL.type('#npCn', 'HN'); await pTL.type('#npTen', 'KHHH GIẢ LẬP HAI');
  await (await pTL.$('#npFiles')).uploadFile(XL2);
  await pTL.click('#npRead'); await pTL.waitForSelector('.batch');
  await pTL.click('#npToMap'); await pTL.waitForSelector('table.map');
  const k2 = await pTL.evaluate(() => CN.views.nap._state.assign.map(a => a.kind));
  ok(k2[0] === 'trung-ten', 'đối tác "CÔNG TY TNHH XÂY DỰNG GIẢ LẬP MỘT" nhận ra là đối tác đã có (' + k2.join(',') + ')');
  await pTL.click('#npToSave'); await pTL.waitForSelector('#npSave');
  ok(/Lưu vào kho/.test(await text(pTL, '#npSave')), '④ Teamlead: nút "Lưu vào kho"');
  await pTL.click('#npSave'); await pTL.waitForFunction(() => window.__lastSubmit && location.hash.startsWith('#/khach-hang/'), { timeout: 30000 }); await idle(pTL);
  ok((await pTL.evaluate(() => window.__lastSubmit.lots[0].status)) === 'Đã duyệt', 'Teamlead lưu → Đã duyệt ngay');
  ok(/Mạng lưới đối tác/.test(await text(pTL, '#view')) && /Thép Giả Ba/.test(await text(pTL, '#view')), 'mở Customer 360 của KHHH vừa nạp');
  await shot(pTL, '04_customer360');

  console.log('— Dashboard');
  await go(pTL, '#/tong-quan');
  const st = await pTL.evaluate(() => CN.store.S.M.stats);
  ok(st.khhh === 2 && st.doiTac === 3 && st.shared === 1, `Tổng quan: 2 KHHH · 3 đối tác DN (cá nhân loại, "Haii" đã gộp) · 1 đối tác chung (${JSON.stringify(st)})`);
  await shot(pTL, '05_tong_quan');
  await go(pTL, '#/doi-tac');
  ok(/Giả Lập Hai/.test(await text(pTL, '#view')) && /GIẢ LẬP MỘT/i.test(await text(pTL, '#view')), 'danh sách đối tác');
  const dt1 = await pTL.evaluate(() => CN.store.S.data.doiTac.find(d => d.mst === '0101234567').id);
  await go(pTL, '#/doi-tac/' + dt1);
  ok(/Lây lan/.test(await text(pTL, '#view')) && /KHHH GIẢ LẬP HAI/.test(await text(pTL, '#dtCont')), 'chi tiết đối tác: lây lan liệt kê 2 KHHH (2 team)');
  await shot(pTL, '06_doi_tac');
  await go(pTL, '#/co-hoi');
  ok(await pTL.evaluate(() => CN.store.S.M.opps.length) >= 3, 'cơ hội bán chéo có dữ liệu');
  await shot(pTL, '07_co_hoi');
  await go(pTL, '#/rui-ro');
  ok(/Tập trung người mua/.test(await text(pTL, '#view')), 'rủi ro: có cảnh báo tập trung người mua');
  await shot(pTL, '08_rui_ro');

  console.log('— Sửa danh mục: User → yêu cầu; Teamlead duyệt');
  await pMB.reload({ waitUntil: 'load' }); await waitReady(pMB);
  ok(await pMB.evaluate(() => CN.store.S.data.lots.length === 2), 'User MB thấy dữ liệu đã duyệt của mọi team (D09)');
  const dtHai = await pMB.evaluate(() => CN.store.S.data.doiTac.find(d => /Hai/.test(d.ten)).id);
  await go(pMB, '#/doi-tac/' + dtHai);
  await pMB.click('#dtEdit'); await pMB.waitForSelector('#modal.on');
  await pMB.$eval('#modal [data-k=mst]', e => { e.value = '0309999999'; });
  await modalYes(pMB);
  await pMB.waitForFunction(() => CN.store.S.data.yeuCau.length === 1, { timeout: 15000 });
  ok(env.db().table('YeuCau')[0]['Trạng thái'] === 'Chờ duyệt' && env.db().table('DoiTac').find(d => d['Counterparty_ID'] === dtHai)['MST'] === '', 'User sửa MST → yêu cầu, danh mục chưa đổi');

  console.log('— Xuất Excel + nhật ký');
  await pTL.evaluate(() => { window.__NO_DOWNLOAD = true; });
  await go(pTL, '#/danh-muc'); await pTL.click('.tab[data-t=xuat]'); await pTL.click('#xAll');
  await pTL.waitForFunction(() => window.__lastWb, { timeout: 30000 }); await idle(pTL);
  const xw = XLSX.read(Buffer.from(await pTL.evaluate(() => window.__lastWb), 'base64'));
  ok(['CongNo', 'DoiTac', 'TenGop', 'KHHH', '08_Relationship_Edge', '09_Opportunity', '11_Risk_Alert'].every(s => xw.SheetNames.includes(s)), 'Excel xuất đủ sheet: ' + xw.SheetNames.join(','));
  ok(XLSX.utils.sheet_to_json(xw.Sheets.CongNo).length === 6, 'Teamlead xuất toàn bộ: 6 dòng công nợ (cá nhân vẫn có ở CongNo)');
  ok(env.db().table('NhatKy').some(r => r['Hành động'] === 'Xuất Excel' && r['Người'] === 'tl_mn'), 'xuất Excel được ghi nhật ký');
  await pMB.evaluate(() => { window.__NO_DOWNLOAD = true; window.__lastWb = null; });
  await pMB.evaluate(() => CN.xlsx.exportAll()); await pMB.waitForFunction(() => window.__lastWb, { timeout: 30000 });
  const xm = XLSX.read(Buffer.from(await pMB.evaluate(() => window.__lastWb), 'base64'));
  ok(XLSX.utils.sheet_to_json(xm.Sheets.CongNo).length === 0, 'User xuất: chỉ KHHH mình nạp (MB chưa nạp → 0 dòng)');

  console.log('— SSO từ phiên SHTD');
  const pSSO = await newPage(env);
  await pSSO.goto(BASE + 'index.html', { waitUntil: 'load' });
  const tok = env.ctx.makeToken_('u_mb', 'Thành Viên MB Giả', 'User', 'PTKD MB');
  await pSSO.evaluate(t => { localStorage.clear(); localStorage.setItem('shtd_auth_v1', JSON.stringify({ token: t, user: { username: 'u_mb' }, exp: Date.now() + 3600e3 })); }, tok);
  await pSSO.reload({ waitUntil: 'load' }); await waitReady(pSSO);
  ok(/Thành Viên MB Giả/.test(await text(pSSO, '#userPill')), 'đang có phiên SHTD → vào thẳng, không cần đăng nhập lại');

  console.log('— Admin: nhập kho v0.1 vào DB trống');
  const env2 = makeEnv({ users: USERS, props: { AUTH_SECRET: 'e2e-secret' } }); env2.ctx.setupAll();
  const kw = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(kw, XLSX.utils.aoa_to_sheet([['Kỳ', 'Kỳ gốc', 'CN', 'CIF', 'Tên KHHH', 'TK', 'Mã ĐT nội bộ', 'Tên đối tác gốc', 'Counterparty_ID', 'Dư Nợ đầu kỳ', 'Dư Có đầu kỳ', 'Phát sinh Nợ', 'Phát sinh Có', 'Dư Nợ cuối kỳ', 'Dư Có cuối kỳ', 'Cân đối', 'Nguồn tệp', 'Trang', 'Ngày nạp', 'Ghi chú'],
    [new Date('2025-12-31T00:00:00'), '2025', 'HCM', '800001', 'KHHH Giả Tám', '131', '', 'Cty Bảy Giả', 'DT00007', 0, 0, 5e9, 1e9, 4e9, 0, 'Cân', 'a.pdf', 1, new Date(), '']], { cellDates: true }), 'CongNo');
  XLSX.utils.book_append_sheet(kw, XLSX.utils.aoa_to_sheet([['Counterparty_ID', 'MST', 'Tên pháp lý', 'Tên rút gọn', 'Cá nhân', 'Trạng thái MST', 'Nguồn MST', 'Đã là KHHH', 'CIF (nếu là KH TP)', 'Ghi chú'], ['DT00007', '0100000007', 'Công ty Bảy Giả', '', '', '', '', '', '', '']]), 'DoiTac');
  XLSX.utils.book_append_sheet(kw, XLSX.utils.aoa_to_sheet([['Tên gốc', 'Counterparty_ID', 'Trạng thái', 'Ngày'], ['Cty Bảy Giả', 'DT00007', 'Máy gộp', '']]), 'TenGop');
  XLSX.utils.book_append_sheet(kw, XLSX.utils.aoa_to_sheet([['CIF', 'MST', 'Tên khách hàng'], ['800001', '', 'KHHH Giả Tám']]), 'KHHH');
  const KHO = path.join(TMP, 'Kho_DoiTac_131_331_gia.xlsx'); XLSX.writeFile(kw, KHO);
  const pAd = await newPage(env2); await login(pAd, 'admin1', 'a');
  await go(pAd, '#/danh-muc'); await pAd.click('.tab[data-t=kho]');
  await (await pAd.$('#khoFile')).uploadFile(KHO);
  await pAd.waitForFunction(() => !document.getElementById('khoUp').disabled, { timeout: 15000 });
  await pAd.click('#khoUp'); await modalYes(pAd);
  await pAd.waitForFunction(() => CN.store.S.data.lots.length === 1, { timeout: 20000 });
  ok(env2.db().table('DoiTac')[0]['Counterparty_ID'] === 'DT00007' && env2.db().table('Lo')[0]['Kỳ'] === '2025-12-31', 'nhập kho v0.1: giữ mã DT00007, kỳ 31/12/2025, lô Đã duyệt');
  await pAd.click('.tab[data-t=nk]'); await pAd.waitForFunction(() => /Nhập kho v0.1/.test(document.getElementById('nkList').innerText), { timeout: 15000 });
  ok(true, 'Admin xem nhật ký truy cập');
  await shot(pAd, '09_danh_muc_nhat_ky');

  console.log('— Bộ đọc OCR tự host (pdf.js + tesseract + mô hình vie) chạy trong trang');
  const ocr = await pAd.evaluate(async () => {
    await CNLoad.ensureOcr(() => {}); initPdfJs();
    const s = await initTesseract(1, () => {});
    const c = document.createElement('canvas'); c.width = 600; c.height = 120; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 120); x.fillStyle = '#000'; x.font = '48px Arial'; x.fillText('Công nợ 12.345', 20, 80);
    const r = await s.addJob('recognize', c); return r.data.text;
  });
  ok(/12[.,]?345/.test(ocr) && /n[ợo]/i.test(ocr), 'OCR offline đọc được chữ Việt + số: ' + JSON.stringify(ocr.trim()));

  console.log('— MST nội bộ: Admin tải chỉ mục lên → tra thử → bước ③ tự điền MST + CIF → Đối tác');
  const env3 = makeEnv({ users: USERS, props: { AUTH_SECRET: 'e2e-secret' } }); env3.ctx.setupAll();
  {
    // Chỉ mục GIẢ: 3.000 tên độn + đối tác của tệp 131 giả lập (1 tên trùng 2 MST → không tự điền)
    const W = ['AN', 'BINH', 'PHAT', 'THANH', 'HUNG', 'MINH', 'LONG', 'PHUC', 'TAN', 'VIET'], L = ['THƯƠNG MẠI', 'XÂY DỰNG', 'SẢN XUẤT', 'VẬN TẢI'];
    const lines = ['# MST\tTên'];
    for (let i = 0; i < 3000; i++) lines.push(`${2000000000 + i}\tCÔNG TY TNHH ${L[i % 4]} ${W[i % 10]} ${W[(i * 7) % 10]} ${W[(i * 3) % 10]} ${i}`);
    lines.push('0101234567\tCÔNG TY TNHH XÂY DỰNG GIẢ LẬP MỘT', '0102222221\tCÔNG TY CỔ PHẦN VẬT TƯ GIẢ LẬP HAI', '0102222222\tCÔNG TY CỔ PHẦN VẬT TƯ GIẢ LẬP HAI', '0109990002\tCÔNG TY CỔ PHẦN KHÁCH HÀNG MẪU BẢY');
    const nameGz = zlib.gzipSync(Buffer.from(lines.join('\n') + '\n')), cifGz = zlib.gzipSync(Buffer.from('# MST\tCIF\tBRN\tSEG\n0101234567\t77700001\t101\t110000\n0109990002\t77700002\t002\t110000\n# K\tCIF\tMST\tBRN\tSEG\tTên\n'
      + 'K\t77700001\t0101234567\t001\t110000\tCÔNG TY TNHH XÂY DỰNG GIẢ LẬP MỘT\nK\t77700002\t0109990002\t002\t110000\tCÔNG TY CỔ PHẦN KHÁCH HÀNG MẪU BẢY\n'));
    const sha = b => crypto.createHash('sha256').update(b).digest('hex');
    const man = { version: '20261015-1800', builtAt: '2026-10-15T18:00:00', source: 'gia_lap.xlsx', counts: { names: lines.length - 1, cif: 1 },
      files: { name: { file: 'name_index.tsv.gz', bytes: nameGz.length, sha256: sha(nameGz) }, cif: { file: 'cif_map.tsv.gz', bytes: cifGz.length, sha256: sha(cifGz) } },
      dvkd: { '001': '001-HKM-Hoàn Kiếm' } };
    const D = path.join(TMP, 'mst_build'); fs.mkdirSync(D);
    fs.writeFileSync(path.join(D, 'manifest.json'), JSON.stringify(man)); fs.writeFileSync(path.join(D, 'name_index.tsv.gz'), nameGz); fs.writeFileSync(path.join(D, 'cif_map.tsv.gz'), cifGz);
    const pM = await newPage(env3); await login(pM, 'admin1', 'a');
    await go(pM, '#/danh-muc'); await pM.click('.tab[data-t=mst]');
    await pM.waitForFunction(() => /Chưa có chỉ mục/.test(document.getElementById('mstMeta').innerText), { timeout: 15000 });
    ok(true, 'Danh mục → MST nội bộ: báo chưa có chỉ mục');
    await (await pM.$('#mstFiles')).uploadFile(...['manifest.json', 'name_index.tsv.gz', 'cif_map.tsv.gz'].map(f => path.join(D, f)));
    await pM.waitForFunction(() => !document.getElementById('mstUp').disabled, { timeout: 15000 });
    await pM.click('#mstUp'); await modalYes(pM);
    await pM.waitForFunction(() => /Đã tải lên bản/.test(document.getElementById('mstUpSt').innerText), { timeout: 30000 });
    ok(env3.ctx.mstManifest_().version === '20261015-1800', 'Admin chọn 3 tệp build → tải lên GAS (kiểm sha256 phía trình duyệt + từng mảnh phía server)');
    await pM.type('#mstQ', 'Cty TNHH Xay dung Gia Lap Mot'); await pM.click('#mstGo');
    await pM.waitForSelector('#mstTbl', { timeout: 60000 });
    const t1 = await text(pM, '#mstTbl tbody tr');
    ok(/0101234567/.test(t1) && /CIF 77700001/.test(t1), 'tra thử (viết tắt, không dấu) → ứng viên 1 đúng MST + chip CIF (CIF tra ở server)');
    ok(await pM.evaluate(async () => (await indexedDB.databases()).some(d => d.name === 'cn360_mst')), 'chỉ mục tên→MST lưu IndexedDB của máy này (ngoại lệ A4 có chủ đích)');
    await shot(pM, '10_mst_noi_bo');

    await go(pM, '#/nap');
    await pM.type('#npKhQ', 'cty cp khach hang mau bay'); await pM.click('#npKhGo');
    await pM.waitForSelector('#npKhTbl button', { timeout: 30000 }); await pM.click('#npKhTbl button');
    const f1 = await pM.evaluate(() => ['npCif', 'npTen', 'npMst', 'npCn'].map(id => document.getElementById(id).value));
    ok(f1.join('|') === '77700002|CÔNG TY CỔ PHẦN KHÁCH HÀNG MẪU BẢY|0109990002|002 (ngoài BLOCK 2026)', '① tìm KH theo tên (viết tắt, không dấu — tra trên máy) → Chọn → điền CIF · tên có dấu · MST · CN');
    await go(pM, '#/danh-muc'); await go(pM, '#/nap');
    await pM.type('#npCif', '77700001'); await (await pM.$('#npFiles')).uploadFile(XL); await pM.click('#npRead'); await pM.waitForSelector('.batch', { timeout: 60000 });
    const f2 = await pM.evaluate(() => CN.views.nap._state.batches[0]);
    ok(f2.tenKH === 'CÔNG TY TNHH XÂY DỰNG GIẢ LẬP MỘT' && f2.mstKH === '0101234567' && f2.cn === '001-HKM-Hoàn Kiếm', '① chỉ gõ CIF → bấm Đọc tệp tự tra nốt tên · MST · CN "001-HKM-Hoàn Kiếm"');
    await pM.evaluate(() => Object.assign(CN.views.nap._state, { batches: [], assign: null, step: 1, meta: { cn: '', cif: '', tenKH: '', mstKH: '' } })); await go(pM, '#/danh-muc'); await go(pM, '#/nap');
    await pM.type('#npCif', '900009'); await pM.type('#npCn', 'HCM'); await pM.type('#npTen', 'KHHH GIẢ LẬP CHÍN');
    await (await pM.$('#npFiles')).uploadFile(XL);
    await pM.click('#npRead'); await pM.waitForSelector('.batch');
    await pM.click('#npToMap'); await pM.waitForSelector('table.map');
    await pM.waitForFunction(() => CN.views.nap._state.intRes, { timeout: 60000 });
    const A = await pM.evaluate(() => CN.views.nap._state.assign.map(a => ({ raw: a.raw, mst: a.mst, auto: !!a.intAuto, cif: a.cif && a.cif.cif, cands: (a.mstCands || []).length, kind: a.kind, src: a.nguonMst })));
    ok(A[0].mst === '0101234567' && A[0].auto && A[0].cif === '77700001' && /^Nội bộ TPBank/.test(A[0].src), '③ tự tra nội bộ: "Công ty TNHH Xây dựng Giả Lập Một" → tự điền MST + CIF, nguồn "Nội bộ TPBank"');
    ok(!A[1].mst && A[1].cands === 2, '③ tên trùng 2 MST → KHÔNG tự điền, hiện 2 ứng viên để chọn');
    ok(!A[3].mst && A[3].kind === 'ca-nhan', '③ cá nhân → không tra');
    ok(/tự điền 1/.test(await text(pM, '#npInt')) && /KH TPBank \(CIF\)/.test(await text(pM, '#npInt')), 'dòng trạng thái: số tự điền + số đối tác là KH TPBank');
    ok(/KH TPBank · CIF 77700001/.test(await text(pM, 'tr[data-i="0"]')), 'chip "KH TPBank · CIF" trên dòng đối tác');
    await shot(pM, '11_nap_mst_noi_bo');
    await pM.waitForFunction(() => !document.querySelector('.toast'), { timeout: 15000 });   // toast "Đã đọc…" che nút
    await pM.click('#npToSave'); await pM.waitForSelector('#npSave');
    await pM.click('#npSave'); await pM.waitForFunction(() => window.__lastSubmit && location.hash.startsWith('#/khach-hang/'), { timeout: 30000 }); await idle(pM);
    const d1 = env3.db().table('DoiTac').find(d => d['MST'] === '0101234567');
    ok(d1 && d1['CIF (nếu là KH TP)'] === '77700001' && /^Nội bộ TPBank/.test(d1['Nguồn MST']), 'lưu → server tự điền CIF vào danh mục đối tác');
    ok(await pM.evaluate(id => !!CN.store.S.M.daLaKH.get(id), d1['Counterparty_ID']), 'mô hình: đối tác có CIF nội bộ = "Đã là KH TPBank" (loại khỏi Cơ hội)');

    // Màn chi tiết KHHH (CIF 900009 không có trong TPB) → Chuẩn hóa → nhập MST → bảng đối chiếu → áp CIF + tên
    await pM.waitForSelector('#khStd'); await pM.click('#khStd');
    await pM.waitForFunction(() => /Không khớp dữ liệu TPB/.test((document.querySelector('#modal.on') || {}).innerText || ''), { timeout: 30000 });
    await pM.type('#modal [data-k=mst]', '0109990002'); await modalYes(pM);
    await pM.waitForFunction(() => /Chuẩn hóa KHHH theo dữ liệu TPB/.test((document.querySelector('#modal.on') || {}).innerText || ''), { timeout: 30000 });
    const std = await text(pM, '#modal');
    ok(/77700002/.test(std) && /002 \(ngoài BLOCK 2026\)/.test(std) && /Tên trên hệ thống TPB/.test(std) && /Tỉnh trước sáp nhập/.test(std), 'Chuẩn hóa (chi tiết): bảng Hiện tại → Dữ liệu TPB + tên hệ thống/900k · chi nhánh · PTKD · loại ĐVKD · tỉnh');
    await modalYes(pM); await pM.waitForFunction(() => location.hash === '#/khach-hang/77700002', { timeout: 30000 }); await idle(pM);
    ok(env3.db().table('KHHH').some(k => k['CIF'] === '77700002' && k['Tên khách hàng'] === 'CÔNG TY CỔ PHẦN KHÁCH HÀNG MẪU BẢY') && env3.db().table('Lo').every(l => l['CIF'] !== '900009'),
      'áp → KHHH đổi CIF 900009 → 77700002 + tên chuẩn, lô đổi theo, mở lại đúng KHHH');

    const hai = env3.db().table('DoiTac').find(d => /VẬT TƯ GIẢ LẬP HAI|Vật tư Giả Lập Hai/i.test(d['Tên pháp lý']) && !d['MST']);
    await go(pM, '#/doi-tac/' + hai['Counterparty_ID']);
    await pM.click('#dtInt'); await pM.waitForSelector('#modal.on [data-k=mst]', { timeout: 30000 });
    ok((await pM.$$eval('#modal option', o => o.length)) === 2, 'Đối tác chưa có MST → "Tìm MST (nội bộ)" → 2 ứng viên');
    await pM.select('#modal [data-k=mst]', '0102222222'); await modalYes(pM);
    await pM.waitForFunction(() => /0102222222/.test(document.getElementById('pageSub').innerText), { timeout: 20000 });
    ok(env3.db().table('DoiTac').find(d => d['Counterparty_ID'] === hai['Counterparty_ID'])['MST'] === '0102222222', 'chọn ứng viên → gán MST (Admin sửa thẳng)');
    ok(env3.db().table('NhatKy').some(r => r['Hành động'] === 'Tra MST nội bộ') && env3.db().table('NhatKy').some(r => r['Hành động'] === 'Tra CIF nội bộ'), 'nhật ký: tra MST nội bộ (số lượng) + tra CIF');
    await pM.click('#btnLogout'); await new Promise(r => setTimeout(r, 400));
    ok(await pM.evaluate(async () => !(await indexedDB.databases()).some(d => d.name === 'cn360_mst')), 'đăng xuất → xóa chỉ mục khỏi máy');
  }

  ok(ext.length === 0, 'không có request nào ra ngoài GAS/VietQR (giả lập)' + (ext.length ? ': ' + [...new Set(ext)].slice(0, 5).join(' | ') : ''));
  ok(csp.length === 0, 'không vi phạm CSP' + (csp.length ? ': ' + csp.slice(0, 3).join(' | ') : ''));
  ok(errs.length === 0, 'không lỗi JS' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
} catch (e) { fail++; console.error('  ✗ LỖI', e.message, errs.length ? '\n    lỗi JS trang: ' + errs.slice(0, 5).join(' | ') : ''); }
finally { await browser.close(); fs.rmSync(TMP, { recursive: true, force: true }); }
console.log(`E2E: ${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
