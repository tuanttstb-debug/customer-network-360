// Giả lập Google Apps Script tối thiểu để chạy gas/*.gs trong Node (vm) — chỉ dữ liệu GIẢ.
// Hỗ trợ đúng phần API backend CN360 dùng: SpreadsheetApp, LockService, CacheService, PropertiesService, Utilities,
// ContentService, DriveApp (chia sẻ file), ScriptApp (trigger), Session, Logger.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toSigned = buf => [...buf].map(b => (b > 127 ? b - 256 : b));
const fromBytes = arr => Buffer.from(arr.map(b => b & 0xff));

class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = this.sh.data[this.r - 1 + i] || []; const o = []; for (let j = 0; j < this.nc; j++) { const v = row[this.c - 1 + j]; o.push(v === undefined ? '' : v); } out.push(o); } return out; }
  setValues(v) {
    if (v.length !== this.nr || v.some(r => r.length !== this.nc)) throw new Error('setValues: kích thước không khớp ' + v.length + 'x' + (v[0] || []).length + ' vs ' + this.nr + 'x' + this.nc);
    v.forEach((row, i) => { const R = this.r - 1 + i; while (this.sh.data.length <= R) this.sh.data.push([]); row.forEach((x, j) => { this.sh.data[R][this.c - 1 + j] = x instanceof Date ? x : (typeof x === 'object' && x !== null ? String(x) : x); }); });
    return this;
  }
  clearContent() { for (let i = 0; i < this.nr; i++) { const row = this.sh.data[this.r - 1 + i]; if (row) for (let j = 0; j < this.nc; j++) row[this.c - 1 + j] = ''; } return this; }
  setNumberFormat() { return this; } setFontWeight() { return this; } setBackground() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.data = []; }
  getName() { return this.name; }
  _trim() { while (this.data.length && this.data[this.data.length - 1].every(x => x === '' || x === undefined || x === null)) this.data.pop(); }
  getLastRow() { this._trim(); return this.data.length; }
  getLastColumn() { return this.data.reduce((m, r) => { let n = r.length; while (n && (r[n - 1] === '' || r[n - 1] === undefined)) n--; return Math.max(m, n); }, 0); }
  getMaxRows() { return 1000; }
  getDataRange() { const nr = Math.max(1, this.getLastRow()), nc = Math.max(1, this.getLastColumn()); return new Range(this, 1, 1, nr, nc); }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  setFrozenRows() {}
}
class Spreadsheet {
  constructor(id, name) { this.id = id; this.name = name; this.sheets = []; }
  getId() { return this.id; } getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
  sheet(n) { return this.getSheetByName(n); }
  table(n) { const v = this.getSheetByName(n).data; const H = v[0]; return v.slice(1).filter(r => r.some(x => x !== '' && x !== undefined)).map(r => Object.fromEntries(H.map((h, i) => [h, r[i] === undefined ? '' : r[i]]))); }
}

export function makeEnv({ users = [], props = {}, owner = 'owner@gmail.com' } = {}) {
  const books = new Map();
  const userBook = new Spreadsheet('1cpg1p_8TGGbvZNNWZmjsKANqHW1tQijbiQBFLYn56Hk', 'SHTD');
  const um = userBook.insertSheet('User_Master');
  um.data = [['Username', 'Display_Name', 'Role', 'Team', 'Active', 'Password_Hash', 'Last_Login'],
    ...users.map(u => [u.username, u.displayName || u.username, u.role, u.team || '', u.active === false ? false : true, crypto.createHash('sha256').update(u.password || 'x').digest('hex'), ''])];
  books.set(userBook.id, userBook);
  const P = Object.assign({}, props), cacheStore = new Map(), triggers = [], logs = [];
  const files = new Map();
  let lockDepth = 0, nId = 1;
  const Access = { PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', DOMAIN: 'DOMAIN' }, Permission = { NONE: 'NONE', VIEW: 'VIEW', EDIT: 'EDIT' };
  const fileOf = id => { if (!files.has(id)) files.set(id, { access: Access.PRIVATE, editors: [owner], viewers: [], shareable: true }); return files.get(id); };
  const person = e => ({ getEmail: () => e });

  const ctx = {
    console,
    SpreadsheetApp: {
      openById: id => { const b = books.get(id); if (!b) throw new Error('Không mở được spreadsheet ' + id); return b; },
      create: name => { const b = new Spreadsheet('DB' + (nId++), name); b.insertSheet('Sheet1'); books.set(b.id, b); fileOf(b.id); return b; },
      flush: () => {},
    },
    LockService: { getScriptLock: () => ({ waitLock: () => { lockDepth++; if (lockDepth > 1) throw new Error('lock lồng nhau'); }, releaseLock: () => { lockDepth--; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (cacheStore.has(k) ? cacheStore.get(k) : null), put: (k, v) => cacheStore.set(k, v), remove: k => cacheStore.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in P ? P[k] : null), setProperty: (k, v) => { P[k] = String(v); } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => toSigned(crypto.createHash(alg).update(String(s), 'utf8').digest()),
      computeHmacSha256Signature: (v, key) => toSigned(crypto.createHmac('sha256', String(key)).update(String(v), 'utf8').digest()),
      base64Encode: s => Buffer.from(typeof s === 'string' ? s : fromBytes(s)).toString('base64'),
      base64Decode: s => toSigned(Buffer.from(String(s), 'base64')),
      newBlob: bytes => ({ getDataAsString: () => fromBytes(bytes).toString('utf8') }),
      formatDate: (d, tz, f) => { const x = new Date(d.getTime() + 7 * 3600e3); const s = x.toISOString(); return f === 'yyyy-MM-dd' ? s.slice(0, 10) : s; },
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; }, getContent() { return s; } }) },
    DriveApp: {
      Access, Permission,
      getFileById: id => { const f = fileOf(id); return {
        getOwner: () => person(owner), getSharingAccess: () => f.access, setSharing: (a) => { f.access = a; },
        getEditors: () => f.editors.map(person), getViewers: () => f.viewers.map(person),
        removeEditor: p => { f.editors = f.editors.filter(e => e !== p.getEmail()); }, removeViewer: p => { f.viewers = f.viewers.filter(e => e !== p.getEmail()); },
        setShareableByEditors: b => { f.shareable = b; } }; },
    },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger: fn => { const t = { getHandlerFunction: () => fn }; const chain = { timeBased: () => chain, everyDays: () => chain, atHour: () => chain, create: () => { triggers.push(t); return t; } }; return chain; } },
    Session: { getEffectiveUser: () => person(owner) },
    Logger: { log: m => logs.push(String(m)) },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const dir = path.join(ROOT, 'gas');
  const order = ['Mapping.gs', 'Config.gs', 'Auth.gs', 'Db.gs', 'Service.gs', 'Guard.gs', 'Setup.gs', 'Code.gs'];
  const all = fs.readdirSync(dir).filter(f => f.endsWith('.gs'));
  for (const f of all) if (!order.includes(f)) order.push(f);
  for (const f of order) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  // Mỗi request = 1 lần chạy GAS mới → xóa cache bảng trong bộ nhớ (giống thực tế)
  const call = body => { vm.runInContext('_tblCache_ = {};', ctx); return JSON.parse(JSON.stringify(ctx.handle_(JSON.parse(JSON.stringify(body))))); };
  return { ctx, call, books, files, fileOf, props: P, triggers, logs, userBook, db: () => books.get(P.DB_ID), cacheStore, owner };
}
