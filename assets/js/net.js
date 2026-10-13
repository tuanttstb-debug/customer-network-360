'use strict';
/* Lớp một cửa tới GAS (khuôn SHTD auth.js): token tự gắn · timeout · ghi tin cậy (retry + reqId idempotent).
 * Đăng nhập: tài khoản SHTD. SSO: nếu trình duyệt đang có phiên SHTD còn hạn → dùng luôn token đó (GAS CN360 verify cùng AUTH_SECRET). */
(function () {
  const C = CN.CONFIG;
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  function readSession(key) {
    try { const s = JSON.parse(LS.get(key) || 'null'); if (!s || !s.token || !s.exp || Date.now() > s.exp) return null; return s; } catch (e) { return null; }
  }
  function session() { return readSession(C.AUTH_KEY) || readSession(C.SHTD_AUTH_KEY); }
  function setSession(token, user) { LS.set(C.AUTH_KEY, JSON.stringify({ token, user, exp: Date.now() + 24 * 3600e3 })); }
  function clearSession() { LS.del(C.AUTH_KEY); }

  async function fetchT(body, ms) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), ms || C.TIMEOUT_MS);
    try {
      const res = await fetch(C.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), signal: ctrl.signal });
      if (!res.ok) throw new Error('Máy chủ lỗi HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('Máy chủ phản hồi quá lâu (mạng chậm hoặc bị chặn). Vui lòng thử lại.');
      if (e instanceof SyntaxError) throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
      throw e.message && /HTTP/.test(e.message) ? e : new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    } finally { clearTimeout(timer); }
  }

  /** Gọi action có token. Lỗi nghiệp vụ → ném Error(message); hết phiên → CN.onAuthLost(). */
  async function call(action, payload, opts) {
    opts = opts || {};
    const s = session();
    const json = await fetchT(Object.assign({}, payload || {}, { action, token: s ? s.token : '' }), opts.timeoutMs);
    if (json.error === 'AUTH_REQUIRED') {
      clearSession();
      const err = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); err.code = 'AUTH_REQUIRED';
      if (CN.onAuthLost) CN.onAuthLost();
      throw err;
    }
    if (json.status !== 'ok') { const err = new Error(json.error === 'FORBIDDEN' ? 'Bạn không có quyền thực hiện thao tác này.' : (json.error || 'Lỗi không xác định')); err.code = json.error; throw err; }
    return json.data;
  }

  /** Ghi tin cậy: retry lỗi mạng với CÙNG reqId → server không ghi lặp. Lỗi nghiệp vụ không retry. */
  async function write(action, payload, opts) {
    const reqId = 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    const delays = [600, 1800, 4500];
    let last;
    for (let i = 0; i <= delays.length; i++) {
      try { return await call(action, Object.assign({}, payload, { reqId }), opts); }
      catch (e) {
        if (e.code) throw e;          // AUTH_REQUIRED / FORBIDDEN / lỗi nghiệp vụ
        last = e;
        if (i < delays.length) await new Promise(r => setTimeout(r, delays[i] + Math.random() * 300));
      }
    }
    throw last;
  }

  async function login(username, password) {
    const json = await fetchT({ action: 'auth-login', username, password });
    if (json.status !== 'ok') throw new Error(json.error || 'Đăng nhập thất bại.');
    setSession(json.token, json.user);
    return json.user;
  }

  CN.net = { session, setSession, clearSession, call, write, login, LS };
})();
