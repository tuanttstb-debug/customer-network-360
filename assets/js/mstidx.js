'use strict';
/* mstidx.js — tra MST/CIF NỘI BỘ TPBank TRƯỚC công cụ ngoài (PHUONG_AN_TRA_MST_NOI_BO.md, anh Tuân duyệt 2026-10-15).
 * - Chỉ mục TÊN → MST (~870k pháp nhân, ~12 MB nén): tải từ GAS 1 lần/máy/phiên bản → IndexedDB (ngoại lệ A4 có chủ đích:
 *   chỉ tên + MST pháp nhân, KHÔNG có CIF/cờ KH TPBank; xóa khi đăng xuất hoặc quá 30 ngày) → Web Worker dựng chỉ mục, tra tại máy.
 * - MST → CIF: hỏi GAS cho đúng các MST cần (≤ 1.000/lần, có nhật ký). Bảng CIF không bao giờ về trình duyệt.
 * Tải lười: chỉ khi người dùng cần tra (bước ③ Nạp dữ liệu, Đối tác, Danh mục). */
(function () {
  const DB = 'cn360_mst', ST = 'idx', MAX_AGE = 30 * 864e5, CONC = 3, CIF_MAX = 1000;
  const X = { status: 'none', msg: '', meta: null, version: null, n: 0 };
  const subs = new Set(), pending = new Map();
  let worker = null, ready = null, seq = 0;
  const emit = () => subs.forEach(f => { try { f(X); } catch (e) { /* ô giao diện đã đóng */ } });
  const set = (status, msg) => { X.status = status; X.msg = msg || ''; emit(); };
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');

  /* ---- IndexedDB (bọc try: chế độ ẩn danh / bị chặn → chỉ giữ trong bộ nhớ) ---- */
  const openDb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function idbGet(k) {
    try { const db = await openDb(); return await new Promise(res => { const q = db.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => { res(q.result || null); db.close(); }; q.onerror = () => { res(null); db.close(); }; }); }
    catch (e) { return null; }
  }
  async function idbPut(k, v) {
    try { const db = await openDb(); await new Promise(res => { const tx = db.transaction(ST, 'readwrite'); tx.objectStore(ST).put(v, k); tx.oncomplete = tx.onerror = tx.onabort = () => { res(); db.close(); }; }); }
    catch (e) { /* không lưu được → lần sau tải lại */ }
  }
  const idbDrop = () => { try { indexedDB.deleteDatabase(DB); } catch (e) { /* bỏ qua */ } };

  const b64ToBytes = b64 => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

  async function download(meta) {
    const n = meta.name.parts, parts = new Array(n);
    let next = 0, done = 0;
    set('downloading', `Đang tải chỉ mục MST nội bộ (lần đầu trên máy này) 0/${n}…`);
    const one = async () => {
      while (next < n) {
        const i = next++;
        const r = await CN.net.call('mst-part', { version: meta.version, i }, { timeoutMs: 180000 });
        parts[i] = b64ToBytes(r.b64);
        set('downloading', `Đang tải chỉ mục MST nội bộ (lần đầu trên máy này) ${++done}/${n}…`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, n) }, one));
    const buf = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let o = 0; parts.forEach(p => { buf.set(p, o); o += p.length; });
    if (window.crypto && crypto.subtle && hex(await crypto.subtle.digest('SHA-256', buf)) !== meta.name.sha256) throw new Error('Chỉ mục tải về bị lỗi (sha256) — bấm thử lại.');
    return buf.buffer;
  }

  async function makeWorker() {
    // CSP chỉ cho worker từ blob: → ghép lõi + worker thành 1 blob
    const src = await Promise.all(['core/mstmatch.js', 'assets/js/mstidx.worker.js'].map(u => fetch(u).then(r => { if (!r.ok) throw new Error('Không tải được ' + u); return r.text(); })));
    const url = URL.createObjectURL(new Blob([src[0], '\n;\n', src[1]], { type: 'text/javascript' }));
    const w = new Worker(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    w.onmessage = e => {
      const m = e.data, p = pending.get(m.id);
      if (!p) return;
      if (m.type === 'progress') { if (p.onProgress) p.onProgress(m.phase, m.p); return; }
      pending.delete(m.id);
      if (m.type === 'done') p.res(m.data); else p.rej(new Error(m.error));
    };
    w.onerror = e => { pending.forEach(p => p.rej(new Error('Lỗi bộ tra MST: ' + (e.message || 'không rõ')))); pending.clear(); };
    return w;
  }
  function rpc(msg, transfer, onProgress) {
    return new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej, onProgress }); worker.postMessage(Object.assign({ id }, msg), transfer || []); });
  }

  /** Sẵn sàng tra? → true · false nếu chưa có chỉ mục trên server. Gọi nhiều lần an toàn. */
  function ensure() {
    if (ready) return ready;
    ready = (async () => {
      set('loading', 'Đang kiểm tra chỉ mục MST nội bộ…');
      const meta = await CN.net.call('mst-meta', {}, { timeoutMs: 60000 });
      X.meta = meta;
      if (!meta.version) { set('off', 'Chưa có chỉ mục MST nội bộ (Admin tải lên ở Danh mục → MST nội bộ).'); return false; }
      let rec = await idbGet('name');
      if (!rec || rec.version !== meta.version || !(Date.now() - rec.at < MAX_AGE)) {
        rec = { version: meta.version, at: Date.now(), buf: await download(meta) };
        await idbPut('name', rec);
      }
      set('building', `Đang dựng chỉ mục ${fmt(meta.counts && meta.counts.names)} pháp nhân trên máy…`);
      if (!worker) worker = await makeWorker();
      const r = await rpc({ type: 'load', buf: rec.buf, version: meta.version }, [rec.buf], (ph, p) => set('building', `Đang dựng chỉ mục trên máy… ${Math.round(100 * p)}%`));
      X.version = meta.version; X.n = r.n;
      set('ready', `Chỉ mục nội bộ ${fmt(r.n)} pháp nhân · bản ${meta.version}`);
      return true;
    })().catch(err => { ready = null; set('error', err.message); throw err; });
    return ready;
  }

  /** Tên → [{cands:[{mst,name,score,branch}], auto}] · null nếu chưa có chỉ mục. Ghi nhật ký số lượng (không ghi tên). */
  async function search(names, onProgress, context) {
    if (!(await ensure())) return null;
    const out = await rpc({ type: 'search', names, k: 5 }, [], (ph, p) => { if (onProgress) onProgress(p); });
    CN.net.call('log', { what: 'Tra MST nội bộ', target: context || '', detail: names.length + ' tên · ' + out.filter(r => r.auto).length + ' tự điền' }).catch(() => {});
    return out;
  }

  /** [MST] → {map: {MST: {cif, cn, seg, via}}} — hỏi server theo lô ≤ 1.000. */
  async function cif(msts, context) {
    const uniq = [...new Set((msts || []).map(m => String(m || '').trim()).filter(Boolean))], map = {};
    for (let i = 0; i < uniq.length; i += CIF_MAX) {
      const r = await CN.net.call('mst-cif', { msts: uniq.slice(i, i + CIF_MAX), context: context || '' }, { timeoutMs: 90000 });
      Object.assign(map, r.map || {});
    }
    return { map };
  }

  /** Xóa chỉ mục khỏi máy này (đăng xuất / người dùng bấm). */
  function clear() {
    if (worker) { worker.terminate(); worker = null; }
    pending.forEach(p => p.rej(new Error('Đã xóa chỉ mục'))); pending.clear();
    ready = null; X.version = null; X.n = 0; idbDrop(); set('none', '');
  }

  const label = () => 'Nội bộ TPBank ' + (X.version || '');
  const on = f => { subs.add(f); return () => subs.delete(f); };
  CN.mstidx = { ensure, search, cif, clear, label, on, state: X };
})();
