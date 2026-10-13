'use strict';
/* Rủi ro — tập trung (tỷ trọng ≥ ngưỡng) · mắt xích chung (1 đối tác ≥ 2 KHHH) · suy giảm đầu ra 3 tháng · đối tác ngừng hoạt động (VietQR). Công thức 11_Risk_Alert. */
(function () {
  CN.views = CN.views || {};
  const { esc, money, pct, chip, table, kpi } = CN.ui;
  CN.views.ruiro = {
    render(host) {
      const M = CN.store.S.M, R = M.risks, C = M.cfg;
      const c = f => R.filter(f).length;
      host.innerHTML = `<div class="kpis">${kpi('Tập trung mức Cao', c(r => r.level === 'Cao'), 'tỷ trọng ≥ ' + pct(C.tapTrungCao), 'danger')}${kpi('Tập trung trung bình', c(r => r.level === 'Trung bình'), '≥ ' + pct(C.tapTrungTheoDoi))}
        ${kpi('Mắt xích chung', c(r => r.chain), 'đối tác chung ≥ 2 KHHH')}${kpi('Suy giảm đầu ra', c(r => r.decline), '3T gần nhất ≤ ' + pct(C.suyGiam))}${kpi('Đối tác ngừng/tạm HĐ', c(r => r.stop), 'theo VietQR', c(r => r.stop) ? 'danger' : '')}</div>
        <div class="card"><div class="row" style="margin:0 0 8px"><label>Lọc <select id="rrF"><option value="">Tất cả cảnh báo</option><option value="cao">Tập trung Cao</option><option value="tt">Tập trung (mọi mức)</option><option value="chain">Mắt xích chung</option><option value="dec">Suy giảm đầu ra</option><option value="stop">Đối tác ngừng/tạm hoạt động</option></select></label></div><div id="rrBox"></div></div>
        <p class="muted small">Suy giảm đầu ra so PS phải thu 3 tháng gần nhất với 3 tháng trước theo kỳ của lô — chỉ có ý nghĩa khi KHHH nạp số liệu theo tháng/quý. Lây lan: mở từng đối tác để xem KHHH bị ảnh hưởng.</p>`;
      const F = { cao: r => r.level === 'Cao', tt: r => r.type, chain: r => r.chain, dec: r => r.decline, stop: r => r.stop };
      const draw = () => {
        const f = F[$('rrF').value], box = $('rrBox'); box.__tbl = null;
        table(box, f ? R.filter(f) : R, [
          { k: 'rank', t: '#', num: true },
          { k: 'tenKH', t: 'KHHH', f: r => `<a href="#/khach-hang/${esc(r.cif)}">${esc(r.tenKH)}</a><br><small class="muted">${esc(r.team)}</small>` },
          { k: 'ten', t: 'Đối tác', f: r => `<a href="#/doi-tac/${esc(r.id)}">${esc(r.ten)}</a><br><small class="muted">${esc(r.role)}</small>` },
          { k: 'share', t: 'Tỷ trọng', num: true, f: r => pct(r.share) + CN.ui.bar(r.share, 1) }, { k: 'scale', t: 'Quy mô QH', num: true, f: r => money(r.scale) },
          { k: 'flags', t: 'Cảnh báo', nosort: true, f: r => [r.type && chip(r.type + ' · ' + r.level, r.level === 'Cao' ? 'err' : 'warn'), r.chain && chip(r.chain, 'info'), r.decline && chip(r.decline + ' ' + pct(r.chg), 'err'), r.stop && chip(r.stop, 'err')].filter(Boolean).join('') },
          { k: 'action', t: 'Hành động khuyến nghị', w: 260 },
        ], { search: ['tenKH', 'ten', 'team', 'cif', 'id'], placeholder: 'Tìm KHHH, đối tác, team…', sortKey: 'rank', sortDir: 1, tools: '<button class="btn sm" id="rrXlsx">Xuất Excel</button>', after: () => { $('rrXlsx').onclick = () => CN.xlsx.exportRisks(); } });
      };
      $('rrF').onchange = draw; draw();
    },
  };
})();
