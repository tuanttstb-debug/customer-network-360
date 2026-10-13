'use strict';
/* Cơ hội bán chéo ("vết dầu loang") — đối tác CHƯA là KH TPBank, xếp theo điểm cơ hội (09_Opportunity) + mạng tham chiếu (10). */
(function () {
  CN.views = CN.views || {};
  const { esc, money, chip, table } = CN.ui;
  CN.views.cohoi = {
    render(host) {
      const M = CN.store.S.M;
      host.innerHTML = `<div class="tabs"><button class="tab on" data-t="opp">Cơ hội (${M.opps.length})</button><button class="tab" data-t="ref">Mạng tham chiếu (${M.refs.length})</button></div><div class="card" id="coBox"></div>
        <p class="muted small">Điểm cơ hội = quy mô (25) + số KHHH liên kết (15) + giai đoạn BL (15, đợt 2) + thời gian quan hệ (10) + BL còn hiệu lực (15, đợt 2) + 20 — công thức 09_Opportunity của template; ngưỡng P1/P2 và benchmark ở Danh mục → Tham số. TOI kỳ vọng = 0,4% quy mô.</p>`;
      const tabs = host.querySelectorAll('.tab');
      const show = t => {
        tabs.forEach(x => x.classList.toggle('on', x.dataset.t === t));
        const box = $('coBox'); box.__tbl = null;
        if (t === 'opp') table(box, M.opps, [
          { k: 'rank', t: '#', num: true },
          { k: 'ten', t: 'Đối tác tiềm năng', w: 240, f: o => `<a href="#/doi-tac/${esc(o.id)}"><b>${esc(o.ten)}</b></a><br><small class="code">${esc(o.id)}</small> <small class="muted">${esc(o.mst)}</small>` },
          { k: 'role', t: 'Vai trò' }, { k: 'nKH', t: 'KHHH liên kết', num: true },
          { k: 'scale', t: 'Quy mô QH', num: true, f: o => money(o.scale) + '<br><small class="muted">PT ' + money(o.psThu) + ' · PP ' + money(o.psTra) + '</small>' },
          { k: 'bridge', t: 'KHHH cầu nối', f: o => `<a href="#/khach-hang/${esc(o.bridge.cif)}">${esc(o.bridge.tenKH)}</a><br><small class="muted">${esc(o.bridge.team)}${o.bridge.dvkd ? ' · ' + esc(o.bridge.dvkd) : ''}${o.bridge.rm ? ' · RM ' + esc(o.bridge.rm) : ''}</small>`, sort: o => o.bridge.tenKH },
          { k: 'score', t: 'Điểm', num: true, f: o => Math.round(o.score) },
          { k: 'priority', t: 'Ưu tiên', f: o => chip(o.priority, o.priority[1] === '1' ? 'org' : o.priority[1] === '2' ? 'info' : 'gray') },
          { k: 'action', t: 'Hành động tiếp theo', w: 220 }, { k: 'toi', t: 'TOI kỳ vọng', num: true, f: o => money(o.toi) },
        ], { search: ['ten', 'mst', 'id', o => o.bridge.tenKH, o => o.teams.join(' '), 'priority'], placeholder: 'Tìm đối tác, MST, KHHH cầu nối, team…', sortKey: 'score',
          tools: '<button class="btn sm" id="coXlsx">Xuất Excel</button>', after: () => { $('coXlsx').onclick = () => CN.xlsx.exportOpps(); } });
        else table(box, M.refs, [
          { k: 'ten', t: 'Doanh nghiệp cần tham chiếu', w: 240, f: r => `<a href="#/doi-tac/${esc(r.id)}">${esc(r.ten)}</a>${r.daLaKH ? ' ' + chip('KH TPBank', 'ok') : ''}` },
          { k: 'nKH', t: 'KHHH liên kết', num: true },
          { k: 'top', t: 'KHHH tham chiếu (#1 → #3)', f: r => r.top.map((t, i) => `<small>#${i + 1} <a href="#/khach-hang/${esc(t.cif)}">${esc(t.tenKH)}</a> · ${money(t.scale)} · ${esc(t.team)}</small>`).join('<br>'), nosort: true },
          { k: 'score', t: 'Điểm tham chiếu', num: true, f: r => Math.round(r.score) }, { k: 'level', t: 'Mức phù hợp', f: r => chip(r.level, r.level === 'Ưu tiên 1' ? 'org' : r.level === 'Phù hợp' ? 'info' : 'gray') },
        ], { search: ['ten', 'id', r => r.top.map(t => t.tenKH).join(' ')], sortKey: 'score' });
      };
      tabs.forEach(t => t.onclick = () => show(t.dataset.t));
      show('opp');
    },
  };
})();
