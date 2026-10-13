/* model.js — Mô hình Ecosystem 360 tính bằng code (thay công thức sheet 08–11 của CB_Ecosystem_360_TEMPLATE).
 * Thuần JS, chạy được trình duyệt + Node (test/model.test.mjs). Chỉ dùng lô "Đã duyệt".
 * Công thức port nguyên từ template (13_Lists = Config); BL (07) chưa có dữ liệu → các cột BL = 0 (đợt 2).
 * Khác template có chủ đích:
 *  - Dư cuối kỳ = số dư của LÔ MỚI NHẤT (≤ ngày báo cáo) theo KHHH + TK (template lọc đúng tháng báo cáo — lệch khi KH báo cáo theo năm/quý).
 *  - 09 cột "BL còn hiệu lực/benchmark" dùng Benchmark BL (B8); template ghi nhầm B12 (ngày bắt đầu theo dõi).
 *  - Mã cầu nối = đối tác đang xét (template ghi cứng "DT001"). */
(function (G) {
  'use strict';
  const KEY = s => (G.MAP131 ? G.MAP131.key(s) : String(s || '').toUpperCase());
  const n = v => (Number.isFinite(+v) ? +v : 0);
  const ROLE_BUY = 'Người mua/Chủ đầu tư', ROLE_SUP = 'Nhà cung cấp/Nhà thầu phụ';

  function cfgOf(c) {
    c = c || {};
    const g = (k, d) => (c[k] === '' || c[k] === undefined || c[k] === null ? d : c[k]);
    return {
      ngayBaoCao: String(g('Ngày báo cáo', '')).slice(0, 10), batDau: String(g('Ngày bắt đầu theo dõi', '2025-07-01')).slice(0, 10),
      tapTrungCao: +g('Ngưỡng tập trung cao', 0.4), tapTrungTheoDoi: +g('Ngưỡng tập trung theo dõi', 0.3), suyGiam: +g('Ngưỡng suy giảm', -0.3),
      bmQuanHe: +g('Benchmark quy mô quan hệ', 5e10), bmBL: +g('Benchmark BL còn hiệu lực', 2e10), p1: +g('Ngưỡng Opportunity P1', 75), p2: +g('Ngưỡng Opportunity P2', 55),
      bmCoHoi: +g('Benchmark quy mô cơ hội', 8e11),
    };
  }
  const ymd = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const monthStart = (s, add) => { const p = ymd(s); if (!p) return ''; const t = new Date(Date.UTC(p.y, p.m - 1 + (add || 0), 1)); return t.toISOString().slice(0, 10); };
  /** DATEDIF(a, b, "m") — số tháng tròn. */
  function datedifM(a, b) {
    const A = ymd(a), B = ymd(b); if (!A || !B) return 0;
    let m = (B.y - A.y) * 12 + (B.m - A.m); if (B.d < A.d) m--; return Math.max(0, m);
  }
  /** Hạng giảm dần, hòa → thứ tự xuất hiện (như SUMPRODUCT template). */
  function rankBy(list, val, groupOf, filter) {
    const groups = new Map();
    list.forEach((x, i) => { if (filter && !filter(x)) return; const g = groupOf ? groupOf(x) : '_'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push({ x, i, v: val(x) }); });
    const out = new Map();
    groups.forEach(arr => arr.slice().sort((a, b) => b.v - a.v || a.i - b.i).forEach((o, k) => out.set(o.x, k + 1)));
    return out;
  }

  function compute(data) {
    const C = cfgOf(data.config);
    const lots = (data.lots || []).filter(l => l.status === 'Đã duyệt');
    const lotById = new Map(lots.map(l => [l.id, l]));
    const dts = new Map((data.doiTac || []).map(d => [d.id, d]));
    const khs = new Map((data.khhh || []).map(k => [k.cif, k]));
    const maxKy = lots.reduce((m, l) => (l.ky > m ? l.ky : m), '');
    const report = C.ngayBaoCao || maxKy || new Date().toISOString().slice(0, 10);
    const months = datedifM(C.batDau, report) + 1;

    // Đã là KH TPBank: MST hoặc tên chuẩn hóa trùng KHHH / danh mục KH tại TPBank
    const known = [...(data.khhh || []).map(k => ({ cif: k.cif, mst: k.mst, ten: k.ten, nguon: 'KHHH' })), ...(data.khTP || []).map(k => ({ cif: k.cif, mst: k.mst, ten: k.ten, nguon: 'KH TPBank' }))];
    const byMst = new Map(known.filter(k => k.mst).map(k => [String(k.mst).trim(), k])), byKey = new Map(known.filter(k => k.ten).map(k => [KEY(k.ten), k]));
    const daLaKH = new Map();
    dts.forEach(d => { const m = (d.mst && byMst.get(String(d.mst).trim())) || byKey.get(KEY(d.ten)); daLaKH.set(d.id, m || null); });

    // Lô mới nhất (≤ ngày báo cáo) theo KHHH + TK → số dư cuối kỳ
    const latest = new Map();
    lots.forEach(l => { if (l.ky > report) return; const k = l.cif + '|' + l.tk; const cur = latest.get(k); if (!cur || l.ky > cur.ky) latest.set(k, l); });
    const latestIds = new Set([...latest.values()].map(l => l.id));
    const w3a = monthStart(report, -2), w3b = monthStart(report, -5);

    const E = new Map();
    (data.congNo || []).forEach(r => {
      const l = lotById.get(r.lot); if (!l) return;
      const d = dts.get(r.id); if (!d || d.caNhan) return;   // cá nhân: không lên mô hình quan hệ/cơ hội (R7)
      const k = l.cif + '|' + r.id;
      if (!E.has(k)) {
        const kh = khs.get(l.cif) || {};
        E.set(k, { cif: l.cif, tenKH: kh.ten || l.tenKH, team: kh.team || l.team || '', dvkd: kh.dvkd || l.cn || '', rm: kh.rm || '', id: r.id, ten: d.ten, mst: d.mst || '', ttMst: d.ttMst || '',
          psThu: 0, thuHoi: 0, duThu: 0, psTra: 0, traTien: 0, duTra: 0, blHL: 0, blPH: 0, blStage: 0, ps3a: 0, ps3b: 0, periods: new Map() });
      }
      const e = E.get(k), v = r.vals.map(n), p = e.periods.get(l.ky) || { ky: l.ky, psThu: 0, psTra: 0, duThu: 0, duTra: 0 };
      if (l.tk === '131') {
        e.psThu += v[2]; e.thuHoi += v[3]; p.psThu += v[2]; p.duThu += v[4];
        if (latestIds.has(l.id)) e.duThu += v[4];
        if (l.ky >= w3a && l.ky <= report) e.ps3a += v[2]; else if (l.ky >= w3b && l.ky < w3a) e.ps3b += v[2];
      } else {
        e.psTra += v[3]; e.traTien += v[2]; p.psTra += v[3]; p.duTra += v[5];
        if (latestIds.has(l.id)) e.duTra += v[5];
      }
      e.periods.set(l.ky, p);
    });
    const edges = [...E.values()].sort((a, b) => (a.cif < b.cif ? -1 : a.cif > b.cif ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const sumBy = (f, g) => { const m = new Map(); edges.forEach(e => m.set(g(e), (m.get(g(e)) || 0) + f(e))); return m; };
    const sThu = sumBy(e => e.psThu, e => e.cif), sTra = sumBy(e => e.psTra, e => e.cif), sBL = sumBy(e => e.blHL, e => e.cif);
    edges.forEach(e => {
      e.periods = [...e.periods.values()].sort((a, b) => (a.ky < b.ky ? -1 : 1));
      e.daLaKH = !!daLaKH.get(e.id);
      e.role = e.psThu > 0 ? ROLE_BUY : ROLE_SUP;
      e.evidence = e.psThu > 0 && e.psTra > 0 ? 'Phải thu + Phải trả' : e.psThu > 0 ? 'Phải thu' : 'Phải trả';
      e.tlThuHoi = e.psThu ? e.thuHoi / e.psThu : 0; e.tlTra = e.psTra ? e.traTien / e.psTra : 0;
      e.months = months;
      e.share = e.psThu > 0 ? e.psThu / sThu.get(e.cif) : e.psTra > 0 ? e.psTra / sTra.get(e.cif) : e.blHL > 0 ? e.blHL / sBL.get(e.cif) : 0;
      e.scale = e.psThu + e.psTra + e.blHL;
      e.evidenceScore = Math.min(100, (e.psThu > 0 ? 25 : 0) + (e.psTra > 0 ? 25 : 0));
      e.strength = Math.min(100, Math.min(25, e.scale / C.bmQuanHe * 25) + Math.min(15, e.months / 12 * 15) + Math.min(15, e.share / C.tapTrungCao * 15)
        + Math.min(15, e.blHL / C.bmBL * 15) + e.blStage + e.evidenceScore / 10);
      e.group = e.strength >= 80 ? 'Chiến lược/Rất mạnh' : e.strength >= 65 ? 'Quan hệ mạnh' : e.strength >= 50 ? 'Quan hệ thường xuyên' : 'Cần xác minh';
    });
    const rAll = rankBy(edges, e => e.scale, e => e.cif), rIn = rankBy(edges, e => e.psTra, e => e.cif, e => e.psTra > 0), rOut = rankBy(edges, e => e.psThu, e => e.cif, e => e.psThu > 0), rDt = rankBy(edges, e => e.scale, e => e.id);
    edges.forEach(e => { e.rankAll = rAll.get(e); e.rankIn = rIn.get(e) || null; e.rankOut = rOut.get(e) || null; e.rankByDt = rDt.get(e); });

    const byDt = new Map();
    edges.forEach(e => { if (!byDt.has(e.id)) byDt.set(e.id, []); byDt.get(e.id).push(e); });
    const byCif = new Map();
    edges.forEach(e => { if (!byCif.has(e.cif)) byCif.set(e.cif, []); byCif.get(e.cif).push(e); });

    // 09 — Cơ hội: đối tác CHƯA là KH TPBank
    const opps = [];
    byDt.forEach((es, id) => {
      if (daLaKH.get(id)) return;
      const d = dts.get(id), bridge = es.find(e => e.rankByDt === 1) || es[0];
      const H = es.reduce((s, e) => s + e.psThu, 0), I = es.reduce((s, e) => s + e.psTra, 0), J = es.reduce((s, e) => s + e.blHL, 0), K = es.reduce((s, e) => s + e.blPH, 0);
      const L = H + I + J, Q = es.reduce((s, e) => s + e.blStage, 0), R = bridge.months, Gn = es.length;
      const S = Math.min(100, Math.min(25, L / C.bmCoHoi * 25) + Math.min(15, Gn / 4 * 15) + Math.min(15, Q) + Math.min(10, R / 12 * 10) + Math.min(15, J / C.bmBL * 15) + 20);
      const T = S >= C.p1 ? 'P1 - Tiếp cận ngay' : S >= C.p2 ? 'P2 - Xác minh' : 'P3 - Theo dõi';
      opps.push({ id, ten: d.ten, mst: d.mst || '', ttMst: d.ttMst || '', nganh: d.nganh || '', role: es.some(e => e.psThu > 0) && es.some(e => e.psTra > 0) ? 'Đối tác hai chiều' : es.some(e => e.psThu > 0) ? 'Người mua' : 'Nhà cung cấp',
        nKH: Gn, psThu: H, psTra: I, blHL: J, blPH: K, scale: L, bridge: { cif: bridge.cif, tenKH: bridge.tenKH, dvkd: bridge.dvkd, rm: bridge.rm, team: bridge.team }, months: R, score: S, priority: T,
        action: T === 'P1 - Tiếp cận ngay' ? 'Nhờ RM cầu nối xác minh quan hệ và giới thiệu; chuẩn bị hồ sơ tiếp cận.' : T === 'P2 - Xác minh' ? 'Xác minh thêm quy mô/nhu cầu trước khi tiếp cận.' : 'Theo dõi, chưa ưu tiên.',
        toi: L * 0.004, teams: [...new Set(es.map(e => e.team).filter(Boolean))] });
    });
    const rO = rankBy(opps, o => o.score);
    opps.forEach(o => { o.rank = rO.get(o); });
    opps.sort((a, b) => a.rank - b.rank);

    // 10 — Mạng tham chiếu: mọi đối tác có liên kết
    const refs = [];
    byDt.forEach((es, id) => {
      const top = es.slice().sort((a, b) => a.rankByDt - b.rankByDt).slice(0, 3), t1 = top[0];
      const Hs = Math.min(100, Math.min(40, t1.scale / C.bmQuanHe * 40) + Math.min(20, t1.months / 12 * 20) + Math.min(20, es.length / 4 * 20) + 20);
      refs.push({ id, ten: dts.get(id).ten, nKH: es.length, top: top.map(e => ({ cif: e.cif, tenKH: e.tenKH, scale: e.scale, team: e.team })), score: Hs,
        level: Hs >= 80 ? 'Ưu tiên 1' : Hs >= 65 ? 'Phù hợp' : Hs >= 50 ? 'Tham khảo' : 'Cần xác minh', daLaKH: !!daLaKH.get(id) });
    });
    refs.sort((a, b) => b.score - a.score || b.nKH - a.nKH);

    // 11 — Cảnh báo rủi ro theo từng quan hệ
    const risks = edges.map(e => {
      const type = e.share < C.tapTrungTheoDoi ? '' : e.role === ROLE_BUY ? 'Tập trung người mua' : 'Tập trung nhà cung cấp';
      const level = type ? (e.share >= C.tapTrungCao ? 'Cao' : 'Trung bình') : '';
      const nShared = byDt.get(e.id).length, chain = nShared >= 2 ? 'Mắt xích chung hệ sinh thái (' + nShared + ' KH)' : '';
      const chg = e.ps3b ? (e.ps3a - e.ps3b) / e.ps3b : null, decline = chg !== null && chg <= C.suyGiam ? 'Suy giảm đầu ra' : '';
      const stop = e.ttMst && /ngừng|tạm|bỏ địa chỉ|giải thể|không hoạt động/i.test(e.ttMst) ? 'Đối tác ' + e.ttMst : '';
      const action = [type ? 'Xác minh mức độ phụ thuộc và kế hoạch đa dạng hóa ' + (e.role === ROLE_BUY ? 'đầu ra.' : 'đầu vào.') : '', chain ? 'Cân nhắc dùng đối tác này làm cầu nối mở rộng KH mới.' : '',
        decline ? 'Xác minh tiến độ hợp đồng/đơn hàng, khả năng mất khách hàng.' : '', stop ? 'Kiểm tra tình trạng pháp lý đối tác và khả năng thu hồi/thanh toán.' : ''].filter(Boolean).join(' ');
      const flag = !!(type || chain || decline || stop);
      return { e, cif: e.cif, tenKH: e.tenKH, team: e.team, id: e.id, ten: e.ten, role: e.role, evidence: e.evidence, share: e.share, scale: e.scale, type, level, nShared, chain,
        ps3a: e.ps3a, ps3b: e.ps3b, chg, decline, stop, action, flag, prio: ((level === 'Cao') * 2 + (level === 'Trung bình') * 1 + (stop ? 3 : 0)) * 1e12 + e.scale };
    });
    const rR = rankBy(risks, r => r.prio, null, r => r.flag);
    risks.forEach(r => { r.rank = rR.get(r) || null; });

    return { report, months, cfg: C, edges, byDt, byCif, opps, refs, risks: risks.filter(r => r.flag).sort((a, b) => a.rank - b.rank), allRisks: risks, daLaKH,
      stats: { khhh: byCif.size, doiTac: byDt.size, edges: edges.length, lots: lots.length, opps: opps.length, p1: opps.filter(o => o.priority[1] === '1').length, alerts: risks.filter(r => r.flag).length, shared: [...byDt.values()].filter(es => es.length >= 2).length } };
  }

  /** "Lây lan": KHHH bị ảnh hưởng khi 1 đối tác có vấn đề — tỷ trọng đối tác này trong 131/331 của từng KHHH. */
  function contagion(M, id) {
    return (M.byDt.get(id) || []).map(e => ({ cif: e.cif, tenKH: e.tenKH, team: e.team, role: e.role, share: e.share, duThu: e.duThu, duTra: e.duTra, scale: e.scale }))
      .sort((a, b) => b.share - a.share);
  }

  const API = { compute, contagion, datedifM, monthStart, cfgOf, ROLE_BUY, ROLE_SUP };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.CNModel = API;
})(typeof window !== 'undefined' ? window : globalThis);
