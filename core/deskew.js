/* Chỉnh nghiêng trang scan (bảng in nghiêng 0,5–3° làm lệch cột số → gom cột sai, kẻ bảng không xoá được).
 * Hình chiếu điểm mực theo hàng: góc đúng → các dòng chữ/kẻ ngang dồn vào ít hàng → tổng bình phương lớn nhất. */
function estimateSkew(c, maxDeg, step) {
  maxDeg = maxDeg || 4; step = step || 0.2;
  const k = Math.min(1, 1200 / c.width), W = Math.round(c.width * k), H = Math.round(c.height * k);
  const s = document.createElement('canvas'); s.width = W; s.height = H;
  const x = s.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(c, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data; s.width = s.height = 0;
  const px = [];
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { const q = (yy * W + xx) * 4; if (d[q] * 0.299 + d[q + 1] * 0.587 + d[q + 2] * 0.114 < 140) px.push(xx - W / 2, yy); }
  if (px.length < 200) return 0;
  // lấy mẫu tối đa 60k điểm cho nhanh
  const stride = Math.max(1, Math.floor(px.length / 2 / 60000)) * 2;
  const score = deg => { const t = deg * Math.PI / 180, sn = Math.sin(t), cs = Math.cos(t), bins = new Float64Array(H * 2 + 10);
    for (let i = 0; i < px.length; i += stride) { const yr = Math.round(px[i + 1] * cs - px[i] * sn + H * 0.5); if (yr >= 0 && yr < bins.length) bins[yr]++; }
    let s2 = 0; for (let i = 0; i < bins.length; i++) s2 += bins[i] * bins[i]; return s2; };
  let best = 0, bs = -1;
  for (let a = -maxDeg; a <= maxDeg + 1e-9; a += step) { const v = score(a); if (v > bs) { bs = v; best = a; } }
  // tinh chỉnh ±step với bước 0,05°
  for (let a = best - step; a <= best + step + 1e-9; a += 0.05) { const v = score(a); if (v > bs) { bs = v; best = a; } }
  return Math.round(best * 100) / 100;
}
/** Xoay canvas một góc nhỏ (độ, chiều kim đồng hồ dương) quanh tâm, nền trắng, giữ kích thước. */
function rotateSmall(c, deg) {
  if (!deg) return c;
  const r = document.createElement('canvas'); r.width = c.width; r.height = c.height;
  const x = r.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, r.width, r.height);
  x.translate(r.width / 2, r.height / 2); x.rotate(deg * Math.PI / 180); x.drawImage(c, -c.width / 2, -c.height / 2);
  c.width = c.height = 0; return r;
}

/** Nhị phân hoá: điểm sáng hơn ngưỡng → trắng, còn lại → đen. Vạch kẻ/nền ô màu xám nhạt (≈190–230) biến mất, chữ đen giữ nguyên. */
function binarize(c, thr) {
  thr = thr || 165;
  const x = c.getContext('2d', { willReadFrequently: true }), im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) < thr ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; }
  x.putImageData(im, 0, 0); return c;
}
