'use strict';
/* Lô & duyệt — Teamlead cùng team / Admin duyệt lô + yêu cầu sửa danh mục; mọi người xem lô của mình (trạng thái, lý do từ chối). */
(function () {
  CN.views = CN.views || {};
  const { esc, money, chip, table, fmt } = CN.ui;
  const stChip = s => chip(s, s === 'Đã duyệt' ? 'ok' : s === 'Chờ duyệt' ? 'warn' : s === 'Từ chối' ? 'err' : 'gray');

  function lotPreview(l) {
    const S = CN.store.S, rows = S.data.congNo.filter(c => c.lot === l.id);
    const old = S.data.lots.find(o => o.id !== l.id && o.status === 'Đã duyệt' && o.cif === l.cif && o.tk === l.tk && o.ky === l.ky);
    const sum = i => rows.reduce((s, r) => s + r.vals[i], 0);
    const dt = id => CN.store.dtById(id) || {};
    return `<div class="kv"><b>KHHH</b><span>${esc(l.tenKH)} · CIF ${esc(l.cif)}</span><b>TK · Kỳ</b><span>${esc(l.tk)} · ${CN.ui.dt(l.ky)} ${l.kyGoc ? '(' + esc(l.kyGoc) + ')' : ''}</span>
      <b>Tệp</b><span>${esc(l.file)}</span><b>Người nạp</b><span>${esc(l.by)} · ${esc(l.team)} · ${CN.ui.dt(l.at)}</span><b>Cân đối</b><span>${l.nOk}/${l.n} dòng ${l.nOk < l.n ? chip((l.n - l.nOk) + ' dòng chưa cân', 'warn') : chip('đủ', 'ok')}</span></div>
      ${old ? `<div class="alert warn">Duyệt lô này sẽ <b>thay thế</b> lô ${esc(old.id)} (cùng KHHH + TK + kỳ, nạp bởi ${esc(old.by)} ${CN.ui.dt(old.at)}).</div>` : ''}
      <div class="tblwrap" style="max-height:340px;margin-top:8px"><table class="tbl"><thead><tr><th>#</th><th>Tên trên báo cáo</th><th>Mã</th><th class="num">ĐK Nợ</th><th class="num">ĐK Có</th><th class="num">PS Nợ</th><th class="num">PS Có</th><th class="num">CK Nợ</th><th class="num">CK Có</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.line}</td><td>${esc(r.raw)}${dt(r.id).status === 'Chờ duyệt' ? ' ' + chip('đối tác mới', 'org') : ''}</td><td class="code">${esc(r.id)}</td>${r.vals.map(v => `<td class="num">${fmt(v)}</td>`).join('')}<td>${r.bal === 'Cân' ? '<span class="okc">✓</span>' : '<span class="errc">chưa cân</span>'}</td></tr>`).join('')}
      <tr class="tot"><td colspan="3"><b>Tổng</b></td>${[0, 1, 2, 3, 4, 5].map(i => `<td class="num"><b>${fmt(sum(i))}</b></td>`).join('')}<td></td></tr></tbody></table></div>`;
  }

  CN.views.duyet = {
    render(host) {
      const S = CN.store.S, me = S.user.username.toLowerCase();
      const lots = S.data.lots.slice().sort((a, b) => (a.at < b.at ? 1 : -1));
      const pend = lots.filter(l => l.status === 'Chờ duyệt' && CN.store.canApprove(l.team));
      const ycs = S.data.yeuCau.slice().sort((a, b) => (a.at < b.at ? 1 : -1)), ycPend = ycs.filter(y => y.status === 'Chờ duyệt' && CN.store.canApprove(y.team));
      host.innerHTML = `${CN.store.canDirect() ? '' : '<div class="alert info">Lô bạn nạp và đề nghị sửa danh mục chờ <b>Teamlead cùng team</b> duyệt rồi mới lên dashboard.</div>'}
        <div class="tabs"><button class="tab on" data-t="cho">Chờ tôi duyệt (${pend.length + ycPend.length})</button><button class="tab" data-t="lo">Lô (${lots.length})</button><button class="tab" data-t="yc">Yêu cầu danh mục (${ycs.length})</button></div><div id="dyBox"></div>`;
      const tabs = host.querySelectorAll('.tab');
      const act = async (action, payload, msg) => { try { CN.ui.busy(true, 'Đang lưu…'); await CN.net.write(action, payload); CN.ui.toast(msg, 'ok'); await CN.refresh(true); } catch (e) { CN.ui.toast(e.message, 'err'); } finally { CN.ui.busy(false); } };
      const decideLot = async (l, ok) => {
        const r = await CN.ui.ask((ok ? 'Duyệt' : 'Từ chối') + ' lô ' + l.id, lotPreview(l), ok ? { yes: 'Duyệt — đưa lên dashboard' } : { yes: 'Từ chối', danger: true, input: 'Lý do từ chối (bắt buộc) — người nạp sẽ thấy' });
        if (!r.ok) return;
        if (!ok && !r.text) { CN.ui.toast('Cần ghi lý do từ chối', 'err'); return; }
        await act('approve-lot', { batchId: l.id, ok, reason: r.text }, ok ? 'Đã duyệt lô ' + l.id : 'Đã từ chối lô ' + l.id);
      };
      const ycText = y => {
        const d = CN.store.dtById(y.cid);
        if (y.loai === 'gop-doitac') { const t = CN.store.dtById(y.sau.into); return `Gộp <b>${esc(y.cid)}</b> ${esc(d ? d.ten : '')} → <b>${esc(y.sau.into)}</b> ${esc(t ? t.ten : '')}`; }
        return `Sửa <a href="#/doi-tac/${esc(y.cid)}">${esc(y.cid)}</a>: ` + Object.keys(y.sau).map(k => `${esc({ ten: 'tên', mst: 'MST', nganh: 'ngành', ghiChu: 'ghi chú' }[k] || k)} <s class="muted">${esc(y.truoc[k] || '∅')}</s> → <b>${esc(y.sau[k])}</b>`).join(' · ');
      };
      const decideYc = async (y, ok) => {
        const r = await CN.ui.ask((ok ? 'Duyệt' : 'Từ chối') + ' yêu cầu ' + y.id, `<p>${ycText(y)}</p><p class="muted small">Đề nghị bởi ${esc(y.by)} (${esc(y.team)}) · ${CN.ui.dt(y.at)}</p>`, ok ? { yes: 'Duyệt' } : { yes: 'Từ chối', danger: true, input: 'Lý do' });
        if (r.ok) await act('approve-req', { reqId: y.id, ok, reason: r.text }, (ok ? 'Đã duyệt ' : 'Đã từ chối ') + y.id);
      };
      const lotCols = withAct => [
        { k: 'id', t: 'Lô', f: l => `<span class="code">${esc(l.id)}</span>` },
        { k: 'tenKH', t: 'KHHH', f: l => `<a href="#/khach-hang/${esc(l.cif)}">${esc(l.tenKH)}</a><br><small class="mono muted">${esc(l.cif)}</small>` },
        { k: 'tk', t: 'TK · Kỳ', f: l => esc(l.tk) + ' · ' + CN.ui.dt(l.ky) }, { k: 'n', t: 'Cân đối', num: true, f: l => l.nOk + '/' + l.n },
        { k: 'by', t: 'Người nạp', f: l => esc(l.by) + '<br><small class="muted">' + esc(l.team) + ' · ' + CN.ui.dt(l.at) + '</small>' },
        { k: 'status', t: 'Trạng thái', f: l => stChip(l.status) + (l.reason && l.status === 'Từ chối' ? '<br><small class="errc">' + esc(l.reason) + '</small>' : '') + (l.approver ? '<br><small class="muted">' + esc(l.approver) + '</small>' : '') },
        withAct ? { k: 'act', t: '', nosort: true, f: () => '<button class="btn sm pri" data-a="ok">Xem & duyệt</button> <button class="btn sm" data-a="no">Từ chối</button>' } : { k: 'file', t: 'Tệp' },
      ];
      const show = t => {
        tabs.forEach(x => x.classList.toggle('on', x.dataset.t === t));
        const box = $('dyBox');
        if (t === 'cho') {
          box.innerHTML = '<div class="card"><h2>Lô chờ duyệt</h2><div id="dyLots"></div></div><div class="card"><h2>Yêu cầu sửa danh mục chờ duyệt</h2><div id="dyYc"></div></div>';
          table($('dyLots'), pend, lotCols(true), { noSearch: true, empty: 'Không có lô chờ bạn duyệt', onRow: (l, tr) => { tr.querySelector('[data-a=ok]').onclick = () => decideLot(l, true); tr.querySelector('[data-a=no]').onclick = () => decideLot(l, false); } });
          table($('dyYc'), ycPend, [{ k: 'id', t: 'Mã', f: y => `<span class="code">${esc(y.id)}</span>` }, { k: 'txt', t: 'Nội dung', f: ycText, nosort: true }, { k: 'by', t: 'Người đề nghị', f: y => esc(y.by) + '<br><small class="muted">' + esc(y.team) + '</small>' },
            { k: 'act', t: '', nosort: true, f: () => '<button class="btn sm pri" data-a="ok">Duyệt</button> <button class="btn sm" data-a="no">Từ chối</button>' }],
            { noSearch: true, empty: 'Không có yêu cầu chờ bạn duyệt', onRow: (y, tr) => { tr.querySelector('[data-a=ok]').onclick = () => decideYc(y, true); tr.querySelector('[data-a=no]').onclick = () => decideYc(y, false); } });
        } else if (t === 'lo') {
          box.innerHTML = '<div class="card" id="dyAll"></div>';
          table($('dyAll'), lots, lotCols(false), { search: ['id', 'tenKH', 'cif', 'by', 'team', 'status', 'file'], placeholder: 'Tìm lô, KHHH, người nạp, trạng thái…', rowClass: () => 'click',
            onRow: (l, tr) => tr.onclick = () => CN.ui.ask('Lô ' + l.id, lotPreview(l), { yes: 'Đóng', no: 'Đóng' }) });
        } else {
          box.innerHTML = '<div class="card" id="dyAllYc"></div>';
          table($('dyAllYc'), ycs, [{ k: 'id', t: 'Mã', f: y => `<span class="code">${esc(y.id)}</span>` }, { k: 'txt', t: 'Nội dung', f: ycText, nosort: true },
            { k: 'by', t: 'Người đề nghị', f: y => esc(y.by) + ' · ' + CN.ui.dt(y.at) }, { k: 'status', t: 'Trạng thái', f: y => stChip(y.status) + (y.approver ? '<br><small class="muted">' + esc(y.approver) + (y.reason ? ' — ' + esc(y.reason) : '') + '</small>' : '') }],
            { search: ['id', 'cid', 'by', 'status'], empty: 'Chưa có yêu cầu' });
        }
      };
      tabs.forEach(t => t.onclick = () => show(t.dataset.t));
      show(pend.length + ycPend.length || CN.store.canDirect() ? 'cho' : 'lo');
    },
  };
  CN.lotPreview = lotPreview;
})();
