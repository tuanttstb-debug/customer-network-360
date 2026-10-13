// ── Auth.gs — đăng nhập dùng chung SHTD-Dashboard (khớp SHTD backend/AuthService.gs + AIUS AuthTokenService.gs) ──
// Token: base64(payload) + '.' + HMAC-SHA256-hex(payload, AUTH_SECRET); payload {u, dn, r, t, exp} — 24 giờ.
// Token SHTD (localStorage 'shtd_auth_v1' cùng origin github.io) verify được ở đây vì cùng AUTH_SECRET → SSO.
// Quản lý user/role/team CHỈ ở SHTD. CN360 chỉ ĐỌC User_Master.

function _authSecret_() {
  var s = PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
  if (!s) throw new Error('AUTH_SECRET chưa cấu hình trong Script Properties. Liên hệ Admin.');
  return s;
}
function _hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join(''); }
function _sha256Hex_(plain) { return _hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plain, Utilities.Charset.UTF_8)); }
function _hmacHex_(payload) { return _hex_(Utilities.computeHmacSha256Signature(payload, _authSecret_(), Utilities.Charset.UTF_8)); }

function makeToken_(u, dn, r, t) {
  var payload = JSON.stringify({ u: u, dn: dn, r: r, t: t, exp: Date.now() + 24 * 60 * 60 * 1000 });
  var b64 = Utilities.base64Encode(payload, Utilities.Charset.UTF_8).replace(/[\r\n]/g, '');
  return b64 + '.' + _hmacHex_(payload);
}

/** Token hợp lệ → {u, dn, r, t, exp}; sai/hết hạn → null. */
function validateToken_(token) {
  if (!token) return null;
  try {
    var parts = String(token).split('.');
    if (parts.length !== 2) return null;
    var payload = Utilities.newBlob(Utilities.base64Decode(parts[0].replace(/[\r\n]/g, ''))).getDataAsString();
    if (_hmacHex_(payload) !== parts[1]) return null;
    var d = JSON.parse(payload);
    if (!d.exp || Date.now() > d.exp) return null;
    return d;
  } catch (e) { return null; }
}

function _userRows_() {
  var sh = SpreadsheetApp.openById(USER_SPREADSHEET_ID).getSheetByName(USER_MASTER_SHEET);
  if (!sh) throw new Error('Không thấy User_Master. Liên hệ Admin.');
  var v = sh.getDataRange().getValues();
  var H = v[0].map(function (h) { return String(h).trim(); });
  return { H: H, rows: v.slice(1) };
}
var _isFalse_ = function (x) { return x === false || String(x).toLowerCase() === 'false'; };

/** Đăng nhập bằng tài khoản SHTD → {token, user}. Không ghi Last_Login (để SHTD làm chủ sheet user). */
function authLogin_(username, password) {
  if (!username || !password) throw new Error('Thiếu thông tin đăng nhập.');
  var U = _userRows_(), H = U.H;
  var iUser = H.indexOf('Username'), iDisp = H.indexOf('Display_Name'), iRole = H.indexOf('Role'),
      iTeam = H.indexOf('Team'), iActive = H.indexOf('Active'), iHash = H.indexOf('Password_Hash');
  var lower = String(username).toLowerCase().trim(), hash = _sha256Hex_(password);
  for (var i = 0; i < U.rows.length; i++) {
    var row = U.rows[i];
    if (String(row[iUser]).toLowerCase().trim() !== lower) continue;
    if (_isFalse_(row[iActive])) throw new Error('Tài khoản đã bị vô hiệu hóa. Liên hệ Admin.');
    if (String(row[iHash]).toLowerCase() !== hash) throw new Error('Sai mật khẩu. Vui lòng thử lại.');
    var u = String(row[iUser]), dn = String(row[iDisp] || '') || u, r = String(row[iRole] || '') || 'User', t = String(row[iTeam] || '');
    return { token: makeToken_(u, dn, r, t), user: { username: u, displayName: dn, role: r, team: t } };
  }
  throw new Error('Không tìm thấy tài khoản. Vui lòng kiểm tra lại.');
}

/** Token SHTD có thể đã cũ về role/team/Active → đối chiếu lại User_Master (cache 5 phút). */
function currentUser_(tokenData) {
  var cache = CacheService.getScriptCache(), k = 'u:' + String(tokenData.u).toLowerCase(), hit = cache.get(k);
  if (hit) return JSON.parse(hit);
  var U = _userRows_(), H = U.H, iUser = H.indexOf('Username');
  var row = U.rows.filter(function (r) { return String(r[iUser]).toLowerCase() === String(tokenData.u).toLowerCase(); })[0];
  if (!row || _isFalse_(row[H.indexOf('Active')])) return null;
  var u = { username: String(row[iUser]), displayName: String(row[H.indexOf('Display_Name')] || row[iUser]),
            role: String(row[H.indexOf('Role')] || 'User'), team: String(row[H.indexOf('Team')] || '') };
  cache.put(k, JSON.stringify(u), 300);
  return u;
}

var ROLES_ = ['Admin', 'Teamlead', 'User'];
function isAdmin_(u) { return u.role === 'Admin'; }
function canDirect_(u) { return u.role === 'Admin' || u.role === 'Teamlead'; }         // D10 + A1: nạp/sửa vào thẳng
function canApprove_(u, team) { return u.role === 'Admin' || (u.role === 'Teamlead' && String(team || '') === String(u.team || '')); }
