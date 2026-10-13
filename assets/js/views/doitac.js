'use strict';
/* Đối tác — tra cứu tên/MST → gắn với những KHHH nào (mọi team, D09) · lây lan · sửa/gộp danh mục (Admin/Teamlead thẳng, User → yêu cầu). */
(function () {
  CN.views = CN.views || {};
  const { esc, money, pct, chip, table, kpi } = CN.ui;
  const stopRe = /ngừng|tạm|bỏ địa chỉ|giải thể|không hoạt động/i;
  const mstChip = d => (!d.ttMst ? '' : chip(d.ttMst.replace(/\s*\(.*\)/, ''), stopRe.test(d.ttMst) ? 'err' : /hoạt động/i.test(d.ttMst) ? 'ok' : 'warn'));

  function list(host) {
    const S = CN.store.S, M = S.M;
    const rows = S.data.doiTac.map(d => {
      const es = M.byDt.get(d.id) || [];
      return { d, id: d.id, ten: d.ten, mst: d.mst, n: es.length, thu: es.reduce((s, e) => s + e.psThu, 0), tra: es.reduce((s, e) => s + e.psTra, 0),
        teams: [...new Set(es.map(e => e.team).filter(Boolean))], daLa: !!M.daLaKH.get(d.id), caNhan: d.caNhan, pending: d.status === 'Chờ duyệt' };
    });
    host.innerHTML = '<div class="card" id="dtList"></div>';
    table($('dtList'), rows, [
      { k: 'ten', t: 'Đối tác', w: 260, f: r => `<b>${esc(r.ten)}</b>${r.pending ? ' ' + chip('Chờ duyệt', 'warn') : ''}${r.caNhan ? ' ' + chip('Cá nhân', 'gray') : ''}<br><small class="code">${esc(r.id)}</small> <small class="muted">${esc(r.mst || 'chưa có MST')}</small> ${mstChip(r.d)}` },
      { k: 'n', t: 'Số KHHH', num: true }, { k: 'teams', t: 'Team liên quan', f: r => r.teams.map(t => chip(t, 'gray')).join(''), sort: r => r.teams.length },
      { k: 'thu', t: 'KHHH phải thu', num: true, f: r => money(r.thu) }, { k: 'tra', t: 'KHHH phải trả', num: true, f: r => money(r.tra) },
      { k: 'daLa', t: 'KH TPBank', f: r => (r.daLa ? chip('Đã là KH', 'ok') : chip('Chưa', 'org')), sort: r => (r.daLa ? 1 : 0) },
    ], { search: ['ten', 'mst', 'id', r => r.teams.join(' ')], placeholder: 'Tìm tên đối tác, MST, mã DT…', sortKey: 'n', rowClass: () => 'click', onRow: (r, tr) => tr.onclick = () => CN.go('doi-tac', r.id) });
  }

  function detail(host, id) {
    const S = CN.store.S, M = S.M, d = CN.store.dtById(id);
    if (!d) { host.innerHTML = '<div class="alert warn">Không thấy đối tác ' + esc(id) + ' (có thể đã được gộp). <a href="#/doi-tac">Quay lại</a></div>'; return; }
    CN.net.call('log', { what: 'Xem đối tác', target: id }).catch(() => {});
    const es = M.byDt.get(id) || [], cont = CNModel.contagion(M, id), kh = M.daLaKH.get(id), aliases = S.data.tenGop.filter(a => a.id === id), opp = M.opps.find(o => o.id === id);
    $('pageTitle').textContent = d.ten; $('pageSub').textContent = id + (d.mst ? ' · MST ' + d.mst : '');
    const direct = CN.store.canDirect();
    host.innerHTML = `<div class="row" style="margin:0 0 12px"><a class="btn sm ghost" href="#/doi-tac">‹ Danh sách đối tác</a>
        <button class="btn sm" id="dtEdit">${direct ? 'Sửa' : 'Đề nghị sửa'} tên/MST</button><button class="btn sm" id="dtMerge">${direct ? 'Gộp vào đối tác khác' : 'Đề nghị gộp'}</button>
        ${d.mst && !d.caNhan ? '<button class="btn sm" id="dtVqr">Kiểm MST (VietQR)</button>' : ''}</div>
      <div class="kpis">${kpi('KHHH liên kết', es.length, [...new Set(es.map(e => e.team).filter(Boolean))].join(' · '), 'pri')}
        ${kpi('KHHH phải thu từ đối tác', money(es.reduce((s, e) => s + e.psThu, 0)), 'đối tác là người mua')}${kpi('KHHH phải trả đối tác', money(es.reduce((s, e) => s + e.psTra, 0)), 'đối tác là nhà cung cấp')}
        ${kpi('Quan hệ TPBank', kh ? 'Đã là KH' : 'Chưa là KH', kh ? (kh.nguon + (kh.cif ? ' · CIF ' + kh.cif : '')) : (opp ? opp.priority : ''), kh ? '' : 'accent')}</div>
      <div class="grid g2">
        <div class="card"><h2>Thông tin</h2><div class="kv"><b>Mã</b><span class="code">${esc(id)}</span><b>Tên pháp lý</b><span>${esc(d.ten)}</span><b>MST</b><span>${esc(d.mst || '—')} ${mstChip(d)}</span>
          <b>Nguồn MST</b><span>${esc(d.nguonMst || '—')}</span><b>Ngành</b><span>${esc(d.nganh || '—')}</span><b>Ghi chú</b><span>${esc(d.ghiChu || '—')}</span></div>
          <h3>Tên gốc trên báo cáo đã gộp về mã này</h3>${aliases.length ? aliases.map(a => chip(a.raw, a.trangThai === 'Chờ duyệt' ? 'warn' : 'gray')).join('') : '<span class="muted small">Chỉ tên chuẩn</span>'}
          ${opp ? `<h3>Cơ hội bán chéo</h3><div class="alert ${opp.priority[1] === '1' ? 'warn' : 'info'}"><b>${esc(opp.priority)}</b> · điểm ${Math.round(opp.score)} · cầu nối: <a href="#/khach-hang/${esc(opp.bridge.cif)}">${esc(opp.bridge.tenKH)}</a> (${esc(opp.bridge.team || '')}${opp.bridge.rm ? ' · RM ' + esc(opp.bridge.rm) : ''})<br>${esc(opp.action)}</div>` : ''}</div>
        <div class="card"><h2>⚠ Lây lan — nếu đối tác này gặp vấn đề</h2><div id="dtCont"></div></div>
      </div>
      <div class="card"><h2>KHHH có quan hệ với đối tác (mọi team)</h2><div id="dtEdges"></div></div>`;
    table($('dtCont'), cont, [
      { k: 'tenKH', t: 'KHHH bị ảnh hưởng', f: c => `<a href="#/khach-hang/${esc(c.cif)}">${esc(c.tenKH)}</a><br><small class="muted">${esc(c.team)}</small>` },
      { k: 'role', t: 'Đối tác là', f: c => (c.role === CNModel.ROLE_BUY ? 'Người mua' : 'Nhà cung cấp') },
      { k: 'share', t: 'Tỷ trọng trong KHHH', num: true, f: c => pct(c.share) + CN.ui.bar(c.share, 1) },
      { k: 'du', t: 'Dư hiện tại', num: true, f: c => money(c.duThu || c.duTra), sort: c => c.duThu + c.duTra },
    ], { noSearch: true, sortKey: 'share', empty: 'Không có KHHH liên kết' });
    table($('dtEdges'), es, [
      { k: 'tenKH', t: 'KHHH', f: e => `<a href="#/khach-hang/${esc(e.cif)}">${esc(e.tenKH)}</a><br><small class="mono muted">CIF ${esc(e.cif)}</small>` },
      { k: 'team', t: 'Team', f: e => chip(e.team || '—', 'gray') }, { k: 'dvkd', t: 'ĐVKD / RM', f: e => esc(e.dvkd) + (e.rm ? '<br><small>' + esc(e.rm) + '</small>' : '') },
      { k: 'psThu', t: 'PS phải thu', num: true, f: e => money(e.psThu) }, { k: 'psTra', t: 'PS phải trả', num: true, f: e => money(e.psTra) },
      { k: 'share', t: 'Tỷ trọng', num: true, f: e => pct(e.share) }, { k: 'strength', t: 'Sức mạnh QH', num: true, f: e => Math.round(e.strength) },
      { k: 'periods', t: 'Theo kỳ', f: e => e.periods.map(p => `<small>${CN.ui.dt(p.ky)}: ${p.psThu ? 'PT ' + money(p.psThu) : ''}${p.psThu && p.psTra ? ' · ' : ''}${p.psTra ? 'PP ' + money(p.psTra) : ''}</small>`).join('<br>'), nosort: true },
    ], { noSearch: true, sortKey: 'scale' });

    const save = async (action, payload, okMsg) => {
      try { CN.ui.busy(true, 'Đang lưu…'); const r = await CN.net.write(action, payload); CN.ui.toast(r.applied ? okMsg : 'Đã gửi yêu cầu ' + r.request + ' — chờ teamlead duyệt', 'ok'); await CN.refresh(true); return r; }
      catch (e) { CN.ui.toast(e.message, 'err'); } finally { CN.ui.busy(false); }
    };
    $('dtEdit').onclick = async () => {
      const r = await CN.ui.ask(direct ? 'Sửa đối tác ' + id : 'Đề nghị sửa đối tác ' + id, `<label class="fld"><span>Tên pháp lý</span><textarea data-k="ten" rows="2">${esc(d.ten)}</textarea></label>
        <div class="grid g2" style="margin-top:8px"><label class="fld"><span>MST</span><input data-k="mst" value="${esc(d.mst)}"></label><label class="fld"><span>Ngành</span><input data-k="nganh" value="${esc(d.nganh)}"></label></div>
        <label class="fld" style="margin-top:8px"><span>Ghi chú</span><input data-k="ghiChu" value="${esc(d.ghiChu)}"></label>${direct ? '' : '<p class="muted small">Đối tác dùng chung mọi team → thay đổi chờ teamlead duyệt.</p>'}`, { yes: direct ? 'Lưu' : 'Gửi đề nghị' });
      if (!r.ok) return;
      const sau = {}, map = { ten: 'ten', mst: 'mst', nganh: 'nganh', ghiChu: 'ghiChu' };
      Object.keys(map).forEach(k => { const v = (r.fields[k] || '').replace(/\s+/g, ' ').trim(); if (v !== (d[map[k]] || '')) sau[k] = v; });
      if (Object.keys(sau).length) await save('edit-doitac', { cid: id, sau }, 'Đã sửa đối tác');
    };
    $('dtMerge').onclick = async () => {
      const opts = S.data.doiTac.filter(x => x.id !== id).sort((a, b) => (a.ten < b.ten ? -1 : 1));
      const r = await CN.ui.ask('Gộp ' + id + ' vào đối tác khác', `<p>Mọi dòng công nợ, tên gộp của <b>${esc(d.ten)}</b> sẽ chuyển sang đối tác được chọn; mã ${esc(id)} bị bỏ.</p>
        <label class="fld"><span>Gộp vào</span><input data-k="into" list="dtOpts" placeholder="Gõ mã DT hoặc tên…"></label><datalist id="dtOpts">${opts.map(x => `<option value="${esc(x.id)}">${esc(x.ten)}</option>`).join('')}</datalist>`, { yes: direct ? 'Gộp' : 'Gửi đề nghị', danger: direct });
      if (!r.ok) return;
      const into = (r.fields.into || '').trim();
      if (!CN.store.dtById(into)) { CN.ui.toast('Chọn đúng mã đối tác (DTxxxxx) trong danh sách', 'err'); return; }
      const out = await save('merge-doitac', { from: id, into }, 'Đã gộp vào ' + into);
      if (out && out.applied) CN.go('doi-tac', into);
    };
    if ($('dtVqr')) $('dtVqr').onclick = async () => {
      const v = await CN.mst.vietqr(d.mst);
      if (!v.ok) { CN.ui.toast(v.err, 'err'); return; }
      const sameName = v.name && v.name.trim() === d.ten.trim();
      const r = await CN.ui.ask('Kết quả VietQR — MST ' + v.mst, `<div class="kv"><b>Tên pháp lý</b><span>${esc(v.name)}</span><b>Trạng thái</b><span>${esc(v.status || '—')}</span><b>Địa chỉ</b><span>${esc(v.address || '—')}</span></div>
        ${sameName ? '<div class="alert ok">✓ Tên khớp danh mục.</div>' : `<div class="alert warn">⚠ Tên khác danh mục: <i>${esc(d.ten)}</i></div>`}`, { yes: sameName ? 'Đóng' : (direct ? 'Dùng tên VietQR' : 'Đề nghị dùng tên VietQR'), no: 'Bỏ qua' });
      if (r.ok && !sameName) await save('edit-doitac', { cid: id, sau: { ten: v.name } }, 'Đã cập nhật tên theo VietQR');
    };
  }
  CN.views.doitac = { render(host, arg) { if (arg) detail(host, arg); else list(host); } };
})();
