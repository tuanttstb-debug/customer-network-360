'use strict';
/* Cấu hình FE — Customer Network 360. GAS URL công khai nhưng mọi action dữ liệu đều cần token (Code.gs). */
window.CN = window.CN || {};
CN.CONFIG = {
  VERSION: 'v0.4.3 (2026-10-16)',
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxcAd3cF3fWI_4lip1Prvv7_dg6M6Ja4ZfmdpLZG7LOJXlBgUSq3r0gP2dMxHgGzH25xw/exec',
  AUTH_KEY: 'cn360_auth_v1',      // phiên riêng CN360 (chỉ token + thông tin user — KHÔNG lưu dữ liệu khách hàng trên máy, A4)
  SHTD_AUTH_KEY: 'shtd_auth_v1',  // phiên SHTD cùng origin tuanttstb-debug.github.io → SSO
  TIMEOUT_MS: 30000,
  READ_TIMEOUT_MS: 90000,
};
