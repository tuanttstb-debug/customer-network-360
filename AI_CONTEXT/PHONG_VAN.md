---
id: PRJ-CN360-PHONGVAN
type: interview
title: Phỏng vấn anh Tuân — Customer Network 360 (web thay vòng nhập/xuất kho Excel của công cụ 131–331)
owner: PER-TTT
created: 2026-10-13
updated: 2026-10-13
---

# Phỏng vấn 2026-10-13 (3 vòng, Claude Code)

## Đề bài anh giao
Tham khảo kiến trúc, UI, chức năng FE/BE của SHTD → đề xuất phương án khắc phục việc **phải nhập/xuất dữ liệu liên tục** của công cụ 131–331 (HTML offline v0.1) → **web độc lập, đăng nhập chung user/mật khẩu với SHTD (giống AIUS)**.

## Em hiểu "nhập/xuất liên tục" là 3 việc tay
1. Mỗi lượt: mở file kho Excel từ ổ team → làm xong **tải kho về, lưu đè** (dễ đè nhầm, 2 người làm song song là mất dữ liệu).
2. Dán 7 sheet vào bản sao `CB_Ecosystem_360_TEMPLATE.xlsx`, kéo công thức 08/11 (template lỗi, phải repair).
3. Nạp file vào `CB_Ecosystem_360_Dashboard.html` mới tra cứu được.

## Câu trả lời của anh
| # | Câu hỏi | Anh chốt |
|---|---|---|
| D01 | Lưu dữ liệu thật ở đâu | **GAS + Google Sheets.** Ổ nội bộ `\\ho-file01` không cho web đọc/ghi/load file trực tiếp → phương án ổ team loại. "Làm theo phương án GAS, hạn chế các quyền tiếp cận khác ngoài DB để đáp ứng nhu cầu kinh doanh trước." |
| D02 | Phạm vi v1 | **Kho tự lưu + dashboard trong web** (bỏ template Excel + dán tay; vẫn có nút xuất Excel). |
| D03 | Người dùng | **Toàn Trung tâm** (mọi user `User_Master`), PTKD MN đợt đầu. |
| D04 | Mốc | **16/10 giữ bản HTML offline** cho MVP việc lớn; web làm song song, chạy thật sau. |
| D05 | Tài khoản Google | **TK cá nhân của anh, chung với SHTD + AIUS.** Google Workspace TPBank đã chặn Apps Script ngoài — SHTD từng thử chuyển về TK TPBank và phải quay lại. |
| D06 | Phê duyệt nạp dữ liệu thật | **Anh tự chịu trách nhiệm** — không xin thêm; ghi DEC ngoại lệ. |
| D07 | Tối thiểu hóa dữ liệu | **Lưu đầy đủ như kho hiện tại** (kể cả tên đối tác cá nhân). Không lưu file gốc (OCR vẫn chạy trên máy — em giữ mặc định này vì không đổi giá trị dùng). |
| D08 | Tên dự án | `customer-network-360` · **PRJ-CN360** · GitHub Pages cùng tên (chỉ code). |
| D09 | Xem xuyên team | **Mọi user thấy đầy đủ mọi team** (mạng lưới + số liệu). |
| D10 | Quyền sửa | **Admin nạp/sửa trực tiếp; member đẩy lên → teamlead duyệt** (áp cho cả lô công nợ lẫn danh mục đối tác). |
| D11 | Dashboard | **Thiết kế lại theo UI SHTD** (sidebar, token màu, thẻ, bảng) — không port dashboard của Sơn. |

| D12 | Duyệt kế hoạch (13/10) | **Duyệt, giữ GAS lưu dữ liệu rõ** (che/mã hóa gây hạn chế xuất dữ liệu + tra cứu về sau) — **chỉ TK anh được mở thẳng file DB gốc**. A1–A6 chấp nhận. |
| D13 | Triển khai | BE: `clasp` project `1i_jV1Rc…` deploy @1 · DB `CN360_DB` = `1E4xevOsikNoPh75r9bS91C7COZECG0hPc-9CYL3cwvk` (anh chạy setupAll 13/10). FE: GitHub Pages repo `customer-network-360`. |

## Em tự giả định (anh đã chấp nhận khi duyệt 13/10)
- **A1** Teamlead nạp lô của chính mình → vào thẳng (teamlead là người duyệt); duyệt lô của member **cùng team**; Admin duyệt mọi team.
- **A2** Lô chờ duyệt chỉ người nạp + teamlead cùng team + Admin thấy; dashboard chỉ tính dữ liệu đã duyệt.
- **A3** Team của bản ghi = team của người nạp (cột `Team` trong `User_Master`).
- **A4** Không cache dữ liệu KH bền trên máy (không localStorage/IndexedDB) — chỉ bộ nhớ trang; đóng tab là hết.
- **A5** Lõi đọc/gộp (parse131, mapping, pipeline, deskew, ocr_core) chuyển về repo này làm **nguồn gốc** sau 16/10; công cụ offline trong AIOS đóng băng v0.1 (hoặc build từ đây).
- **A6** Kho Excel v0.1 team MN đã có → có nút **nhập 1 lần** (migration) vào web.
