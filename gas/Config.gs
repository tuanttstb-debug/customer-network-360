// ── Customer Network 360 — cấu hình backend (GAS) ──
// Spreadsheet user DÙNG CHUNG với SHTD-Dashboard + AIUS: chỉ ĐỌC sheet User_Master để xác thực.
// DB riêng CN360 (CN360_DB) tạo bởi setupAll() → ID lưu Script Property DB_ID.
// Chỉ TÀI KHOẢN CHỦ (anh Tuân) mở được file DB gốc: setupAll() + trigger hằng ngày gỡ mọi editor/viewer khác (Guard.gs).
// Script Property bắt buộc: AUTH_SECRET = ĐÚNG giá trị AUTH_SECRET của GAS SHTD (token cấp bên nào cũng verify được).
// Ngoại lệ data-boundary do anh Tuân duyệt 2026-10-13 (hướng 1 — lưu dữ liệu rõ, hạn chế quyền xem file gốc).

var USER_SPREADSHEET_ID = '1cpg1p_8TGGbvZNNWZmjsKANqHW1tQijbiQBFLYn56Hk';
var USER_MASTER_SHEET   = 'User_Master';
var APP_VERSION         = 'cn360-gas 0.1.1 (2026-10-24)';
var WRITE_LOCK_MS       = 25000;

// Tên sheet + cột (dòng 1 = tiêu đề; code đọc theo TÊN cột → thêm cột phụ bên phải không vỡ)
var SCHEMA = {
  KHHH:      ['CIF', 'MST', 'Tên khách hàng', 'Tên viết tắt', 'Ngành', 'Phân khúc', 'ĐVKD', 'RM/PTKD phụ trách', 'Team', 'Người tạo', 'Ngày tạo'],
  DoiTac:    ['Counterparty_ID', 'MST', 'Tên pháp lý', 'Tên rút gọn', 'Cá nhân', 'Trạng thái MST', 'Nguồn MST', 'Đã là KHHH', 'CIF (nếu là KH TP)', 'Ngành', 'Ghi chú', 'Trạng thái', 'Lô tạo', 'Người tạo', 'Ngày tạo', 'Ngày sửa'],
  TenGop:    ['Tên gốc', 'Khóa', 'Counterparty_ID', 'Trạng thái', 'Người', 'Ngày', 'Lô'],
  KH_TPBank: ['CIF', 'MST', 'Tên khách hàng', 'CN'],
  Lo:        ['Batch_ID', 'CIF', 'Tên KHHH', 'CN', 'TK', 'Kỳ', 'Kỳ gốc', 'Tệp', 'Số dòng', 'Dòng cân đối', 'Trạng thái', 'Người nạp', 'Team', 'Ngày nạp', 'Người duyệt', 'Ngày duyệt', 'Lý do', 'Thay thế bởi'],
  CongNo:    ['Batch_ID', 'Dòng', 'Mã ĐT nội bộ', 'Tên đối tác gốc', 'Counterparty_ID', 'Dư Nợ đầu kỳ', 'Dư Có đầu kỳ', 'Phát sinh Nợ', 'Phát sinh Có', 'Dư Nợ cuối kỳ', 'Dư Có cuối kỳ', 'Cân đối', 'Trang', 'Ghi chú'],
  YeuCau:    ['Req_ID', 'Loại', 'Counterparty_ID', 'Trước', 'Sau', 'Người đề nghị', 'Team', 'Ngày', 'Trạng thái', 'Người duyệt', 'Ngày duyệt', 'Lý do'],
  NhatKy:    ['Thời điểm', 'Người', 'Vai trò', 'Team', 'Hành động', 'Đối tượng', 'Chi tiết'],
  Config:    ['Khóa', 'Giá trị', 'Mô tả'],
};

// Tham số mô hình — mặc định = 13_Lists của CB_Ecosystem_360_TEMPLATE (team PTKD MN). Admin sửa ở trang Danh mục.
var CONFIG_DEFAULTS = [
  ['NEXT_DT', 1, 'Số thứ tự mã đối tác kế tiếp (DTxxxxx) — máy tự tăng, không sửa tay'],
  ['NEXT_LO', 1, 'Số thứ tự lô kế tiếp — máy tự tăng'],
  ['NEXT_YC', 1, 'Số thứ tự yêu cầu kế tiếp — máy tự tăng'],
  ['Ngày báo cáo', '', 'Để trống = tự lấy kỳ mới nhất trong dữ liệu (yyyy-mm-dd)'],
  ['Ngày bắt đầu theo dõi', '2025-07-01', 'Tính số tháng hoạt động của quan hệ'],
  ['Ngưỡng tập trung cao', 0.4, 'Tỷ trọng ≥ ngưỡng → mức tập trung Cao'],
  ['Ngưỡng tập trung theo dõi', 0.3, 'Tỷ trọng ≥ ngưỡng → có cảnh báo tập trung'],
  ['Ngưỡng suy giảm', -0.3, 'PS phải thu 3 tháng gần nhất giảm ≤ ngưỡng so 3 tháng trước → Suy giảm đầu ra'],
  ['Benchmark quy mô quan hệ', 50000000000, 'VND — quy mô đạt điểm tối đa ở điểm sức mạnh quan hệ / tham chiếu'],
  ['Benchmark BL còn hiệu lực', 20000000000, 'VND — dùng khi có dữ liệu bảo lãnh (đợt 2)'],
  ['Ngưỡng Opportunity P1', 75, 'Điểm cơ hội ≥ → P1 - Tiếp cận ngay'],
  ['Ngưỡng Opportunity P2', 55, 'Điểm cơ hội ≥ → P2 - Xác minh'],
  ['Benchmark quy mô cơ hội', 800000000000, 'VND — quy mô đạt điểm tối đa ở điểm cơ hội'],
  ['Ngưỡng gợi ý gộp tên', 0.85, 'Độ giống tên ≥ ngưỡng → gợi ý gộp chờ người duyệt (không tự gộp)'],
];
var CONFIG_ADMIN_EDITABLE = CONFIG_DEFAULTS.map(function (r) { return r[0]; }).filter(function (k) { return k.indexOf('NEXT_') !== 0; });
