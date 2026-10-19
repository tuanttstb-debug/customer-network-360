'use strict';
/* app.js — vỏ ứng dụng: đăng nhập/SSO · sidebar (khuôn SHTD) · điều hướng hash · tải dữ liệu theo quyền. */
(function () {
  const { esc, toast } = CN.ui;
  const VIEWS = [
    { id: 'tong-quan', t: 'Tổng quan', ic: '◧', v: () => CN.views.overview },
    { id: 'nap', t: 'Nạp dữ liệu', ic: '⇪', v: () => CN.views.nap },
    { sec: 'Tra cứu' },
    { id: 'khach-hang', t: 'Khách hàng (KHHH)', ic: '◉', v: () => CN.views.khhh },
    { id: 'doi-tac', t: 'Đối tác', ic: '⛓', v: () => CN.views.doitac },
    { id: 'co-hoi', t: 'Cơ hội bán chéo', ic: '★', v: () => CN.views.cohoi },
    { id: 'rui-ro', t: 'Rủi ro', ic: '⚠', v: () => CN.views.ruiro },
    { sec: 'Quản trị' },
    { id: 'duyet', t: 'Lô & duyệt', ic: '✔', v: () => CN.views.duyet, badge: true },
    { id: 'danh-muc', t: 'Danh mục', ic: '☰', v: () => CN.views.danhmuc },
  ];
  CN.go = (id, arg) => { location.hash = '#/' + id + (arg ? '/' + encodeURIComponent(arg) : ''); };

  function theme(t) {
    if (t) CN.net.LS.set('cn360_theme', t);
    const cur = CN.net.LS.get('cn360_theme') || 'light';
    document.documentElement.setAttribute('data-theme', cur);
  }
  $('btnTheme').onclick = () => theme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  theme();

  const dropSplash = () => { const sp = document.getElementById('bootSplash'); if (sp) sp.remove(); };
  function showLogin(msg) {
    dropSplash();
    $('app').style.display = 'none'; $('loginOverlay').style.display = '';
    $('lgErr').style.display = msg ? '' : 'none'; $('lgErr').textContent = msg || '';
    setTimeout(() => $('lgUser').focus(), 50);
  }
  CN.onAuthLost = () => { CN.store.S.data = null; showLogin('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); };
  $('loginForm').onsubmit = async e => {
    e.preventDefault();
    $('lgBtn').disabled = true; $('lgErr').style.display = 'none';
    try { await CN.net.login($('lgUser').value.trim(), $('lgPass').value); $('lgPass').value = ''; await start(); }
    catch (err) { $('lgErr').textContent = err.message; $('lgErr').style.display = ''; }
    finally { $('lgBtn').disabled = false; }
  };

  function renderNav() {
    const S = CN.store.S, cur = (location.hash.split('/')[1] || 'tong-quan');
    $('nav').innerHTML = VIEWS.map(x => x.sec ? `<div class="nav-section-label">${esc(x.sec)}</div>`
      : `<a class="nav-item ${cur === x.id ? 'active' : ''}" href="#/${x.id}" data-id="${x.id}"><span class="nav-icon">${x.ic}</span><span class="nav-label">${esc(x.t)}</span>${x.badge && S.pendingForMe ? `<span class="nav-badge" title="Mục chờ bạn duyệt">${S.pendingForMe}</span>` : ''}</a>`).join('');
    const u = S.user;
    $('userPill').innerHTML = u ? `<span class="avatar">${esc((u.displayName || u.username).split(' ').pop().slice(0, 2).toUpperCase())}</span><span class="user-meta"><b>${esc(u.displayName || u.username)}</b><small>${esc(u.role)} · ${esc(u.team || '—')}</small></span><button class="btn sm ghost" id="btnLogout">Đăng xuất</button>` : '';
    if ($('btnLogout')) $('btnLogout').onclick = () => { CN.net.clearSession(); if (CN.mstidx) CN.mstidx.clear(); CN.store.S.data = null; showLogin(''); };
    $('dbStatus').textContent = S.loadedAt ? 'Dữ liệu lúc ' + S.loadedAt.toLocaleTimeString('vi-VN') + ' · ' + S.data.lots.filter(l => l.status === 'Đã duyệt').length + ' lô' : '–';
  }

  function paintChiCan() {
    const M = CN.store.S.M, on = CN.store.chiCan();
    $('chiCan').checked = on;
    $('chiCanN').innerHTML = on && M && M.anChuaCan ? CN.ui.chip('ẩn ' + M.anChuaCan + ' dòng chưa cân', 'warn') : '';
  }
  $('chiCan').onchange = () => { CN.store.setChiCan($('chiCan').checked); route(); };

  async function route() {
    if (!CN.store.S.data) return;
    paintChiCan();
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const id = parts[0] || 'tong-quan', arg = parts[1] ? decodeURIComponent(parts[1]) : '';
    const V = VIEWS.find(x => x.id === id) || VIEWS[0];
    $('pageTitle').textContent = V.t; $('pageSub').textContent = '';
    renderNav();
    document.body.classList.remove('nav-open');
    const host = $('view'); host.innerHTML = '';
    try { await V.v().render(host, arg); } catch (err) { console.error(err); host.innerHTML = `<div class="alert err">Lỗi hiển thị: ${esc(err.message)}</div>`; }
    window.scrollTo(0, 0);
  }
  CN.refresh = async (silent) => {
    CN.ui.busy(!silent, 'Đang tải dữ liệu…');
    try { await CN.store.load(); await route(); if (!silent) toast('Đã tải dữ liệu mới nhất', 'ok'); }
    catch (err) { if (err.code !== 'AUTH_REQUIRED') toast(err.message, 'err'); }
    finally { CN.ui.busy(false); }
  };
  $('btnReload').onclick = () => CN.refresh();
  $('hamburger').onclick = () => document.body.classList.toggle('nav-open');
  $('sidebarOverlay').onclick = () => document.body.classList.remove('nav-open');
  window.addEventListener('hashchange', route);
  $('verBadge').textContent = 'CN360 ' + CN.CONFIG.VERSION;

  async function start() {
    dropSplash(); $('loginOverlay').style.display = 'none'; $('app').style.display = '';
    CN.ui.busy(true, 'Đang tải dữ liệu…');
    try { await CN.store.load(); window.__cnReady = true; await route(); }
    catch (err) { if (err.code !== 'AUTH_REQUIRED') { $('view').innerHTML = `<div class="alert err">Không tải được dữ liệu: ${esc(err.message)} <button class="btn sm" id="retry">Thử lại</button></div>`; $('retry').onclick = () => start(); } }
    finally { CN.ui.busy(false); }
  }
  if (CN.net.session()) start(); else showLogin('');
})();
