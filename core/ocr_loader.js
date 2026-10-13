/* ocr_loader.js — nạp thư viện đọc tệp TỰ HOST (vendor/, không CDN) khi cần, đặt các biến toàn cục mà ocr_core.js mong đợi
 * (bản offline v0.1 nhúng sẵn vào HTML; bản web tải 1 lần, trình duyệt cache). Mọi xử lý tệp chạy tại máy. */
(function (G) {
  'use strict';
  const V = 'vendor/';
  let pOcr = null, pXlsx = null;
  const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Không tải được ' + src)); document.head.appendChild(s); });
  const text = async u => { const r = await fetch(u); if (!r.ok) throw new Error('Không tải được ' + u); return r.text(); };
  const b64 = async u => {
    const r = await fetch(u); if (!r.ok) throw new Error('Không tải được ' + u);
    const blob = await r.blob();
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  };
  function ensureXlsx() {
    if (G.XLSX) return Promise.resolve();
    return pXlsx || (pXlsx = script(V + 'xlsx.full.min.js'));
  }
  function ensureOcr(onStatus) {
    if (G.pdfjsLib && G.Tesseract && typeof G.__TCORE_SRC === 'string') return Promise.resolve();
    return pOcr || (pOcr = (async () => {
      (onStatus || (() => {}))('Đang tải bộ đọc PDF/ảnh (lần đầu ~8 MB, các lần sau dùng bản đã lưu)…');
      const [, , pdfw, tcore, tw, vie] = await Promise.all([script(V + 'pdf.min.js'), script(V + 'tesseract.min.js'), text(V + 'pdf.worker.min.js'),
        text(V + 'tesseract-core-simd-lstm.wasm.js'), text(V + 'tesseract.worker.min.js'), b64(V + 'vie.traineddata.gz')]);
      G.__PDFW_SRC = pdfw; G.__TCORE_SRC = tcore; G.__TW_SRC = tw; G.__VIE_B64 = vie;
    })().catch(e => { pOcr = null; throw e; }));
  }
  G.CNLoad = { ensureXlsx, ensureOcr };
})(window);
