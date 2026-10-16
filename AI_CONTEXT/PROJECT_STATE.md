# PROJECT STATE — Customer Network 360

**Cập nhật:** 2026-10-16 (tối) · **Version:** 0.4.1 (Excel là luồng nạp chính) · **Repo:** https://github.com/tuanttstb-debug/customer-network-360 (`main` v0.4.0) · **Prod:** https://tuanttstb-debug.github.io/customer-network-360/ ✅ **LIVE** (anh xác nhận 13/10)

## Tóm tắt
Web CN360 v0.1.0 **build + LIVE trong ngày 13/10** theo kế hoạch đã duyệt (`PHUONG_AN_VA_KE_HOACH.md`): FE khuôn SHTD (8 trang) trên GitHub Pages + backend GAS deploy @1 + DB `CN360_DB` + lõi đọc 131–331 v0.1.
- **Dữ liệu DB (13/10):** bộ **MẪU giả lập** từ `CB_Ecosystem_360_TEMPLATE` (12 KHHH `KH001–KH012` · 36 đối tác `KH0xx/DT0xx` · 34 tên gộp · 96 lô `LO20261013-M001…M096` "Đã duyệt", người nạp `MAU` · 480 dòng, gộp tháng→quý Q3/2025–Q2/2026) — ghi qua Sheets connector để test giao diện · **lô thật đầu tiên** `LO20261013-0001` của HuongPTT22 (331, `331 kiểm toán.pdf`, CIF tạm `12345678`, 193 dòng, 171 đối tác mới — tên OCR nhiều chỗ sai) **chờ teamlead MN duyệt**.
- ⚠ Nạp mẫu trùng lúc Hương nạp lô (ghi thẳng Sheet ngoài LockService) — đã kiểm: không mất dòng. **Từ nay không ghi thẳng Sheet khi có người dùng**; muốn xóa bộ mẫu → Admin dùng "Xóa dữ liệu KHHH" cho `KH001–KH012` (hoặc thêm action xóa theo người nạp `MAU`).

## Đã có
- **v0.4.1 (16/10) — Excel là luồng nạp chính** (PDF scan mờ → OCR sai chữ): bộ đọc mới `core/xlsx131.js` đọc sổ tổng hợp công nợ xuất từ phần mềm kế toán **theo cột tiêu đề** (Nợ/Có × đầu kỳ/phát sinh/cuối kỳ, tiêu đề 1–3 dòng, ô gộp), bỏ dòng "Cộng tài khoản", nhận TK `(131,1311,…)` + kỳ năm 2 chữ số/quý/năm/tên tệp, tách 131/331 cùng sheet, suy đầu kỳ khi thiếu; **Mã ĐT dạng MST → điền sẵn MST + khớp đối tác theo MST** (12 số CCCD → cá nhân); TK con ghi vào Ghi chú. Đo 4 tệp thật ICV: **1.076/1.076 dòng cân, tổng 6/6 cột ×4 tệp, 532 dòng có MST từ mã** (đường cũ: 0 dòng cân). Đường cũ (bố cục OCR) giữ làm dự phòng.
- **v0.4.0 (16/10) — KHHH theo dữ liệu TPB** (DEC-20261016-01 ở AIOS): nguyên tắc **CIF + CN theo KH line CB · MST + tên đẹp theo sheet 900k · ĐVKD/PTKD/loại/tỉnh theo BLOCK.xlsx** (hiển thị `001-HKM-Hoàn Kiếm`). Bước ① ô tìm KH (CIF/MST → server; tên → chỉ mục trên máy → server lọc KH TPBank) + bấm Đọc tệp tự tra nốt · lưu lô server tự ghi Tên/MST/CN chuẩn · nút "Chuẩn hóa KHHH" (danh sách — khớp CIF, không có thì MST ra đúng 1 CIF → đổi CIF dây chuyền lô/đối tác) + "Chuẩn hóa theo dữ liệu TPB" (chi tiết — tick trường, chọn tên 900k/hệ thống) · xóa KHHH dọn đối tác mồ côi · màn chờ tải (hard reload không còn "giống bị out") · tra KH ~2,3–4,2 s (cache bucket nén, ghi từng khóa).
- **Backend GAS** (`gas/`, project `1i_jV1Rc9m1bop4mAy-3x9-oZRdYw7Dzuc5-LhcHtTfrfJF4EMeST3aQY`, deploy `AKfycbxcAd3c…GzH25xw` **@7** từ 16/10 14h — `Mst.gs` MST/CIF nội bộ + tìm/chuẩn hóa KHHH; `Db.log_` appendRow): đăng nhập dùng chung SHTD + SSO token · 9 sheet · nạp lô có khóa ghi, mã DT cấp ở server · duyệt lô/yêu cầu theo team · thay lô cũ · từ chối xóa dòng · gộp đối tác · tham số · KH TPBank · xóa KHHH · nhập kho v0.1 · nhật ký · idempotency reqId · Guard chỉ TK chủ mở file DB. Health check live OK, gọi không token → AUTH_REQUIRED.
- **DB:** `CN360_DB` = `1E4xevOsikNoPh75r9bS91C7COZECG0hPc-9CYL3cwvk` (anh chạy setupAll 13/10).
- **FE** (`index.html` + `assets/` + `core/` + `vendor/`): Tổng quan · Nạp dữ liệu (4 bước v0.1 + D11 tên pháp lý/VietQR, Lưu/Gửi duyệt) · Khách hàng 360 · Đối tác (lây lan, sửa/gộp/kiểm MST) · Cơ hội (09 + 10) · Rủi ro (11 + đối tác ngừng HĐ) · Lô & duyệt · Danh mục (tham số, KH TPBank, tên gộp, xuất Excel, nhập kho v0.1, nhật ký). CSP chặt, không CDN/font ngoài, dữ liệu chỉ trong bộ nhớ trang.
- **Test (dữ liệu giả):** GAS 58/58 · mô hình 34/34 (số tính tay theo template) · E2E Chrome ⇄ backend giả lập 42/42 (0 request ngoài, 0 CSP, 0 lỗi JS, OCR tự host đọc được chữ Việt).

## Nguồn dữ liệu / tích hợp
- SHTD `User_Master` (chỉ đọc) + `AUTH_SECRET` chung · VietQR / doanhnghiep.vn từ trình duyệt (chỉ MST/tên pháp nhân đối tác).

## Đang treo
- [TT] Tải chỉ mục **`_build\20261016-1401\`** (2 tên + PTKD/loại/tỉnh) → thử chuẩn hóa KHHH đã đổi MST · xóa 12 KHHH MẪU (chưa chốt cách: tay ×12 hay nút Admin) → team MN nạp lô thật.
- [TT] teamlead MN duyệt/từ chối lô `LO20261013-0001` (soát tên OCR bằng ảnh gốc trước) · xác nhận teamlead trong `User_Master` đúng Team.
- [CC] cột "KHHH cầu nối" trang Cơ hội hẹp → nới · action Admin xóa bộ mẫu `MAU` một lần.

## Rủi ro / hiện tượng đã biết
- **Ngoại lệ data-boundary** (TD-CN360-01, anh duyệt 13/10) — giữ 9 biện pháp §6.
- GAS chậm/chập chờn → FE timeout 30–120 giây + retry cùng reqId (không ghi lặp).
- Lõi đọc có 2 bản AIOS ↔ core/ (TD-CN360-03).
