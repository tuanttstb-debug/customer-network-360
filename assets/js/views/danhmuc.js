'use strict';
/* Danh mục — tham số mô hình (Admin sửa) · danh mục KH TPBank · tên gộp · xuất dữ liệu · nhập kho v0.1 (1 lần) · nhật ký truy cập (Admin). */
(function () {
  CN.views = CN.views || {};
  const { esc, chip, table, fmt } = CN.ui;
  const PARAMS = [['Ngày báo cáo', 'date'], ['Ngày bắt đầu theo dõi', 'date'], ['Ngưỡng tập trung cao', 'num'], ['Ngưỡng tập trung theo dõi', 'num'], ['Ngưỡng suy giảm', 'num'],
    ['Benchmark quy mô quan hệ', 'num'], ['Benchmark BL còn hiệu lực', 'num'], ['Ngưỡng Opportunity P1', 'num'], ['Ngưỡng Opportunity P2', 'num'], ['Benchmark quy mô cơ hội', 'num'], ['Ngưỡng gợi ý gộp tên', 'num']];
  const act = async (action, payload, msg, after) => { try { CN.ui.busy(true, 'Đang lưu…'); const r = await CN.net.write(action, payload, { timeoutMs: 120000 }); CN.ui.toast(msg(r), 'ok'); await CN.refresh(true); if (after) after(r); } catch (e) { CN.ui.toast(e.message, 'err'); } finally { CN.ui.busy(false); } };

  /* ---- MST nội bộ TPBank (CN.mstidx · gas/Mst.gs) ---- */
  const PART = 3 * 1024 * 1024;
  const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const sha = async u8 => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map(b => b.toString(16).padStart(2, '0')).join('');
  function mstTab(box, admin) {
    box.innerHTML = `<div class="card"><h2>Chỉ mục MST nội bộ TPBank</h2>
      <p class="muted small">Tra MST theo tên trong file nội bộ TPBank <b>trước</b> khi dùng công cụ ngoài (bước ③ Nạp dữ liệu tự tra; trang Đối tác có nút "Tìm MST (nội bộ)").
      Chỉ mục tên → MST tải về máy này 1 lần cho mỗi phiên bản (không chứa CIF); CIF chỉ máy chủ tra và ghi nhật ký. <b>Dữ liệu nội bộ TPBank — không chụp/chia sẻ ra ngoài.</b></p>
      <div id="mstMeta" class="muted small">Đang tải…</div>
      <div class="row" style="margin-top:10px"><input id="mstQ" placeholder="Gõ tên doanh nghiệp để tra thử…" style="flex:1;min-width:240px"><button class="btn pri" id="mstGo">Tra</button><button class="btn" id="mstClr" title="Xóa bản chỉ mục đã tải trên máy này (lần tra sau tải lại)">Xóa khỏi máy này</button></div>
      <div id="mstSt" class="muted small"></div><div id="mstRes"></div></div>
      ${admin ? `<div class="card"><h2>Admin — tải chỉ mục lên / gỡ</h2><ol class="small"><li>Trên máy có file nội bộ: <code>python tools/build_mst_index.py "…\\TRA CUU MST.xlsx"</code> → thư mục <code>_build\\&lt;phiên bản&gt;</code> (ngoài repo).</li>
        <li>Chọn cùng lúc 3 tệp trong thư mục đó: <code>manifest.json</code> · <code>name_index.tsv.gz</code> · <code>cif_map.tsv.gz</code> → Tải lên (thay phiên bản cũ).</li></ol>
        <div class="row"><input type="file" id="mstFiles" multiple accept=".json,.gz"><button class="btn pri" id="mstUp" disabled>Tải lên</button><button class="btn danger" id="mstRm">Gỡ chỉ mục</button></div><div id="mstUpSt" class="small"></div></div>` : ''}`;
    const meta = () => CN.net.call('mst-meta').then(m => {
      if (!$('mstMeta')) return;
      const st = CN.mstidx.state;
      $('mstMeta').innerHTML = !m.version ? '<div class="alert warn">Chưa có chỉ mục trên máy chủ' + (admin ? ' — tải lên ở khung Admin bên dưới.' : ' — báo Admin.') + '</div>'
        : `<div class="kv"><b>Phiên bản</b><span class="code">${esc(m.version)}</span><b>Pháp nhân (tên → MST)</b><span>${fmt(m.counts.names)}</span><b>MST có CIF (chỉ máy chủ)</b><span>${fmt(m.counts.cif)}</span>
          <b>Dựng lúc</b><span>${esc(m.builtAt || '')}</span><b>Tải lên</b><span>${CN.ui.dt(m.uploadedAt)}${m.uploadedBy ? ' · ' + esc(m.uploadedBy) : ''}</span><b>Trên máy này</b><span>${esc(st.version === m.version ? st.msg : 'chưa tải (tải khi tra lần đầu, ~' + Math.round(m.name.bytes / 1e6) + ' MB)')}</span></div>`;
    }).catch(e => { if ($('mstMeta')) $('mstMeta').innerHTML = `<div class="alert err">${esc(e.message)}</div>`; });
    meta();
    const go = async () => {
      const q = $('mstQ').value.trim(); if (!q) return;
      const off = CN.mstidx.on(st => { if ($('mstSt')) $('mstSt').textContent = st.msg; });
      try {
        $('mstGo').disabled = true;
        // ① KH TPBank (KH line CB, so tên ở máy chủ) → ② 900k trên máy (dấu · viết tắt · lỗi chính tả) → MST
        const fk = await CN.mstidx.findKh(q, 'Danh mục (tra thử)');
        if (fk.items === null) { $('mstSt').textContent = 'Chưa có chỉ mục trên máy chủ.'; return; }
        const kh = fk.items, cs = (fk.cands || []).slice(0, 10), cif = cs.length ? (await CN.mstidx.cif(cs.map(c => c.mst), 'Danh mục (tra thử)')).map : {};
        $('mstSt').textContent = `KH TPBank: ${kh.length} · ứng viên 900k: ${fk.cands === null ? 'chưa có chỉ mục trên máy' : cs.length}` + (fk.idxErr ? ' · ' + fk.idxErr : '');
        const khTbl = kh.length ? `<h3>KH TPBank khớp</h3><div class="tblwrap"><table class="tbl" id="mstKhTbl"><thead><tr><th>CIF</th><th>Tên trên hệ thống TPB</th><th>Tên 900k</th><th>MST</th><th>CN</th><th>Khớp theo</th></tr></thead><tbody>${kh.map(k => `<tr><td class="code">${esc(k.cif)}</td><td>${esc(k.tenHT || '')}</td><td>${esc(k.ten900 || '—')}</td><td class="code">${esc(k.mst || '—')}</td><td>${esc(k.cn)}</td><td>${k.via === 'ten-TPB' ? chip('Tên KH TPBank', 'ok') : chip('Tên 900k → MST', 'gray')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Không thấy KH TPBank nào khớp tên.</p>';
        $('mstRes').innerHTML = khTbl + (cs.length ? `<h3>Ứng viên MST (900k)</h3><div class="tblwrap"><table class="tbl" id="mstTbl"><thead><tr><th>MST</th><th>Tên</th><th>Điểm khớp</th><th>KH TPBank</th></tr></thead><tbody>${cs.map(c => `<tr><td class="code">${esc(c.mst)}${c.branch ? ' ' + chip('chi nhánh', 'gray') : ''}</td><td>${esc(c.name)}</td><td>${Math.round(100 * c.score)}%</td><td>${cif[c.mst] ? chip('CIF ' + cif[c.mst].cif + (cif[c.mst].via === 'cty-me' ? ' (cty mẹ)' : ''), 'ok') : '—'}</td></tr>`).join('')}</tbody></table></div>` : '');
        meta();
      } catch (e) { $('mstSt').textContent = e.message; } finally { off(); if ($('mstGo')) $('mstGo').disabled = false; }
    };
    $('mstGo').onclick = go; $('mstQ').onkeydown = e => { if (e.key === 'Enter') go(); };
    $('mstClr').onclick = () => { CN.mstidx.clear(); CN.ui.toast('Đã xóa chỉ mục MST khỏi máy này', 'ok'); meta(); };
    if (!admin) return;
    let F = null;
    $('mstFiles').onchange = async e => {
      F = null; $('mstUp').disabled = true;
      try {
        const fs = [...e.target.files], by = n => fs.find(f => f.name === n);
        if (!by('manifest.json') || !by('name_index.tsv.gz') || !by('cif_map.tsv.gz')) throw new Error('Chọn đủ 3 tệp: manifest.json · name_index.tsv.gz · cif_map.tsv.gz');
        const man = JSON.parse(await by('manifest.json').text());
        const name = new Uint8Array(await by('name_index.tsv.gz').arrayBuffer()), cif = new Uint8Array(await by('cif_map.tsv.gz').arrayBuffer());
        if (name.length !== man.files.name.bytes || await sha(name) !== man.files.name.sha256) throw new Error('name_index.tsv.gz không khớp manifest.json (khác lần build?)');
        if (cif.length !== man.files.cif.bytes || await sha(cif) !== man.files.cif.sha256) throw new Error('cif_map.tsv.gz không khớp manifest.json');
        F = { man, name, cif };
        $('mstUpSt').innerHTML = `<div class="alert ok">Bản ${esc(man.version)}: ${fmt(man.counts.names)} pháp nhân · ${fmt(man.counts.cif)} MST có CIF · ${Math.ceil(name.length / PART)} mảnh.</div>`;
        $('mstUp').disabled = false;
      } catch (err) { $('mstUpSt').innerHTML = `<div class="alert err">${esc(err.message)}</div>`; }
    };
    $('mstUp').onclick = async () => {
      if (!F) return;
      const r = await CN.ui.ask('Tải chỉ mục MST nội bộ lên?', `<p>Phiên bản <b>${esc(F.man.version)}</b> thay phiên bản hiện có. Mọi người dùng sẽ tải bản mới ở lần tra kế tiếp. Thao tác được ghi nhật ký.</p>`, { yes: 'Tải lên' });
      if (!r.ok) return;
      $('mstUp').disabled = true;
      const v = F.man.version, n = Math.ceil(F.name.length / PART), st = m => { $('mstUpSt').innerHTML = `<div class="alert info">${esc(m)}</div>`; };
      try {
        for (let i = 0; i < n; i++) {
          st(`Đang tải mảnh ${i + 1}/${n}…`);
          const part = F.name.subarray(i * PART, (i + 1) * PART);
          await CN.net.write('mst-upload', { version: v, kind: 'name', i, b64: toB64(part), sha256: await sha(part) }, { timeoutMs: 180000 });
        }
        st('Đang tải bảng CIF…');
        await CN.net.write('mst-upload', { version: v, kind: 'cif', b64: toB64(F.cif) }, { timeoutMs: 180000 });
        st('Đang chốt phiên bản…');
        const out = await CN.net.write('mst-upload', { version: v, kind: 'manifest', parts: n, manifest: F.man }, { timeoutMs: 180000 });
        CN.mstidx.clear();
        $('mstUpSt').innerHTML = `<div class="alert ok">Đã tải lên bản ${esc(out.version)} (${out.name.parts} mảnh, ${fmt(out.name.bytes)} byte).</div>`;
        meta();
      } catch (e) { $('mstUpSt').innerHTML = `<div class="alert err">${esc(e.message)} — chọn lại tệp và tải lên lại.</div>`; $('mstUp').disabled = false; }
    };
    $('mstRm').onclick = async () => {
      const r = await CN.ui.ask('Gỡ chỉ mục MST nội bộ?', '<p>Xóa toàn bộ file chỉ mục trên Drive. Mọi người hết tra nội bộ (CIF đã điền trong danh mục đối tác giữ nguyên). Dùng khi có cảnh báo bảo mật.</p>', { yes: 'Gỡ', danger: true });
      if (!r.ok) return;
      try { const x = await CN.net.write('mst-remove', {}); CN.mstidx.clear(); CN.ui.toast('Đã gỡ ' + x.removed + ' file chỉ mục', 'ok'); meta(); } catch (e) { CN.ui.toast(e.message, 'err'); }
    };
  }

  CN.views.danhmuc = {
    render(host) {
      const S = CN.store.S, admin = CN.store.isAdmin(), cfg = S.data.config;
      const T = [['ts', 'Tham số mô hình'], ['tp', 'KH TPBank (' + S.data.khTP.length + ')'], ['mst', 'MST nội bộ'], ['tg', 'Tên gộp (' + S.data.tenGop.length + ')'], ['xuat', 'Xuất dữ liệu']].concat(admin ? [['kho', 'Nhập kho v0.1'], ['nk', 'Nhật ký truy cập']] : []);
      host.innerHTML = `<div class="tabs">${T.map(([k, t], i) => `<button class="tab ${i ? '' : 'on'}" data-t="${k}">${esc(t)}</button>`).join('')}</div><div id="dmBox"></div>`;
      const tabs = host.querySelectorAll('.tab');
      const show = t => {
        tabs.forEach(x => x.classList.toggle('on', x.dataset.t === t));
        const box = $('dmBox'); box.__tbl = null;
        if (t === 'ts') {
          box.innerHTML = `<div class="card"><h2>Tham số mô hình (13_Lists)</h2>${admin ? '' : '<p class="muted small">Chỉ Admin sửa được.</p>'}
            <div class="grid g2">${PARAMS.map(([k, ty]) => `<label class="fld"><span>${esc(k)}</span><input data-k="${esc(k)}" ${ty === 'date' ? 'type="date"' : 'inputmode="decimal"'} value="${esc(cfg[k] === undefined ? '' : cfg[k])}" ${admin ? '' : 'disabled'}></label>`).join('')}</div>
            ${admin ? '<div class="row end"><button class="btn pri" id="tsSave">Lưu tham số</button></div>' : ''}
            <p class="muted small">Ngày báo cáo để trống = kỳ mới nhất trong dữ liệu (đang dùng ${CN.ui.dt(S.M.report)}). Benchmark tính bằng VND. Ngưỡng gợi ý gộp tên áp dụng ở bước ③ Nạp dữ liệu.</p></div>`;
          if (admin) $('tsSave').onclick = () => {
            const items = {};
            box.querySelectorAll('[data-k]').forEach(el => { const k = el.dataset.k, v = el.value.trim(); const ty = PARAMS.find(p => p[0] === k)[1]; const val = ty === 'num' ? (v === '' ? '' : +v.replace(',', '.')) : v; if (String(val) !== String(cfg[k] === undefined ? '' : cfg[k])) items[k] = val; });
            if (Object.values(items).some(v => typeof v === 'number' && !Number.isFinite(v))) { CN.ui.toast('Tham số số không hợp lệ', 'err'); return; }
            if (!Object.keys(items).length) { CN.ui.toast('Không có thay đổi'); return; }
            act('set-config', { items }, r => 'Đã lưu ' + r.updated.length + ' tham số');
          };
        } else if (t === 'tp') {
          box.innerHTML = `<div class="card"><h2>Danh mục KH tại TPBank</h2><p class="muted small">Đối tác trùng MST hoặc tên chuẩn hóa với danh mục này (hoặc với KHHH) được đánh dấu <b>Đã là KH TPBank</b> và loại khỏi trang Cơ hội.</p>
            ${admin ? '<div class="row"><input type="file" id="tpFile" accept=".xlsx,.xls,.csv"><button class="btn pri" id="tpUp" disabled>Thay toàn bộ danh mục</button><span class="muted small">Cột cần có: CIF · MST · Tên · CN</span></div>' : ''}<div id="tpList" style="margin-top:10px"></div></div>`;
          table($('tpList'), S.data.khTP, [{ k: 'cif', t: 'CIF' }, { k: 'mst', t: 'MST' }, { k: 'ten', t: 'Tên khách hàng' }, { k: 'cn', t: 'CN' }], { search: ['cif', 'mst', 'ten'], empty: 'Chưa có danh mục' });
          if (admin) {
            let rows = null;
            $('tpFile').onchange = async e => { try { rows = await CN.xlsx.readKhTP(e.target.files[0]); $('tpUp').disabled = !rows.length; CN.ui.toast('Đọc được ' + rows.length + ' dòng'); } catch (err) { CN.ui.toast(err.message, 'err'); } };
            $('tpUp').onclick = async () => { const r = await CN.ui.ask('Thay danh mục KH TPBank?', `<p>Thay ${S.data.khTP.length} dòng hiện có bằng <b>${rows.length}</b> dòng từ file.</p>`, { yes: 'Thay' }); if (r.ok) act('set-khtp', { rows }, x => 'Đã lưu ' + x.n + ' dòng'); };
          }
        } else if (t === 'mst') {
          mstTab(box, admin);
        } else if (t === 'tg') {
          box.innerHTML = '<div class="card"><h2>Tên gốc → mã đối tác</h2><p class="muted small">Tên trên báo cáo đã gộp về mã đối tác (máy gộp hoặc người duyệt). Lần nạp sau máy dùng bảng này trước.</p><div id="tgList"></div></div>';
          table($('tgList'), S.data.tenGop.map(a => Object.assign({ ten: (CN.store.dtById(a.id) || {}).ten || '' }, a)), [
            { k: 'raw', t: 'Tên gốc' }, { k: 'id', t: 'Mã', f: a => `<a class="code" href="#/doi-tac/${esc(a.id)}">${esc(a.id)}</a>` }, { k: 'ten', t: 'Tên pháp lý' },
            { k: 'trangThai', t: 'Trạng thái', f: a => chip(a.trangThai, a.trangThai === 'Chờ duyệt' ? 'warn' : a.trangThai === 'Đã duyệt' ? 'ok' : 'gray') }], { search: ['raw', 'id', 'ten'] });
        } else if (t === 'xuat') {
          const all = CN.store.canDirect();
          box.innerHTML = `<div class="card"><h2>Xuất dữ liệu ra Excel</h2><p>${all ? 'Bạn (Admin/Teamlead) xuất được <b>toàn bộ</b> dữ liệu đã duyệt.' : 'Bạn xuất được dữ liệu của <b>các KHHH có lô do bạn nạp</b>.'}
            File gồm: công nợ · đối tác · tên gộp · KHHH · 08 quan hệ · 09 cơ hội · 11 cảnh báo.</p><div class="alert warn">Mọi lần xuất được ghi nhật ký. File chứa thông tin khách hàng — chỉ lưu trên ổ nội bộ, không gửi ra ngoài.</div>
            <div class="row"><button class="btn pri" id="xAll">Xuất Excel</button></div></div>
            <div class="card"><h2>Xuất Counterparty (template ver 3)</h2><p>Sheet <b>Counterparty</b> đúng mẫu "TEMPLATE - KHHH TPBANK ver 3": 1 dòng = đối tác × KHHH × TK × kỳ — PS Nợ/Có, tổng phát sinh trên KHHH, tỷ trọng (công thức), MST/CIF/ĐVKD đối tác, MST/CIF/tên KHHH.</p>
            <p class="muted small">Cột "MST (ID đối tác)": đối tác chưa có MST ghi mã DT. Cột doanh thu / trúng thầu / XNK / người đại diện và nhóm CIC để trống — bổ sung ở đợt 2. ${CN.store.chiCan() ? 'Đang bật "Chỉ số đã cân": bỏ dòng chưa cân.' : 'Đang TẮT "Chỉ số đã cân": gồm cả dòng chưa cân.'}</p>
            <div class="row"><button class="btn pri" id="xCp">Xuất Counterparty</button></div></div>`;
          $('xAll').onclick = () => CN.xlsx.exportAll();
          $('xCp').onclick = () => CN.xlsx.exportCounterparty();
        } else if (t === 'kho') {
          const empty = !S.data.doiTac.length;
          box.innerHTML = `<div class="card"><h2>Nhập 1 lần kho Excel của công cụ offline v0.1</h2><p class="muted small">Dùng khi chuyển từ công cụ HTML offline sang web: giữ nguyên mã DTxxxxx, tên gộp, KHHH, KH TPBank; mỗi KHHH + TK + kỳ thành 1 lô "Đã duyệt". Chỉ chạy được khi DB chưa có đối tác.</p>
            ${empty ? '<div class="row"><input type="file" id="khoFile" accept=".xlsx"><button class="btn pri" id="khoUp" disabled>Nhập vào DB</button></div><div id="khoSum"></div>' : '<div class="alert info">DB đã có ' + S.data.doiTac.length + ' đối tác → không nhập kho v0.1 nữa (tránh trùng mã). Nạp thêm dữ liệu ở trang Nạp dữ liệu.</div>'}</div>`;
          if (empty) {
            let P = null;
            $('khoFile').onchange = async e => { try { P = await CN.xlsx.readKhoV01(e.target.files[0]); $('khoSum').innerHTML = `<div class="alert ok">Đọc được ${P.doiTac.length} đối tác · ${P.tenGop.length} tên gộp · ${P.khhh.length} KHHH · ${P.khTP.length} KH TPBank · ${fmt(P.congNo.length)} dòng công nợ.</div>`; $('khoUp').disabled = false; } catch (err) { $('khoSum').innerHTML = `<div class="alert err">${esc(err.message)}</div>`; } };
            $('khoUp').onclick = async () => { const r = await CN.ui.ask('Nhập kho v0.1 vào DB?', '<p>Dữ liệu sẽ hiển thị cho mọi người dùng (đã duyệt). Thao tác được ghi nhật ký.</p>', { yes: 'Nhập' }); if (r.ok) act('import-kho', P, x => `Đã nhập ${x.doiTac} đối tác · ${x.lots} lô · ${x.congNo} dòng`); };
          }
        } else if (t === 'nk') {
          box.innerHTML = '<div class="card"><h2>Nhật ký truy cập (300 dòng gần nhất)</h2><div id="nkList">Đang tải…</div></div>';
          CN.net.call('audit', { limit: 300 }).then(r => table($('nkList'), r.rows.map(x => ({ at: x['Thời điểm'], who: x['Người'], role: x['Vai trò'], team: x['Team'], a: x['Hành động'], tg: x['Đối tượng'], ct: x['Chi tiết'] })), [
            { k: 'at', t: 'Thời điểm', f: x => CN.ui.dt(x.at) }, { k: 'who', t: 'Người', f: x => esc(x.who) + '<br><small class="muted">' + esc(x.role) + ' · ' + esc(x.team) + '</small>' },
            { k: 'a', t: 'Hành động', f: x => chip(x.a, /CẢNH BÁO/.test(x.a) ? 'err' : /Xuất/.test(x.a) ? 'warn' : 'gray') }, { k: 'tg', t: 'Đối tượng' }, { k: 'ct', t: 'Chi tiết' }],
            { search: ['who', 'a', 'tg', 'ct'], sortKey: 'at' })).catch(e => { $('nkList').innerHTML = `<div class="alert err">${esc(e.message)}</div>`; });
        }
      };
      tabs.forEach(t => t.onclick = () => show(t.dataset.t));
      show('ts');
    },
  };
})();
