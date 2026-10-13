'use strict';
/* Tổng quan — số liệu toàn danh mục (dữ liệu đã duyệt) + việc cần làm. */
(function () {
  CN.views = CN.views || {};
  const { esc, money, kpi, chip, table, pct } = CN.ui;
  CN.views.overview = {
    render(host) {
      const S = CN.store.S, M = S.M, st = M.stats;
      const myPending = S.data.lots.filter(l => l.status === 'Chờ duyệt' && l.by.toLowerCase() === S.user.username.toLowerCase()).length;
      const totThu = M.edges.reduce((s, e) => s + e.psThu, 0), totTra = M.edges.reduce((s, e) => s + e.psTra, 0);
      $('pageSub').textContent = 'Ngày báo cáo ' + CN.ui.dt(M.report) + ' · tham số theo Danh mục';
      host.innerHTML = `
        ${!st.lots ? `<div class="alert info">Chưa có dữ liệu đã duyệt. Bắt đầu ở <a href="#/nap">Nạp dữ liệu</a>${CN.store.isAdmin() ? ' hoặc nhập kho Excel v0.1 ở <a href="#/danh-muc">Danh mục</a>' : ''}.</div>` : ''}
        ${S.pendingForMe ? `<div class="alert warn">Có <b>${S.pendingForMe}</b> mục chờ bạn duyệt → <a href="#/duyet">Lô &amp; duyệt</a></div>` : ''}
        ${myPending ? `<div class="alert info">Bạn có ${myPending} lô đang chờ teamlead duyệt.</div>` : ''}
        <div class="kpis">
          ${kpi('KHHH có dữ liệu', st.khhh, st.lots + ' lô đã duyệt', 'pri')}
          ${kpi('Đối tác (doanh nghiệp)', st.doiTac, st.shared + ' đối tác chung ≥ 2 KHHH')}
          ${kpi('PS phải thu (131)', money(totThu), 'đầu ra của KHHH')}
          ${kpi('PS phải trả (331)', money(totTra), 'đầu vào của KHHH')}
          ${kpi('Cơ hội bán chéo', st.opps, st.p1 + ' mục P1 - Tiếp cận ngay', 'accent')}
          ${kpi('Cảnh báo rủi ro', st.alerts, 'tập trung · mắt xích · suy giảm', st.alerts ? 'danger' : '')}
        </div>
        <div class="grid g2">
          <div class="card"><h2>★ Top cơ hội "vết dầu loang" <a class="btn sm ghost" href="#/co-hoi">Xem tất cả</a></h2><div id="ovOpp"></div></div>
          <div class="card"><h2>⛓ Đối tác chung nhiều KHHH nhất <a class="btn sm ghost" href="#/doi-tac">Xem tất cả</a></h2><div id="ovShared"></div></div>
        </div>
        <div class="card"><h2>⚠ Cảnh báo ưu tiên <a class="btn sm ghost" href="#/rui-ro">Xem tất cả</a></h2><div id="ovRisk"></div></div>`;
      table($('ovOpp'), M.opps.slice(0, 8), [
        { k: 'ten', t: 'Đối tác', f: o => `<a href="#/doi-tac/${esc(o.id)}">${esc(o.ten)}</a>` },
        { k: 'nKH', t: 'Số KHHH', num: true },
        { k: 'scale', t: 'Quy mô', num: true, f: o => money(o.scale) },
        { k: 'priority', t: 'Ưu tiên', f: o => chip(o.priority, o.priority[1] === '1' ? 'org' : o.priority[1] === '2' ? 'info' : 'gray') },
      ], { noSearch: true, pageSize: 8, empty: 'Chưa có cơ hội (mọi đối tác đã là KH TPBank hoặc chưa có dữ liệu)' });
      const shared = [...M.byDt.entries()].map(([id, es]) => ({ id, ten: es[0].ten, n: es.length, teams: [...new Set(es.map(e => e.team).filter(Boolean))], scale: es.reduce((s, e) => s + e.scale, 0), daLa: !!M.daLaKH.get(id) }))
        .filter(x => x.n >= 2).sort((a, b) => b.n - a.n || b.scale - a.scale).slice(0, 8);
      table($('ovShared'), shared, [
        { k: 'ten', t: 'Đối tác', f: x => `<a href="#/doi-tac/${esc(x.id)}">${esc(x.ten)}</a>${x.daLa ? ' ' + chip('KH TPBank', 'ok') : ''}` },
        { k: 'n', t: 'Số KHHH', num: true }, { k: 'teams', t: 'Team', f: x => x.teams.map(t => chip(t, 'gray')).join('') },
        { k: 'scale', t: 'Quy mô', num: true, f: x => money(x.scale) },
      ], { noSearch: true, pageSize: 8, empty: 'Chưa có đối tác chung' });
      table($('ovRisk'), M.risks.slice(0, 8), [
        { k: 'tenKH', t: 'KHHH', f: r => `<a href="#/khach-hang/${esc(r.cif)}">${esc(r.tenKH)}</a>` },
        { k: 'ten', t: 'Đối tác', f: r => `<a href="#/doi-tac/${esc(r.id)}">${esc(r.ten)}</a>` },
        { k: 'share', t: 'Tỷ trọng', num: true, f: r => pct(r.share) },
        { k: 'flags', t: 'Cảnh báo', f: r => [r.type && chip(r.type + ' · ' + r.level, r.level === 'Cao' ? 'err' : 'warn'), r.chain && chip(r.chain, 'info'), r.decline && chip(r.decline, 'err'), r.stop && chip(r.stop, 'err')].filter(Boolean).join('') },
      ], { noSearch: true, pageSize: 8, empty: 'Không có cảnh báo' });
    },
  };
})();
