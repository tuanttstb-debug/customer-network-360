'use strict';
/* Nạp dữ liệu — 4 bước của công cụ 131–331 v0.1 (lõi core/*.js đã test: OCR từng ô + cân đối, gộp đối tác, tra MST),
 * thay "mở kho / tải kho" bằng DB dùng chung: ① Nạp tệp → ② Duyệt số liệu → ③ Đối tác & MST → ④ Lưu (Admin/Teamlead) / Gửi duyệt (User).
 * Tệp gốc đọc TẠI MÁY — chỉ dòng số đã duyệt + tên/MST đối tác được gửi lên. Trạng thái giữ trong bộ nhớ trang tới khi lưu xong. */
(function () {
  CN.views = CN.views || {};
  const { esc, fmt, chip } = CN.ui;
  const N = { step: 1, batches: [], assign: null, meta: { cn: '', cif: '', tenKH: '', mstKH: '' }, readCtx: null, busy: false };
  const kho = () => CN.store.khoForMapping();
  const today = () => new Date().toISOString().slice(0, 10);

  /* ================= khung ================= */
  function render(host) {
    const st = [['① Nạp tệp', 1], ['② Duyệt số liệu', 2], ['③ Đối tác & MST', 3], ['④ ' + (CN.store.canDirect() ? 'Lưu vào kho' : 'Gửi duyệt'), 4]];
    host.innerHTML = `<div class="alert info"><b>Máy liệt kê – người xác nhận.</b> Tệp PDF/scan/Excel đọc ngay trên máy này, <b>không gửi đi</b>. Dòng tô đỏ = chưa cân đối (Dư đầu kỳ + PS Nợ − PS Có ≠ Dư cuối kỳ) → soát ở bước ②.
      ${CN.store.canDirect() ? 'Bạn là ' + esc(CN.store.role()) + ': lưu là lên dashboard ngay.' : 'Bạn là thành viên: lô gửi lên chờ <b>Teamlead cùng team</b> duyệt.'}</div>
      <div class="steps">${st.map(([t, i]) => `<div class="step-pill ${N.step === i ? 'on' : i < N.step ? 'done' : ''}" data-s="${i}"><b>${i < N.step ? '✓' : i}</b>${esc(t.slice(2))}</div>`).join('')}</div><div id="npBody"></div>`;
    host.querySelectorAll('.step-pill').forEach(p => p.onclick = () => { const s = +p.dataset.s; if (s === 1 || N.batches.length) goStep(s); });
    ({ 1: step1, 2: step2, 3: step3, 4: step4 })[N.step]($('npBody'));
  }
  function goStep(s) { if (s === 3 && !N.assign) buildAssign(); N.step = s; render($('view')); window.scrollTo(0, 0); }

  /* ================= ① Nạp tệp ================= */
  function step1(box) {
    const S = CN.store.S, M = N.meta;
    box.innerHTML = `<div class="grid g2"><div class="card"><h2>Nạp báo cáo 131 / 331 của 1 KHHH</h2>
        <div class="grid g2"><label class="fld"><span>CIF KHHH *</span><input id="npCif" list="npKh" value="${esc(M.cif)}" placeholder="Gõ CIF hoặc chọn KHHH đã có"><datalist id="npKh">${S.data.khhh.map(k => `<option value="${esc(k.cif)}">${esc(k.ten)}</option>`).join('')}</datalist></label>
          <label class="fld"><span>Tên CN (mã chữ) *</span><input id="npCn" value="${esc(M.cn)}" placeholder="VD: HCM, TDC…"></label></div>
        <label class="fld" style="margin-top:8px"><span>Tên KHHH *</span><input id="npTen" value="${esc(M.tenKH)}" placeholder="Tên khách hàng đang vay"></label>
        <label class="fld" style="margin-top:8px"><span>MST KHHH</span><input id="npMst" value="${esc(M.mstKH)}"></label>
        <label class="fld" style="margin-top:8px"><span>Tệp 131/331 (PDF scan, ảnh, Excel — nhiều tệp cùng KHHH được)</span><input type="file" id="npFiles" multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.xlsx,.xls,.csv"></label>
        <div class="row"><label>Luồng đọc <select id="npWorkers"><option>2</option><option selected>4</option><option>6</option></select></label><button class="btn pri" id="npRead">Đọc tệp</button><button class="btn" id="npStop" style="display:none">Dừng</button></div>
        <div class="progress"><div id="npBar"></div></div><div id="npStatus" class="muted small" style="margin-top:4px"></div><div id="npMsg"></div></div>
      <div class="card"><h2>Đang có trong phiên nạp</h2>${N.batches.length ? N.batches.map(b => `<div class="row" style="margin-top:4px">${chip(b.tk || '?', 'info')} <b>${esc(b.file)}</b> <span class="muted">${esc(b.tenKH)} · ${b.rows.length} dòng</span></div>`).join('') + '<div class="row"><button class="btn sm" id="npNext">Tiếp → ② Duyệt</button><button class="btn sm ghost" id="npReset">Bỏ hết, nạp lại</button></div>' : '<p class="muted">Chưa đọc tệp nào.</p>'}
        <h3>Cách dùng</h3><ol class="small"><li>Chọn <b>CIF</b> (KHHH đã có tự điền tên) + <b>CN</b>, chọn tệp 131 và/hoặc 331.</li><li>Bấm <b>Đọc tệp</b> — PDF scan khoảng 20–60 giây/trang (lần đầu tải bộ đọc ~8 MB).</li>
        <li>② Soát dòng đỏ: 🖼 xem ảnh gốc, sửa ô.</li><li>③ Duyệt gợi ý gộp đối tác, kiểm/tra MST.</li><li>④ ${CN.store.canDirect() ? 'Lưu vào kho' : 'Gửi teamlead duyệt'}.</li></ol></div></div>`;
    $('npCif').onchange = () => { const k = CN.store.khByCif($('npCif').value.trim()); if (k) { $('npTen').value = k.ten || ''; $('npMst').value = k.mst || ''; if (!$('npCn').value) $('npCn').value = k.dvkd || ''; } };
    if ($('npNext')) $('npNext').onclick = () => goStep(2);
    if ($('npReset')) $('npReset').onclick = () => { N.batches = []; N.assign = null; render($('view')); };
    $('npStop').onclick = () => { if (N.readCtx) N.readCtx.stop = true; $('npStatus').textContent = 'Đang dừng sau trang hiện tại…'; };
    $('npRead').onclick = readFiles;
  }
  const isXlsx = f => /\.(xlsx|xlsm|xls|csv)$/i.test(f.name), isPdf = f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
  const dstr = v => { if (v instanceof Date) { const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000); return d.toISOString().slice(0, 10); } return String(v || '').slice(0, 10); };
  function sheetToWords(aoa) {
    const words = [], CW = 220, RH = 40;
    aoa.forEach((row, r) => (row || []).forEach((v, c) => {
      if (v === null || v === undefined || v === '') return;
      if (typeof v === 'number') { const s = (v < 0 ? '(' : '') + Math.abs(Math.round(v)).toLocaleString('vi-VN') + (v < 0 ? ')' : ''); words.push({ x: c * CW + CW - 10 - s.length * 9, y: r * RH, w: s.length * 9, h: 24, str: s }); }
      else { const t = String(v).replace(/\s+/g, ' ').trim(); words.push({ x: c * CW + 6, y: r * RH, w: Math.min(t.length * 9, CW - 12), h: 24, str: t }); }
    }));
    return words;
  }
  function readTongHopTemplate(aoa) {
    const hi = aoa.findIndex(r => (r || []).some(v => /tên kh \(ra\/vào\)|chi nhánh gd khhh/i.test(String(v))));
    if (hi < 0) return null;
    const groups = new Map();
    aoa.slice(hi + 1).forEach(r => {
      if (!r || !r[5] || /minh họa/i.test(String(r[2]) + String(r[5]))) return;
      const ky = r[3] instanceof Date ? dstr(r[3]) : String(r[3] || ''), tk = String(r[4] || '').trim(), k = [r[1], r[2], tk, ky].join('|');
      if (!groups.has(k)) groups.set(k, { cn: r[1], tenKH: r[2], tk, ky, rows: [] });
      const vals = [6, 7, 8, 9, 10, 11].map(c => (r[c] === '' || r[c] == null ? 0 : +r[c]));
      groups.get(k).rows.push({ stt: groups.get(k).rows.length + 1, ma: '', ten: String(r[5]).trim(), tk, cells: vals.map(String), vals, status: vals.map(() => 'ok'), page: 1, bandTop: 0, bandBot: 0 });
    });
    return [...groups.values()];
  }
  function newBatch(file, meta, pages) {
    const h = pages.map(p => p.header || {}).find(x => x.tk || x.ky) || {};
    const rows = []; let total = null;
    pages.forEach(p => { (p.rows || []).forEach(r => rows.push(Object.assign({ page: p.no }, r, { del: false }))); if (p.total) total = Object.assign({ page: p.no }, p.total); });
    return { id: 'B' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), file: file.name, cn: meta.cn, cif: meta.cif, tenKH: meta.tenKH, mstKH: meta.mstKH,
      tk: h.tk ? String(h.tk).slice(0, 3) : (h.loai || ''), ky: h.ky || '', kyGoc: h.kyGoc || (h.tu && h.den ? h.tu + ' → ' + h.den : (h.ky || '')), pages, rows, total,
      warn: pages.flatMap(p => (p.warn || []).map(w => (pages.length > 1 ? 'Trang ' + p.no + ': ' : '') + w)) };
  }
  async function readOne(file, meta, onStatus, ctx) {
    const pages = [];
    if (isXlsx(file)) {
      await CNLoad.ensureXlsx();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      for (const name of wb.SheetNames) {
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
        const tpl = readTongHopTemplate(aoa);
        if (tpl) return tpl.map(g => newBatch(file, Object.assign({}, meta, { cn: meta.cn || g.cn, tenKH: g.tenKH || meta.tenKH }), [{ no: 1, header: { tk: g.tk, ky: /^\d{4}-\d\d-\d\d$/.test(g.ky) ? g.ky : null, kyGoc: g.ky }, rows: g.rows, total: null, warn: [] }]));
        const words = sheetToWords(aoa), L = P131.layout(words, { pageW: 6000 });
        if (L.colR.length < 6 || !L.rows.length) continue;
        P131.columnOffsets(L, words);
        const fw = P131.cellsFromWords(L, words);
        const rows = L.rows.map((r, i) => Object.assign({}, r, P131.resolveRow([fw.rows[i]])));
        const total = L.total ? Object.assign({}, L.total, P131.resolveTotal([fw.total], rows)) : null;
        pages.push({ no: 1, sheet: name, header: L.header, rows, total, warn: L.warn });
        break;
      }
      if (!pages.length) throw new Error('Không nhận ra bảng tổng hợp công nợ (cần 6 cột Nợ/Có) trong ' + file.name + '.');
    } else {
      await CNLoad.ensureOcr(onStatus);
      initPdfJs();
      const sched = await initTesseract(ctx.workers, onStatus), dsched = await digitScheduler(ctx.workers, onStatus);
      const srcs = [];
      if (isPdf(file)) {
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true }).promise;
        for (let no = 1; no <= pdf.numPages; no++) srcs.push({ pdf, no });
        ctx.pdfs.push(pdf);
      } else {
        const bmp = await createImageBitmap(file), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0); bmp.close(); srcs.push({ canvas: c, no: 1 });
      }
      let hint = null;
      for (const s of srcs) {
        if (ctx.stop) break;
        const pr = await readPage(s, { sched, dsched, hint, onStatus: m => onStatus('Trang ' + s.no + '/' + srcs.length + ': ' + m) });
        hint = pr.rot; delete pr.words; delete pr.cellReads;
        pages.push(pr);
      }
    }
    return [newBatch(file, meta, pages)];
  }
  async function readFiles() {
    const files = [...$('npFiles').files];
    N.meta = { cn: $('npCn').value.trim(), cif: $('npCif').value.trim(), tenKH: $('npTen').value.trim(), mstKH: $('npMst').value.trim() };
    const miss = []; if (!N.meta.cif) miss.push('CIF KHHH'); if (!N.meta.cn) miss.push('Tên CN'); if (!N.meta.tenKH) miss.push('Tên KHHH'); if (!files.length) miss.push('tệp 131/331');
    if (miss.length) { $('npMsg').innerHTML = '<div class="alert warn">Cần nhập: ' + miss.join(', ') + '.</div>'; return; }
    if (N.batches.some(b => b.cif !== N.meta.cif)) { $('npMsg').innerHTML = '<div class="alert warn">Phiên nạp đang có tệp của KHHH khác — lưu hoặc "Bỏ hết" trước khi nạp KHHH mới.</div>'; return; }
    $('npRead').disabled = true; $('npStop').style.display = ''; $('npMsg').innerHTML = '';
    const ctx = { workers: +$('npWorkers').value || 4, stop: false, pdfs: [] }; N.readCtx = ctx;
    const t0 = performance.now(); let n = 0;
    try {
      for (const f of files) {
        if (ctx.stop) break;
        const st = m => { $('npStatus').textContent = 'Tệp ' + (n + 1) + '/' + files.length + ' · ' + m; $('npBar').style.width = Math.round(100 * n / files.length) + '%'; };
        st('bắt đầu…');
        (await readOne(f, N.meta, st, ctx)).forEach(b => N.batches.push(b)); n++;
      }
      $('npBar').style.width = '100%';
      const sec = Math.round((performance.now() - t0) / 1000);
      window.__lastRead = { files: n, seconds: sec, batches: N.batches.length };
      N.assign = null; CN.ui.toast('Đã đọc ' + n + ' tệp trong ' + sec + ' giây', 'ok');
      goStep(2);
    } catch (err) {
      console.error(err); $('npMsg').innerHTML = '<div class="alert err">Lỗi khi đọc: ' + esc(err.message) + '</div>'; window.__lastRead = { error: err.message };
    } finally { ctx.pdfs.forEach(d => { try { d.destroy(); } catch (e) {} }); if ($('npRead')) { $('npRead').disabled = false; $('npStop').style.display = 'none'; } }
  }

  /* ================= ② Duyệt số liệu ================= */
  const LBL = () => P131.COL_LABEL;
  function recalc(r) { r.vals = r.cells.map(c => P131.parseNum(c).v); const d = r.vals.some(v => v === null) ? null : r.vals.reduce((s, v, i) => s + P131.SIGN[i] * v, 0); r.diff = d; r.bal = d === null ? 'thieu' : d === 0 ? 'ok' : 'lech'; }
  function batchStats(b) {
    const live = b.rows.filter(r => !r.del), ok = live.filter(r => r.bal === 'ok').length;
    let tot = null;
    if (b.total) { const sums = P131.COLS.map((_, i) => live.reduce((s, r) => s + (r.vals[i] || 0), 0)); tot = sums.map((s, i) => ({ s, t: b.total.vals[i], ok: b.total.vals[i] === s })); }
    return { n: live.length, ok, tot };
  }
  function step2(box) {
    if (!N.batches.length) { box.innerHTML = '<div class="alert info">Chưa có tệp nào. Quay lại ① để nạp.</div>'; return; }
    box.innerHTML = N.batches.map((b, bi) => {
      const st = batchStats(b);
      const totHtml = st.tot ? `<tr class="tot"><td colspan="3"><b>TỔNG CỘNG (trên báo cáo)</b></td>${st.tot.map(t => `<td class="num ${t.ok ? '' : 'bad'}" title="Tổng các dòng: ${fmt(t.s)}">${fmt(t.t)}${t.ok ? ' ✓' : '<br><small>tổng dòng ' + fmt(t.s) + '</small>'}</td>`).join('')}<td colspan="2"></td></tr>` : '';
      return `<div class="card batch" data-b="${bi}"><h2>${chip(b.tk || '?', 'info')} ${esc(b.file)} ${chip(st.ok + '/' + st.n + ' dòng cân đối', st.ok === st.n ? 'ok' : 'warn')}${st.tot ? chip('Dòng tổng: ' + st.tot.filter(t => t.ok).length + '/6 cột khớp', st.tot.every(t => t.ok) ? 'ok' : 'err') : chip('Không thấy dòng tổng', 'err')}</h2>
        <div class="row"><label>TK <select data-f="tk"><option ${b.tk === '131' ? 'selected' : ''}>131</option><option ${b.tk === '331' ? 'selected' : ''}>331</option></select></label>
          <label>Kỳ (ngày cuối kỳ) <input type="date" data-f="ky" value="${esc(b.ky)}"></label><label>Kỳ gốc <input data-f="kyGoc" value="${esc(b.kyGoc)}" style="width:220px"></label>
          <span class="muted">KHHH: <b>${esc(b.tenKH)}</b> · CIF ${esc(b.cif)} · CN ${esc(b.cn)}</span><button class="btn sm ghost" data-act="delBatch">Bỏ tệp này</button></div>
        ${b.warn.length ? '<div class="alert warn">' + b.warn.map(esc).join('<br>') + '</div>' : ''}
        ${!b.tk || !b.ky ? '<div class="alert warn">Chưa nhận được ' + [!b.tk ? 'tài khoản (131/331)' : '', !b.ky ? 'kỳ' : ''].filter(Boolean).join(' và ') + ' từ tiêu đề — nhập tay ở trên.</div>' : ''}
        <div class="tblwrap"><table class="tbl rev"><thead><tr><th>#</th><th>Mã nội bộ</th><th>Tên đối tác (theo báo cáo)</th>${LBL().map(l => `<th class="num">${l}</th>`).join('')}<th>Cân đối</th><th></th></tr></thead>
        <tbody>${b.rows.map((r, ri) => rowHtml(b, r, ri)).join('')}${totHtml}</tbody></table></div>
        <div class="row"><button class="btn sm" data-act="addRow">+ Thêm dòng</button><span class="muted small">Ô đỏ = máy đọc chưa chắc. 🖼 xem ảnh dòng gốc. Dòng chưa cân đối vẫn lưu được nhưng ghi "Chưa cân".</span></div></div>`;
    }).join('') + '<div class="row end"><button class="btn" id="npBack1">‹ Nạp thêm tệp</button><button class="btn pri" id="npToMap">Xác nhận số liệu → ③ Đối tác</button></div>';
    bindReview(box);
    $('npBack1').onclick = () => goStep(1);
    $('npToMap').onclick = () => { N.assign = null; goStep(3); };
  }
  function rowHtml(b, r, ri) {
    if (r.del) return `<tr class="deleted" data-r="${ri}"><td>${ri + 1}</td><td colspan="9" class="muted">Đã bỏ dòng: ${esc(r.ten)}</td><td><button class="btn sm" data-act="undel">Khôi phục</button></td></tr>`;
    const fix = P131.suggestFix(r), L = LBL();
    const cells = r.cells.map((c, i) => `<td class="num"><input class="${r.bal !== 'ok' && (r.status[i] === 'bad' || (r.disagree && r.disagree[i])) ? 'sus' : ''}" data-c="${i}" value="${esc(r.vals[i] === null ? c : fmt(r.vals[i]))}"></td>`).join('');
    const balTxt = r.bal === 'ok' ? '<span class="okc">✓</span>' : r.bal === 'thieu' ? '<span class="errc">ô lỗi</span>' : `<span class="errc">lệch ${fmt(r.diff)}</span>`;
    return `<tr data-r="${ri}" class="${r.bal === 'ok' ? '' : 'flag'}"><td>${r.stt ?? ri + 1}${b.pages.length > 1 ? '<br><small class="muted">tr.' + r.page + '</small>' : ''}</td>
      <td><input data-f="ma" value="${esc(r.ma || '')}" style="width:90px"></td><td><input data-f="ten" value="${esc(r.ten || '')}" style="min-width:240px"></td>${cells}
      <td>${balTxt}${fix ? `<br><button class="btn sm" data-act="fix" data-col="${fix.col}" data-v="${fix.value}" title="Giá trị làm dòng cân đối — chỉ chọn khi ảnh gốc đúng như vậy">Sửa ${L[fix.col]} = ${fmt(fix.value)}?</button>` : ''}</td>
      <td style="white-space:nowrap">${b.pages[0] && b.pages[0].thumb ? '<button class="btn sm" data-act="img" title="Xem ảnh dòng gốc">🖼</button>' : ''}<button class="btn sm ghost" data-act="del" title="Bỏ dòng">✕</button></td></tr>
      <tr class="imgrow" data-img="${ri}" style="display:none"><td colspan="11"><canvas></canvas></td></tr>`;
  }
  function bindReview(box) {
    const again = () => step2(box);
    box.querySelectorAll('.batch').forEach(card => {
      const b = N.batches[+card.dataset.b];
      card.querySelectorAll('[data-f]').forEach(inp => { if (inp.closest('tr')) return; inp.onchange = () => { b[inp.dataset.f] = inp.value; N.assign = null; if (inp.dataset.f !== 'kyGoc') again(); }; });
      card.querySelector('[data-act=delBatch]').onclick = () => { N.batches.splice(+card.dataset.b, 1); N.assign = null; again(); };
      card.querySelector('[data-act=addRow]').onclick = () => { b.rows.push({ stt: b.rows.length + 1, ma: '', ten: '', cells: Array(6).fill('0'), vals: Array(6).fill(0), status: Array(6).fill('ok'), bal: 'ok', diff: 0, page: 1, manual: true }); again(); };
      card.querySelectorAll('tbody tr[data-r]').forEach(tr => {
        const r = b.rows[+tr.dataset.r];
        tr.querySelectorAll('input[data-c]').forEach(inp => inp.onchange = () => { r.cells[+inp.dataset.c] = inp.value; r.status[+inp.dataset.c] = 'ok'; r.edited = true; recalc(r); again(); });
        tr.querySelectorAll('input[data-f]').forEach(inp => inp.onchange = () => { r[inp.dataset.f] = inp.value; r.edited = true; N.assign = null; });
        const act = (a, f) => { const el = tr.querySelector('[data-act=' + a + ']'); if (el) el.onclick = f; };
        act('del', () => { r.del = true; N.assign = null; again(); });
        act('undel', () => { r.del = false; N.assign = null; again(); });
        act('fix', e => { const c = +e.target.dataset.col; r.cells[c] = e.target.dataset.v; r.edited = true; recalc(r); again(); });
        act('img', () => showRowImg(b, r, card.querySelector('tr[data-img="' + tr.dataset.r + '"]')));
      });
    });
  }
  function showRowImg(b, r, tr) {
    if (tr.style.display !== 'none') { tr.style.display = 'none'; return; }
    const p = b.pages.find(x => x.no === r.page) || b.pages[0]; if (!p || !p.thumb) return;
    const img = new Image(); img.onload = () => {
      const k = p.thumbK, y0 = Math.max(0, (r.bandTop - 6) * k), y1 = Math.min(img.height, (r.bandBot + 6) * k), c = tr.querySelector('canvas');
      c.width = img.width; c.height = Math.max(10, y1 - y0); c.getContext('2d').drawImage(img, 0, y0, img.width, y1 - y0, 0, 0, img.width, y1 - y0); c.style.maxWidth = '100%'; tr.style.display = '';
    }; img.src = p.thumb;
  }

  /* ================= ③ Đối tác & MST (gồm UI tên pháp lý D11 của v0.1) ================= */
  const liveRows = () => N.batches.flatMap(b => b.rows.filter(r => !r.del && (r.ten || '').trim()).map(r => ({ b, r })));
  function buildAssign() {
    const uniq = new Map();
    liveRows().forEach(({ b, r }) => { const raw = r.ten.trim(); if (!uniq.has(raw)) uniq.set(raw, { raw, n: 0, kh: new Set(), tk: new Set() }); const u = uniq.get(raw); u.n++; u.kh.add(b.tenKH); u.tk.add(b.tk); });
    const names = [...uniq.values()], K = kho(), thr = +(CN.store.S.data.config['Ngưỡng gợi ý gộp tên'] || 0.85);
    const res = MAP131.assign(names.map(x => ({ raw: x.raw })), K, { suggest: thr });
    const prev = N.assign ? new Map(N.assign.map(a => [a.raw, a])) : new Map();
    N.assign = res.map((a, i) => {
      const p = prev.get(a.raw), d = K.doiTac.find(x => x.id === a.id);
      const base = Object.assign(a, { n: names[i].n, kh: [...names[i].kh], tk: [...names[i].tk], choice: a.kind === 'goi-y' ? 'new' : null, ten: d ? d.ten : a.raw, mst: d ? d.mst : '', ttMst: d ? d.ttMst : '', nguonMst: d ? d.nguonMst : '' });
      if (p) Object.assign(base, { choice: p.choice, ten: p.ten, tenSua: p.tenSua, tenNote: p.tenNote, mst: p.mst, ttMst: p.ttMst, nguonMst: p.nguonMst, mstCands: p.mstCands, intAuto: p.intAuto, intNone: p.intNone, cif: p.cif });
      return base;
    });
    N.intRun = false; N.intRes = null;   // danh sách tên đổi → tra nội bộ lại cho dòng chưa có MST
  }
  const KIND = { alias: ['Tên gộp đã duyệt', 'ok'], mst: ['Trùng MST', 'ok'], 'trung-ten': ['Trùng tên chuẩn hóa', 'ok'], 'goi-y': ['Gợi ý — chờ duyệt', 'warn'], moi: ['Đối tác mới', 'info'], 'ca-nhan': ['Cá nhân? — không tra ngoài', 'warn'] };
  const finalId = a => (a.kind === 'goi-y' && a.choice && a.choice !== 'new' ? a.choice : a.id);
  const isExisting = a => !!CN.store.dtById(finalId(a));
  const khoTen = a => (CN.store.dtById(finalId(a)) || {}).ten || '';
  const curTen = a => (a.tenSua || !isExisting(a) ? a.ten : khoTen(a) || a.ten) || '';
  function setTenFrom(a, name, src) {
    name = String(name || '').trim(); if (!name) return;
    const cur = curTen(a);
    if (cur.trim() === name) { a.tenNote = { src, same: true }; return; }
    if (isExisting(a) && !a.tenSua) { a.tenNote = { src, nu: name, old: cur, applied: false }; return; }
    a.tenNote = { src, nu: name, old: cur, applied: true }; a.ten = name; a.tenSua = true;
  }
  function step3(box) {
    if (!N.assign) buildAssign();
    const cnt = k => N.assign.filter(a => a.kind === k).length;
    box.innerHTML = `<div class="card"><h2>Tra MST</h2>
        <div class="row"><b>① Nội bộ TPBank (tra trước):</b><span id="npInt" class="small">${esc(intStatus())}</span><button class="btn sm" id="npIntAll">Tra lại nội bộ</button></div>
        <div class="row"><b>② Công cụ ngoài</b> <span class="muted small">— chỉ cho tên nội bộ không ra hoặc để kiểm trạng thái hoạt động.</span></div>
        <div class="row"><label>Khóa doanhnghiep.vn (miễn phí 1.000 lượt/tháng, lưu trên máy này) <input id="npDnKey" type="password" style="width:260px" value="${esc(CN.mst.key())}"></label><span id="npQuota" class="muted small"></span></div>
        <div class="row"><button class="btn" id="npVqrAll">Kiểm tất cả MST đã có (VietQR)</button><button class="btn" id="npDnAll">Tìm MST theo tên cho đối tác mới (doanhnghiep.vn)</button><span id="npMstSt" class="muted small"></span></div>
        <p class="muted small">Tra nội bộ chạy ngay trên máy này (không gửi tên đi đâu); chỉ tự điền khi khớp chắc chắn, còn lại hiện ứng viên để chọn. Công cụ ngoài chỉ nhận MST hoặc tên pháp nhân của đối tác — không gửi tên KHHH, số tiền, cá nhân.</p></div>
      <div class="card"><h2>Đối tác ${chip(N.assign.length + ' tên', 'gray')}${Object.keys(KIND).filter(cnt).map(k => chip(KIND[k][0] + ': ' + cnt(k), KIND[k][1])).join('')}${chip(N.assign.filter(a => a.mst).length + ' có MST', 'gray')}</h2>
        <div class="tblwrap"><table class="tbl map"><thead><tr><th>Tên đối tác (gốc)</th><th>Dòng · TK</th><th>Kết quả</th><th>Mã</th><th>Tên pháp lý (chuẩn)</th><th>MST</th><th>Tra MST</th></tr></thead><tbody>${N.assign.map(mapRow).join('')}</tbody></table></div>
        ${CN.store.canDirect() ? '' : '<p class="muted small">Sửa tên/MST của đối tác <b>đã có trong kho</b> sẽ thành yêu cầu chờ teamlead duyệt.</p>'}</div>
      <div class="row end"><button class="btn" id="npBack2">‹ ② Duyệt số liệu</button><button class="btn pri" id="npToSave">Tiếp → ④ ${CN.store.canDirect() ? 'Lưu' : 'Gửi duyệt'}</button></div>`;
    bindMap(box);
    $('npIntAll').onclick = () => runInternal(box, true);
    if (!N.intRun) { N.intRun = true; runInternal(box, false); }
    $('npDnKey').onchange = () => CN.mst.setKey($('npDnKey').value.trim());
    $('npVqrAll').onclick = async () => {
      const list = N.assign.filter(a => a.mst && !a.caNhan && a.kind !== 'ca-nhan' && !/VietQR/.test(a.nguonMst || ''));
      for (let i = 0; i < list.length; i++) { $('npMstSt').textContent = 'Kiểm MST ' + (i + 1) + '/' + list.length + '…'; await mstVerify(list[i]); }
      step3(box); $('npMstSt').textContent = 'Đã kiểm ' + list.length + ' MST.';
    };
    $('npDnAll').onclick = async () => {
      const list = N.assign.filter(a => !a.mst && !a.caNhan && a.kind !== 'ca-nhan' && !isExisting(a));
      if (list.length > 60) { const r = await CN.ui.ask('Tra ' + list.length + ' tên?', '<p>Sẽ dùng ' + list.length + ' lượt (1.000 lượt/tháng).</p>', { yes: 'Tra' }); if (!r.ok) return; }
      for (let i = 0; i < list.length; i++) { $('npMstSt').textContent = 'Tìm MST ' + (i + 1) + '/' + list.length + '…'; await mstSearch(list[i]); }
      step3(box); $('npMstSt').textContent = 'Xong — chọn ứng viên đúng ở từng dòng (máy không tự gán).';
    };
    $('npBack2').onclick = () => goStep(2);
    $('npToSave').onclick = () => goStep(4);
  }
  /* ---- Tra nội bộ TPBank (CN.mstidx) — trước công cụ ngoài ---- */
  const VN_RE = /[À-ỹĐđ]/;
  const tra = a => !a.caNhan && a.kind !== 'ca-nhan';
  function intStatus() {
    const st = CN.mstidx.state, R = N.intRes;
    if (N.intBusy) return N.intMsg || st.msg || 'Đang tra…';
    if (R) return `${R.n} tên chưa có MST → tự điền ${R.auto} · có ứng viên ${R.cand} · không ra ${R.none}` + (R.cif ? ` · ${R.cif} đối tác là KH TPBank (CIF)` : '');
    return st.status === 'off' || st.status === 'error' ? st.msg : 'chưa tra';
  }
  function applyInternal(a, r) {
    a.intNone = false;
    if (r.auto) {
      const c = r.cands[0];
      a.mst = c.mst; a.ttMst = ''; a.nguonMst = CN.mstidx.label(); a.intAuto = { mst: c.mst, score: c.score }; a.mstCands = null;
      if (VN_RE.test(c.name)) setTenFrom(a, c.name, 'Nội bộ TPBank');
    } else if (r.cands.length) {
      a.mstCands = r.cands.map(c => ({ mst: c.mst, name: c.name, address: c.branch ? 'chi nhánh' : '', status: '', src: CN.mstidx.label(), srcName: 'Nội bộ TPBank', score: c.score }));
    } else a.intNone = true;
  }
  async function cifAll() {
    const ms = N.assign.filter(a => a.mst && tra(a)).map(a => a.mst);
    if (!ms.length) return 0;
    const r = await CN.mstidx.cif(ms, 'Nạp dữ liệu');
    N.assign.forEach(a => { a.cif = (a.mst && r.map[a.mst]) || null; });
    return N.assign.filter(a => a.cif).length;
  }
  async function runInternal(box, force) {
    if (N.intBusy) return;
    const list = N.assign.filter(a => tra(a) && (!a.mst || (force && a.intAuto && a.mst === a.intAuto.mst)));
    N.intBusy = true; N.intMsg = '';
    const paint = () => { if ($('npInt')) $('npInt').textContent = intStatus(); };
    const off = CN.mstidx.on(paint);
    let changed = false;
    try {
      paint();
      const res = list.length ? await CN.mstidx.search(list.map(a => curTen(a) || a.raw), p => { N.intMsg = `Đang tra nội bộ ${Math.round(100 * p)}% (${list.length} tên)…`; paint(); }, 'Nạp dữ liệu') : [];
      if (res === null) { N.intRes = null; return; }
      res.forEach((r, i) => applyInternal(list[i], r));
      N.intRes = { n: list.length, auto: res.filter(r => r.auto).length, cand: res.filter(r => !r.auto && r.cands.length).length, none: res.filter(r => !r.cands.length).length, cif: 0 };
      N.intRes.cif = await cifAll();
      changed = true;
    } catch (e) { CN.ui.toast('Tra nội bộ: ' + e.message, 'err'); }
    finally {
      off(); N.intBusy = false;
      if (changed && N.step === 3 && $('npInt')) step3(box); else paint();   // chưa có chỉ mục → chỉ đổi dòng trạng thái, không vẽ lại bảng
    }
  }
  async function intOne(a) {
    try {
      const res = await CN.mstidx.search([curTen(a) || a.raw], null, 'Nạp dữ liệu (1 tên)');
      if (res === null) { CN.ui.toast(CN.mstidx.state.msg, 'err'); return; }
      applyInternal(a, Object.assign({}, res[0], { auto: false }));   // tra lại 1 dòng: luôn để người chọn
      if (!res[0].cands.length) CN.ui.toast('Nội bộ không có tên này — thử "Tìm theo tên" (doanhnghiep.vn)');
    } catch (e) { CN.ui.toast(e.message, 'err'); }
  }

  function tenCell(a, ex) {
    const v = curTen(a), nt = a.tenNote;
    const note = !nt ? '' : nt.same ? `<div class="tnote okc">✓ Tên khớp ${esc(nt.src)}</div>`
      : nt.applied ? `<div class="tnote">⚠ Tên đã cập nhật theo dữ liệu ${esc(nt.src)} · tên trước: <i>${esc(nt.old)}</i> <button class="btn sm" data-act="undoTen">Hoàn tác</button></div>`
      : `<div class="tnote">⚠ ${esc(nt.src)}: <b>${esc(nt.nu)}</b> — khác tên trong kho <button class="btn sm" data-act="useTen">Dùng tên này</button></div>`;
    return `<textarea data-f="ten" rows="${Math.max(1, Math.ceil(v.length / 48))}" spellcheck="false" title="${ex ? 'Đối tác đã có trong kho — sửa ở đây sẽ cập nhật tên pháp lý (User: thành yêu cầu chờ duyệt)' : 'Tên pháp lý — sửa trực tiếp'}">${esc(v)}</textarea>${note}`;
  }
  function mapRow(a, i) {
    const fid = finalId(a), ex = isExisting(a), ca = a.caNhan || a.kind === 'ca-nhan', d = CN.store.dtById(fid);
    const sugg = a.kind === 'goi-y' ? `<div class="sugg">${a.cand.map(c => `<label><input type="radio" name="g${i}" value="${esc(c.id)}" ${a.choice === c.id ? 'checked' : ''}> Gộp vào ${CN.store.dtById(c.id) ? '<b>' + esc(c.id) + '</b> ' : ''}${esc(c.ten)} <small class="muted">(${CN.store.dtById(c.id) ? '' : 'đối tác mới trong lô này · '}${esc(c.why)})</small></label>`).join('')}<label><input type="radio" name="g${i}" value="new" ${a.choice === 'new' ? 'checked' : ''}> Giữ là đối tác mới</label></div>` : '';
    const mc = (a.mstCands || []).map((c, j) => `<div class="mc">${c.status && !/dang hoat dong|đang hoạt động/i.test(c.status) ? '⚠ ' : ''}${c.srcName ? chip('Nội bộ ' + Math.round(100 * c.score) + '%', c.score >= 0.86 ? 'ok' : 'gray') + ' ' : ''}<b>${esc(c.mst)}</b> ${esc(c.name)} <small class="muted">${esc(c.address || '')} ${esc(c.status || '')}</small> <button class="btn sm" data-act="pickMst" data-j="${j}">Chọn</button></div>`).join('');
    const intChip = (a.intAuto && a.mst === a.intAuto.mst ? '<br>' + chip('MST tự điền (nội bộ ' + Math.round(100 * a.intAuto.score) + '%)', 'ok') : '')
      + (a.cif ? '<br>' + chip('KH TPBank · CIF ' + a.cif.cif + (a.cif.via === 'cty-me' ? ' (cty mẹ)' : ''), 'ok') : '') + (a.intNone && !a.mst ? '<br>' + chip('Nội bộ không có', 'gray') : '');
    const st = a.ttMst ? `<div class="${/hoạt động/i.test(a.ttMst) && !/ngừng|tạm|bỏ địa chỉ|giải thể|không hoạt động/i.test(a.ttMst) ? 'okc' : 'errc'}"><small>${esc(a.ttMst)}${a.nguonMst ? ' · ' + esc(a.nguonMst) : ''}</small></div>` : '';
    return `<tr data-i="${i}"><td>${esc(a.raw)}${sugg}</td><td><small>${a.n} dòng · TK ${esc(a.tk.join('/'))}</small></td>
      <td>${chip(KIND[a.kind] ? KIND[a.kind][0] : a.kind, KIND[a.kind] ? KIND[a.kind][1] : 'gray')}${ca && a.kind !== 'ca-nhan' ? '<br>' + chip('Cá nhân?', 'warn') : ''}${intChip}</td>
      <td class="code">${ex ? esc(fid) + '<br><small class="muted">đã có trong kho</small>' : '<small class="muted">mã mới<br>(cấp khi lưu)</small>'}${d && d.status === 'Chờ duyệt' ? '<br>' + chip('chờ duyệt', 'warn') : ''}</td>
      <td class="ten">${tenCell(a, ex)}</td>
      <td><input data-f="mst" value="${esc(a.mst || '')}" style="width:130px" ${ex && d && d.mst ? 'disabled title="Sửa MST đối tác đã có ở trang Đối tác"' : ''}>${st}</td>
      <td style="white-space:nowrap">${ca ? '<small class="muted">Không tra (cá nhân)</small>' : '<button class="btn sm" data-act="int" title="Tìm MST theo tên trong file nội bộ TPBank (tra tại máy)">Nội bộ</button> <button class="btn sm" data-act="vqr" title="MST → tên pháp lý + trạng thái (VietQR)">Kiểm MST</button> <button class="btn sm" data-act="dn" title="Tìm MST theo tên (doanhnghiep.vn, cần khóa)">Tìm theo tên</button> <button class="btn sm ghost" data-act="web" title="Mở trang tìm kiếm">Web</button>'}${mc ? '<div>' + mc + '</div>' : ''}</td></tr>`;
  }
  function bindMap(box) {
    const again = () => step3(box);
    box.querySelectorAll('table.map tbody tr[data-i]').forEach(tr => {
      const a = N.assign[+tr.dataset.i];
      const act = (n, f) => { const el = tr.querySelector('[data-act=' + n + ']'); if (el) el.onclick = f; };
      tr.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => { a.choice = r.value; again(); });
      tr.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => {
        const v = inp.value.replace(/\s+/g, ' ').trim();
        if (inp.dataset.f === 'ten') { if (v === curTen(a)) return; a.ten = v; a.tenSua = true; a.tenNote = null; again(); return; }
        a[inp.dataset.f] = v; if (inp.dataset.f === 'mst') { a.ttMst = ''; a.nguonMst = 'nhập tay'; a.intAuto = null; a.cif = null; }
      });
      const ta = tr.querySelector('textarea[data-f=ten]');
      if (ta) ta.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ta.blur(); } };
      act('undoTen', () => { const nt = a.tenNote; a.ten = nt.old; a.tenSua = !isExisting(a) || nt.old !== khoTen(a); a.tenNote = null; again(); });
      act('useTen', () => { const nt = a.tenNote; a.ten = nt.nu; a.tenSua = true; a.tenNote = Object.assign({}, nt, { applied: true }); again(); });
      act('vqr', async () => { const r = await mstVerify(a); if (r && !r.ok) CN.ui.toast(r.err, 'err'); again(); });
      act('dn', async () => { await mstSearch(a); again(); });
      act('int', async () => { await intOne(a); again(); });
      act('web', () => window.open('https://masothue.com/Search/?q=' + encodeURIComponent(curTen(a) || a.raw) + '&type=auto', '_blank', 'noopener'));
      tr.querySelectorAll('[data-act=pickMst]').forEach(btn => btn.onclick = async () => {
        const c = a.mstCands[+btn.dataset.j]; a.mst = c.mst; a.ttMst = c.status || ''; a.nguonMst = c.src; a.intAuto = null; a.intNone = false;
        if (!c.srcName || VN_RE.test(c.name)) setTenFrom(a, c.name, c.srcName || 'doanhnghiep.vn');   // tên nội bộ không dấu → không ghi đè tên
        a.mstCands = null;
        try { const r = await CN.mstidx.cif([a.mst], 'Nạp dữ liệu (chọn MST)'); a.cif = r.map[a.mst] || null; } catch (e) { a.cif = null; }
        again();
      });
    });
  }
  async function mstVerify(a) {
    const r = await CN.mst.vietqr(a.mst);
    if (!r.ok) { a.ttMst = '⚠ ' + r.err; a.nguonMst = 'VietQR'; return r; }
    a.mst = r.mst; a.ttMst = r.status || ''; a.nguonMst = r.src;
    setTenFrom(a, r.name, 'VietQR');
    return r;
  }
  async function mstSearch(a) {
    const r = await CN.mst.search(curTen(a) || a.raw);
    if (r.remain && $('npQuota')) $('npQuota').textContent = 'còn ' + r.remain + ' lượt tháng này';
    if (!r.ok) { a.mstCands = []; a.ttMst = '⚠ ' + r.err; return; }
    a.mstCands = r.cands; if (!r.cands.length) a.ttMst = '⚠ không có ứng viên';
  }

  /* ================= ④ Lưu / Gửi duyệt ================= */
  function payload() {
    const parts = new Map(), idOf = new Map();
    N.assign.forEach(a => {
      const cid = finalId(a), ex = isExisting(a); idOf.set(a.raw, cid);
      if (!parts.has(cid)) parts.set(cid, { cid, isNew: !ex, mst: a.mst || '', ten: curTen(a), caNhan: !!(a.caNhan || a.kind === 'ca-nhan'), ttMst: /^⚠/.test(a.ttMst || '') ? '' : (a.ttMst || ''), nguonMst: a.nguonMst || '', tenSua: !!a.tenSua, aliases: [] });
      const p = parts.get(cid);
      if (a.tenSua) { p.tenSua = true; p.ten = curTen(a); }
      if (!p.mst && a.mst) p.mst = a.mst;
      p.aliases.push({ raw: a.raw, trangThai: a.kind === 'goi-y' ? 'Đã duyệt' : 'Máy gộp' });
    });
    const lots = N.batches.map(b => ({ cif: b.cif, tenKH: b.tenKH, mstKH: b.mstKH, cn: b.cn, tk: b.tk, ky: b.ky, kyGoc: b.kyGoc, file: b.file,
      rows: b.rows.filter(r => !r.del && (r.ten || '').trim()).map(r => ({ ma: r.ma || '', raw: r.ten.trim(), cid: idOf.get(r.ten.trim()), vals: r.vals.map(v => v || 0), bal: r.bal === 'ok' ? 'Cân' : 'Chưa cân', trang: r.page || 1, ghiChu: r.edited ? 'Người sửa tay' : '' })) }));
    return { lots, partners: [...parts.values()] };
  }
  function step4(box) {
    if (!N.assign) buildAssign();
    const S = CN.store.S, P = payload(), direct = CN.store.canDirect();
    const pend = N.assign.filter(a => a.kind === 'goi-y' && !a.choice).length;
    const unb = P.lots.reduce((s, l) => s + l.rows.filter(r => r.bal !== 'Cân').length, 0), noKy = P.lots.filter(l => !l.tk || !/^\d{4}-\d\d-\d\d$/.test(l.ky)).length;
    const dup = P.lots.map(l => S.data.lots.find(o => o.status === 'Đã duyệt' && o.cif === l.cif && o.tk === String(l.tk).slice(0, 3) && o.ky === l.ky)).filter(Boolean);
    const empty = P.lots.filter(l => !l.rows.length).length;
    const nNew = P.partners.filter(p => p.isNew).length, nEdit = P.partners.filter(p => !p.isNew && p.tenSua).length;
    box.innerHTML = `<div class="card"><h2>${direct ? 'Lưu vào kho dùng chung' : 'Gửi teamlead duyệt'}</h2>
      <div class="kpis">${CN.ui.kpi('Lô', P.lots.length, P.lots.map(l => l.tk + ' · ' + CN.ui.dt(l.ky)).join(' | '), 'pri')}${CN.ui.kpi('Dòng công nợ', P.lots.reduce((s, l) => s + l.rows.length, 0), unb ? unb + ' dòng chưa cân' : 'đều cân đối')}
        ${CN.ui.kpi('Đối tác mới', nNew, 'mã cấp khi lưu')}${CN.ui.kpi('Sửa đối tác đã có', nEdit, direct ? 'áp dụng ngay' : 'thành yêu cầu chờ duyệt')}</div>
      ${noKy ? `<div class="alert err">${noKy} tệp chưa có TK hoặc kỳ — quay lại ② nhập trước khi lưu.</div>` : ''}
      ${empty ? `<div class="alert err">${empty} tệp không còn dòng nào.</div>` : ''}
      ${unb ? `<div class="alert warn">${unb} dòng chưa cân đối — vẫn lưu, ghi "Chưa cân".</div>` : ''}
      ${pend ? `<div class="alert warn">${pend} gợi ý gộp chưa chọn → sẽ giữ là đối tác mới.</div>` : ''}
      ${dup.length ? `<div class="alert warn">Kho đã có lô cùng KHHH + TK + kỳ: ${dup.map(o => esc(o.id) + ' (' + esc(o.tk) + ' · ' + CN.ui.dt(o.ky) + ')').join('; ')} → ${direct ? 'lô mới sẽ THAY THẾ lô cũ ngay khi lưu' : 'lô mới thay thế lô cũ khi teamlead duyệt'} (lô cũ giữ lại để truy vết).</div>` : ''}
      <div class="row end"><button class="btn" id="npBack3">‹ ③ Đối tác</button><button class="btn org" id="npSave" ${noKy || empty ? 'disabled' : ''}>${direct ? 'Lưu vào kho' : 'Gửi teamlead duyệt'}</button></div><div id="npSaveMsg"></div></div>`;
    $('npBack3').onclick = () => goStep(3);
    $('npSave').onclick = async () => {
      $('npSave').disabled = true;
      try {
        CN.ui.busy(true, direct ? 'Đang lưu vào kho…' : 'Đang gửi duyệt…');
        const r = await CN.net.write('submit-batch', P, { timeoutMs: 120000 });
        window.__lastSubmit = r;
        N.batches = []; N.assign = null; N.step = 1;
        CN.ui.toast((direct ? 'Đã lưu ' : 'Đã gửi duyệt ') + r.lots.length + ' lô' + (r.newPartners.length ? ' · ' + r.newPartners.length + ' đối tác mới' : '') + (r.requests.length ? ' · ' + r.requests.length + ' yêu cầu sửa danh mục' : ''), 'ok');
        await CN.store.load();
        CN.go(direct ? 'khach-hang' : 'duyet', direct ? P.lots[0].cif : '');
      } catch (e) { CN.ui.toast(e.message, 'err'); $('npSaveMsg').innerHTML = `<div class="alert err">${esc(e.message)}</div>`; if ($('npSave')) $('npSave').disabled = false; }
      finally { CN.ui.busy(false); }
    };
  }

  CN.views.nap = { render, _state: N };
})();
