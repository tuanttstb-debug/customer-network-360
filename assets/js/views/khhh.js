'use strict';
/* Khách hàng (KHHH) — danh sách + Customer 360: mạng lưới đầu vào (331) / đầu ra (131), tỷ trọng, số dư, đối tác đã là KH TPBank. */
(function () {
  CN.views = CN.views || {};
  const { esc, money, pct, chip, table, kpi } = CN.ui;
  function list(host) {
    const S = CN.store.S, M = S.M;
    const rows = S.data.khhh.map(k => {
      const es = M.byCif.get(k.cif) || [], lots = S.data.lots.filter(l => l.cif === k.cif && l.status === 'Đã duyệt');
      return { k, cif: k.cif, ten: k.ten, team: k.team, dvkd: k.dvkd, n: es.length, thu: es.reduce((s, e) => s + e.psThu, 0), tra: es.reduce((s, e) => s + e.psTra, 0),
        ky: lots.reduce((m, l) => (l.ky > m ? l.ky : m), ''), alerts: M.risks.filter(r => r.cif === k.cif).length };
    });
    host.innerHTML = (CN.store.canDirect() ? '<div class="row end"><button class="btn sm" id="khSync" title="CIF có trong dữ liệu TPB (KH line CB) → cập nhật MST · Tên · ĐVKD theo chuẩn (CIF/CN theo TPB, MST + tên theo sheet 900k). Cột khác giữ nguyên.">Chuẩn hóa KHHH theo dữ liệu nội bộ</button></div>' : '')
      + '<div class="card" id="khList"></div>';
    if ($('khSync')) $('khSync').onclick = async () => {
      try { CN.ui.busy(true, 'Đang chuẩn hóa KHHH…'); const r = await CN.net.write('sync-khhh', {}, { timeoutMs: 120000 }); CN.ui.toast(`${r.checked} KHHH · ${r.found} có trong dữ liệu TPB · cập nhật ${r.updated}`, 'ok'); await CN.refresh(true); }
      catch (e) { CN.ui.toast(e.message, 'err'); } finally { CN.ui.busy(false); }
    };
    table($('khList'), rows, [
      { k: 'ten', t: 'Khách hàng', w: 240, f: r => `<b>${esc(r.ten)}</b><br><small class="muted mono">CIF ${esc(r.cif)}</small>` },
      { k: 'team', t: 'Team', f: r => chip(r.team || '—', 'gray') }, { k: 'dvkd', t: 'ĐVKD' },
      { k: 'n', t: 'Số đối tác', num: true }, { k: 'thu', t: 'PS phải thu', num: true, f: r => money(r.thu) }, { k: 'tra', t: 'PS phải trả', num: true, f: r => money(r.tra) },
      { k: 'ky', t: 'Kỳ mới nhất', f: r => CN.ui.dt(r.ky) }, { k: 'alerts', t: 'Cảnh báo', num: true, f: r => (r.alerts ? chip(r.alerts, 'err') : '') },
    ], { search: ['ten', 'cif', 'team', 'dvkd'], placeholder: 'Tìm tên, CIF, team, ĐVKD…', sortKey: 'thu', rowClass: () => 'click', onRow: (r, tr) => tr.onclick = () => CN.go('khach-hang', r.cif) });
  }
  function detail(host, cif) {
    const S = CN.store.S, M = S.M, k = CN.store.khByCif(cif);
    if (!k) { host.innerHTML = '<div class="alert warn">Không thấy KHHH ' + esc(cif) + '. <a href="#/khach-hang">Quay lại</a></div>'; return; }
    CN.net.call('log', { what: 'Xem KHHH', target: cif }).catch(() => {});
    const es = M.byCif.get(cif) || [], lots = S.data.lots.filter(l => l.cif === cif).sort((a, b) => (a.ky < b.ky ? 1 : -1));
    $('pageTitle').textContent = k.ten; $('pageSub').textContent = 'CIF ' + cif + ' · ' + (k.team || '') + ' · ' + (k.dvkd || '');
    const outs = es.filter(e => e.psThu > 0).sort((a, b) => b.psThu - a.psThu), ins = es.filter(e => e.psTra > 0).sort((a, b) => b.psTra - a.psTra);
    const node = (e, side) => `<div class="net-node" data-id="${esc(e.id)}"><div class="nm">${esc(e.ten)} ${e.daLaKH ? chip('KH TPBank', 'ok') : chip('Chưa là KH', 'org')}</div>
      <div class="meta">${side === 'out' ? 'PS phải thu ' + money(e.psThu) + ' · dư ' + money(e.duThu) : 'PS phải trả ' + money(e.psTra) + ' · dư ' + money(e.duTra)} · ${pct(e.share)}</div>${CN.ui.bar(e.share, 1)}
      ${M.byDt.get(e.id).length > 1 ? `<div class="meta">⛓ chung với ${M.byDt.get(e.id).length - 1} KHHH khác</div>` : ''}</div>`;
    const thu = es.reduce((s, e) => s + e.psThu, 0), tra = es.reduce((s, e) => s + e.psTra, 0), risks = M.risks.filter(r => r.cif === cif);
    host.innerHTML = `<div class="row" style="margin:0 0 12px"><a class="btn sm ghost" href="#/khach-hang">‹ Danh sách KHHH</a>${CN.store.isAdmin() || CN.store.canApprove(k.team) ? '<button class="btn sm" id="khEdit">Sửa thông tin KHHH</button>' : ''}${CN.store.isAdmin() ? '<button class="btn sm danger" id="khDel">Xóa dữ liệu KHHH</button>' : ''}</div>
      <div class="kpis">${kpi('Đối tác', es.length, outs.length + ' người mua · ' + ins.length + ' nhà cung cấp', 'pri')}${kpi('PS phải thu (131)', money(thu))}${kpi('PS phải trả (331)', money(tra))}
        ${kpi('Đối tác chưa là KH TPBank', es.filter(e => !e.daLaKH).length, 'cơ hội vết dầu loang', 'accent')}${kpi('Cảnh báo', risks.length, '', risks.length ? 'danger' : '')}</div>
      <div class="card"><h2>Mạng lưới đối tác</h2><div class="net">
        <div class="net-col"><h3>⬅ Đầu vào — nhà cung cấp (331)</h3>${ins.map(e => node(e, 'in')).join('') || '<p class="muted">Chưa có dữ liệu 331</p>'}</div>
        <div class="net-core"><div class="nm">${esc(k.ten)}</div><div class="muted small">CIF ${esc(cif)}</div><div class="kv" style="margin-top:10px;text-align:left">
          <b>MST</b><span>${esc(k.mst || '—')}</span><b>Ngành</b><span>${esc(k.nganh || '—')}</span><b>ĐVKD</b><span>${esc(k.dvkd || '—')}</span><b>RM</b><span>${esc(k.rm || '—')}</span><b>Team</b><span>${esc(k.team || '—')}</span></div></div>
        <div class="net-col"><h3>Đầu ra — người mua / chủ đầu tư (131) ➡</h3>${outs.map(e => node(e, 'out')).join('') || '<p class="muted">Chưa có dữ liệu 131</p>'}</div>
      </div></div>
      ${risks.length ? `<div class="card"><h2>⚠ Cảnh báo</h2>${risks.map(r => `<div class="alert ${r.level === 'Cao' || r.stop ? 'err' : 'warn'}"><b>${esc(r.ten)}</b> — ${[r.type && r.type + ' (' + r.level + ', ' + pct(r.share) + ')', r.chain, r.decline && r.decline + ' ' + pct(r.chg), r.stop].filter(Boolean).map(esc).join(' · ')}<br><small>${esc(r.action)}</small></div>`).join('')}</div>` : ''}
      <div class="card"><h2>Chi tiết quan hệ</h2><div id="khEdges"></div></div>
      <div class="card"><h2>Các lô đã nạp</h2><div id="khLots"></div></div>`;
    host.querySelectorAll('.net-node').forEach(n => n.onclick = () => CN.go('doi-tac', n.dataset.id));
    table($('khEdges'), es, [
      { k: 'ten', t: 'Đối tác', w: 220, f: e => `<a href="#/doi-tac/${esc(e.id)}">${esc(e.ten)}</a><br><small class="code">${esc(e.id)}</small> <small class="muted">${esc(e.mst)}</small>` },
      { k: 'role', t: 'Vai trò', f: e => chip(e.role, e.psThu > 0 ? 'info' : 'gray') }, { k: 'evidence', t: 'Bằng chứng' },
      { k: 'psThu', t: 'PS phải thu', num: true, f: e => money(e.psThu) }, { k: 'duThu', t: 'Dư PT', num: true, f: e => money(e.duThu) }, { k: 'tlThuHoi', t: 'Thu hồi', num: true, f: e => pct(e.tlThuHoi) },
      { k: 'psTra', t: 'PS phải trả', num: true, f: e => money(e.psTra) }, { k: 'duTra', t: 'Dư PP', num: true, f: e => money(e.duTra) },
      { k: 'share', t: 'Tỷ trọng', num: true, f: e => pct(e.share) }, { k: 'strength', t: 'Sức mạnh QH', num: true, f: e => Math.round(e.strength) + '<br><small>' + esc(e.group) + '</small>' },
    ], { search: ['ten', 'id', 'mst'], sortKey: 'scale' });
    table($('khLots'), lots, [
      { k: 'id', t: 'Lô', f: l => `<span class="code">${esc(l.id)}</span>` }, { k: 'tk', t: 'TK' }, { k: 'ky', t: 'Kỳ', f: l => CN.ui.dt(l.ky) + (l.kyGoc && l.kyGoc !== l.ky ? '<br><small class="muted">' + esc(l.kyGoc) + '</small>' : '') },
      { k: 'n', t: 'Dòng', num: true, f: l => l.nOk + '/' + l.n }, { k: 'status', t: 'Trạng thái', f: l => chip(l.status, l.status === 'Đã duyệt' ? 'ok' : l.status === 'Chờ duyệt' ? 'warn' : 'gray') },
      { k: 'by', t: 'Người nạp', f: l => esc(l.by) + '<br><small class="muted">' + CN.ui.dt(l.at) + '</small>' }, { k: 'file', t: 'Tệp' },
    ], { noSearch: true });
    if ($('khEdit')) $('khEdit').onclick = async () => {
      const f = [['ten', 'Tên khách hàng'], ['mst', 'MST'], ['vietTat', 'Tên viết tắt'], ['nganh', 'Ngành'], ['phanKhuc', 'Phân khúc'], ['dvkd', 'ĐVKD'], ['rm', 'RM/PTKD phụ trách']];
      const r = await CN.ui.ask('Sửa thông tin KHHH', `<div class="grid g2">${f.map(([k2, t]) => `<label class="fld"><span>${t}</span><input data-k="${k2}" value="${esc(k[k2] || '')}"></label>`).join('')}</div>`, { yes: 'Lưu' });
      if (!r.ok) return;
      const sau = {};
      f.forEach(([k2]) => { const v = r.fields[k2]; if (v !== undefined && v !== (k[k2] || '')) sau[k2] = v; });
      if (!Object.keys(sau).length) return;
      try { CN.ui.busy(true, 'Đang lưu…'); await CN.net.write('edit-khhh', { cif, sau }); CN.ui.toast('Đã lưu thông tin KHHH', 'ok'); await CN.refresh(true); } catch (e) { CN.ui.toast(e.message, 'err'); } finally { CN.ui.busy(false); }
    };
    if ($('khDel')) $('khDel').onclick = async () => {
      const r = await CN.ui.ask('Xóa toàn bộ dữ liệu KHHH?', `<p>Xóa <b>${esc(k.ten)}</b> (CIF ${esc(cif)}) cùng ${lots.length} lô và mọi dòng công nợ. Không hoàn tác được; thao tác được ghi nhật ký.</p>`, { yes: 'Xóa', danger: true });
      if (!r.ok) return;
      try { CN.ui.busy(true, 'Đang xóa…'); await CN.net.write('delete-khhh', { cif }); CN.ui.toast('Đã xóa dữ liệu KHHH', 'ok'); await CN.store.load(); CN.go('khach-hang'); } catch (e) { CN.ui.toast(e.message, 'err'); } finally { CN.ui.busy(false); }
    };
  }
  CN.views.khhh = { render(host, arg) { if (arg) detail(host, arg); else list(host); } };
})();
