'use strict';
/* ui.js — tiện ích giao diện dùng chung (khuôn SHTD): $ · esc · định dạng tiền · toast · hộp xác nhận · bảng có sắp xếp/tìm · điều hướng hash.
 * Lưu ý: lõi core/*.js dùng $ = getElementById (giữ nguyên ngữ nghĩa). */
const $ = id => document.getElementById(id);
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = v => (v === null || v === undefined || v === '' || !Number.isFinite(+v) ? '' : Math.round(+v).toLocaleString('vi-VN'));
  /** VND → "1.234 tr" / "12,3 tỷ" */
  const money = v => { v = +v || 0; const a = Math.abs(v); if (a >= 1e9) return (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ'; if (a >= 1e6) return Math.round(v / 1e6).toLocaleString('vi-VN') + ' tr'; return fmt(v); };
  const pct = v => (v === null || v === undefined || !Number.isFinite(+v) ? '–' : (v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%');
  const today = () => new Date().toISOString().slice(0, 10);
  const dt = s => { const t = String(s || ''); return t.length >= 16 ? t.slice(8, 10) + '/' + t.slice(5, 7) + ' ' + t.slice(11, 16) : t.length >= 10 ? t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + t.slice(0, 4) : t; };

  function toast(msg, kind) {
    const box = $('toasts'); if (!box) return;
    const el = document.createElement('div'); el.className = 'toast ' + (kind || 'info'); el.innerHTML = esc(msg);
    box.appendChild(el); setTimeout(() => el.classList.add('out'), kind === 'err' ? 7000 : 3500); setTimeout(() => el.remove(), kind === 'err' ? 7600 : 4100);
  }
  /** Hộp xác nhận trong trang (không dùng alert/confirm của trình duyệt). → Promise<{ok, text}> */
  function ask(title, body, opts) {
    opts = opts || {};
    return new Promise(res => {
      const m = $('modal'); m.innerHTML = `<div class="modal-card"><h3>${esc(title)}</h3><div class="modal-body">${body || ''}</div>
        ${opts.input ? `<textarea id="askText" rows="3" placeholder="${esc(opts.input)}"></textarea>` : ''}
        <div class="row end"><button class="btn" id="askNo">${esc(opts.no || 'Hủy')}</button><button class="btn ${opts.danger ? 'danger' : 'pri'}" id="askYes">${esc(opts.yes || 'Đồng ý')}</button></div></div>`;
      m.classList.add('on');
      const done = ok => {
        const t = $('askText') ? $('askText').value.trim() : '', fields = {};
        m.querySelectorAll('[data-k]').forEach(el => { fields[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
        m.classList.remove('on'); m.innerHTML = ''; res({ ok, text: t, fields });
      };
      $('askNo').onclick = () => done(false); $('askYes').onclick = () => done(true);
      m.onclick = e => { if (e.target === m) done(false); };
    });
  }
  function busy(on, msg) { const b = $('busy'); if (!b) return; b.classList.toggle('on', !!on); $('busyMsg').textContent = msg || 'Đang xử lý…'; }

  /**
   * Bảng có tìm + sắp xếp. cols: [{k, t, f?(row)→html, num?, sort?(row)→value, w?}] · opts: {search: [keys], empty, onRow(row, tr), pageSize}
   */
  function table(host, rows, cols, opts) {
    opts = opts || {};
    const st = host.__tbl || (host.__tbl = { q: '', sk: opts.sortKey || null, sd: opts.sortDir || -1, page: 0 });
    const draw = () => {
      const q = st.q.trim().toLowerCase(), keys = opts.search || cols.map(c => c.k);
      let list = !q ? rows.slice() : rows.filter(r => keys.some(k => String(typeof k === 'function' ? k(r) : r[k] == null ? '' : r[k]).toLowerCase().includes(q)));
      if (st.sk) { const c = cols.find(x => x.k === st.sk); const sv = c && c.sort ? c.sort : r => r[st.sk]; list.sort((a, b) => { const x = sv(a), y = sv(b); return (x > y ? 1 : x < y ? -1 : 0) * st.sd; }); }
      const ps = opts.pageSize || 50, pages = Math.max(1, Math.ceil(list.length / ps)); st.page = Math.min(st.page, pages - 1);
      const view = list.slice(st.page * ps, st.page * ps + ps);
      host.innerHTML = `<div class="tbl-tools">${opts.noSearch ? '' : `<input class="search" placeholder="${esc(opts.placeholder || 'Tìm…')}" value="${esc(st.q)}">`}<span class="muted">${list.length} dòng</span>${opts.tools || ''}</div>
        <div class="tblwrap"><table class="tbl"><thead><tr>${cols.map(c => `<th data-k="${esc(c.k)}" class="${c.num ? 'num' : ''} ${c.nosort ? '' : 'sortable'}" ${c.w ? `style="min-width:${c.w}px"` : ''}>${esc(c.t)}${st.sk === c.k ? (st.sd > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
        <tbody>${view.length ? view.map((r, i) => `<tr data-i="${i}" class="${opts.rowClass ? opts.rowClass(r) : ''}">${cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.f ? c.f(r) : esc(r[c.k])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="empty">${esc(opts.empty || 'Chưa có dữ liệu')}</td></tr>`}</tbody></table></div>
        ${pages > 1 ? `<div class="pager"><button class="btn sm" data-p="-1" ${st.page ? '' : 'disabled'}>‹</button><span>Trang ${st.page + 1}/${pages}</span><button class="btn sm" data-p="1" ${st.page < pages - 1 ? '' : 'disabled'}>›</button></div>` : ''}`;
      const s = host.querySelector('.search');
      if (s) { s.oninput = () => { st.q = s.value; st.page = 0; const pos = s.selectionStart; draw(); const n = host.querySelector('.search'); n.focus(); n.setSelectionRange(pos, pos); }; }
      host.querySelectorAll('th.sortable').forEach(th => th.onclick = () => { const k = th.dataset.k; if (st.sk === k) st.sd = -st.sd; else { st.sk = k; st.sd = -1; } draw(); });
      host.querySelectorAll('.pager [data-p]').forEach(b => b.onclick = () => { st.page += +b.dataset.p; draw(); });
      if (opts.onRow) host.querySelectorAll('tbody tr[data-i]').forEach(tr => opts.onRow(view[+tr.dataset.i], tr));
      if (opts.after) opts.after(host);
    };
    draw();
  }
  const kpi = (label, value, sub, cls) => `<div class="kpi ${cls || ''}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;
  const chip = (t, cls) => `<span class="chip ${cls || ''}">${esc(t)}</span>`;
  const bar = (v, max) => `<div class="mbar"><div style="width:${Math.max(2, Math.min(100, max ? v / max * 100 : 0))}%"></div></div>`;

  CN.ui = { esc, fmt, money, pct, today, dt, toast, ask, busy, table, kpi, chip, bar };
})();
