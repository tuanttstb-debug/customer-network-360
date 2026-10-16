'use strict';
/* mstidx.worker.js — Web Worker tra MST nội bộ. Được GHÉP SAU core/mstmatch.js thành 1 blob (mstidx.js) → self.MSTM có sẵn.
 * Nhận: {id, type:'load', buf(gzip TSV), version} · {id, type:'search', names, k}. Trả: {id, type:'progress'|'done'|'error'}.
 * Dữ liệu chỉ nằm trong bộ nhớ worker này — không gửi đi đâu. */
/* global MSTM */
let I = null;
self.onmessage = async e => {
  const m = e.data, id = m.id;
  const progress = (phase, p) => self.postMessage({ id, type: 'progress', phase, p });
  try {
    if (m.type === 'load') {
      I = null;
      progress('unzip', 0);
      const text = await new Response(new Blob([m.buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      I = MSTM.build(MSTM.parseTsv(text), p => progress('build', p));
      self.postMessage({ id, type: 'done', data: { n: I.N, version: m.version } });
    } else if (m.type === 'search') {
      if (!I) throw new Error('Chỉ mục MST nội bộ chưa sẵn sàng.');
      const out = [];
      for (let i = 0; i < m.names.length; i++) {
        if (i % 20 === 0) progress('search', i / m.names.length);
        out.push(MSTM.search(I, m.names[i], m.k || 5, m.opts));
      }
      self.postMessage({ id, type: 'done', data: out });
    }
  } catch (err) { self.postMessage({ id, type: 'error', error: String((err && err.message) || err) }); }
};
