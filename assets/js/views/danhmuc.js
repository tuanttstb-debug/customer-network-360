'use strict';
/* Danh mục — tham số mô hình (Admin sửa) · danh mục KH TPBank · tên gộp · xuất dữ liệu · nhập kho v0.1 (1 lần) · nhật ký truy cập (Admin). */
(function () {
  CN.views = CN.views || {};
  const { esc, chip, table, fmt } = CN.ui;
  const PARAMS = [['Ngày báo cáo', 'date'], ['Ngày bắt đầu theo dõi', 'date'], ['Ngưỡng tập trung cao', 'num'], ['Ngưỡng tập trung theo dõi', 'num'], ['Ngưỡng suy giảm', 'num'],
    ['Benchmark quy mô quan hệ', 'num'], ['Benchmark BL còn hiệu lực', 'num'], ['Ngưỡng Opportunity P1', 'num'], ['Ngưỡng Opportunity P2', 'num'], ['Benchmark quy mô cơ hội', 'num'], ['Ngưỡng gợi ý gộp tên', 'num']];
  const act = async (action, payload, msg, after) => { try { CN.ui.busy(true, 'Đang lưu…'); const r = await CN.net.write(action, payload, { timeoutMs: 120000 }); CN.ui.toast(msg(r), 'ok'); await CN.refresh(true); if (after) after(r); } catch (e) { CN.ui.toast(e.message, 'err'); } finally { CN.ui.busy(false); } };

  CN.views.danhmuc = {
    render(host) {
      const S = CN.store.S, admin = CN.store.isAdmin(), cfg = S.data.config;
      const T = [['ts', 'Tham số mô hình'], ['tp', 'KH TPBank (' + S.data.khTP.length + ')'], ['tg', 'Tên gộp (' + S.data.tenGop.length + ')'], ['xuat', 'Xuất dữ liệu']].concat(admin ? [['kho', 'Nhập kho v0.1'], ['nk', 'Nhật ký truy cập']] : []);
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
        } else if (t === 'tg') {
          box.innerHTML = '<div class="card"><h2>Tên gốc → mã đối tác</h2><p class="muted small">Tên trên báo cáo đã gộp về mã đối tác (máy gộp hoặc người duyệt). Lần nạp sau máy dùng bảng này trước.</p><div id="tgList"></div></div>';
          table($('tgList'), S.data.tenGop.map(a => Object.assign({ ten: (CN.store.dtById(a.id) || {}).ten || '' }, a)), [
            { k: 'raw', t: 'Tên gốc' }, { k: 'id', t: 'Mã', f: a => `<a class="code" href="#/doi-tac/${esc(a.id)}">${esc(a.id)}</a>` }, { k: 'ten', t: 'Tên pháp lý' },
            { k: 'trangThai', t: 'Trạng thái', f: a => chip(a.trangThai, a.trangThai === 'Chờ duyệt' ? 'warn' : a.trangThai === 'Đã duyệt' ? 'ok' : 'gray') }], { search: ['raw', 'id', 'ten'] });
        } else if (t === 'xuat') {
          const all = CN.store.canDirect();
          box.innerHTML = `<div class="card"><h2>Xuất dữ liệu ra Excel</h2><p>${all ? 'Bạn (Admin/Teamlead) xuất được <b>toàn bộ</b> dữ liệu đã duyệt.' : 'Bạn xuất được dữ liệu của <b>các KHHH có lô do bạn nạp</b>.'}
            File gồm: công nợ · đối tác · tên gộp · KHHH · 08 quan hệ · 09 cơ hội · 11 cảnh báo.</p><div class="alert warn">Mọi lần xuất được ghi nhật ký. File chứa thông tin khách hàng — chỉ lưu trên ổ nội bộ, không gửi ra ngoài.</div>
            <div class="row"><button class="btn pri" id="xAll">Xuất Excel</button></div></div>`;
          $('xAll').onclick = () => CN.xlsx.exportAll();
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
