# PROJECT STATE — Customer Network 360

**Cập nhật:** 2026-10-13 · **Version:** 0.1.0 · **Repo:** https://github.com/tuanttstb-debug/customer-network-360 (`main` `22ad475`) · **Prod:** https://tuanttstb-debug.github.io/customer-network-360/ ✅ **LIVE** (anh xác nhận 13/10)

## Tóm tắt
Web CN360 v0.1.0 **build + LIVE trong ngày 13/10** theo kế hoạch đã duyệt (`PHUONG_AN_VA_KE_HOACH.md`): FE khuôn SHTD (8 trang) trên GitHub Pages + backend GAS deploy @1 + DB `CN360_DB` + lõi đọc 131–331 v0.1.
- **Dữ liệu DB (13/10):** bộ **MẪU giả lập** từ `CB_Ecosystem_360_TEMPLATE` (12 KHHH `KH001–KH012` · 36 đối tác `KH0xx/DT0xx` · 34 tên gộp · 96 lô `LO20261013-M001…M096` "Đã duyệt", người nạp `MAU` · 480 dòng, gộp tháng→quý Q3/2025–Q2/2026) — ghi qua Sheets connector để test giao diện · **lô thật đầu tiên** `LO20261013-0001` của HuongPTT22 (331, `331 kiểm toán.pdf`, CIF tạm `12345678`, 193 dòng, 171 đối tác mới — tên OCR nhiều chỗ sai) **chờ teamlead MN duyệt**.
- ⚠ Nạp mẫu trùng lúc Hương nạp lô (ghi thẳng Sheet ngoài LockService) — đã kiểm: không mất dòng. **Từ nay không ghi thẳng Sheet khi có người dùng**; muốn xóa bộ mẫu → Admin dùng "Xóa dữ liệu KHHH" cho `KH001–KH012` (hoặc thêm action xóa theo người nạp `MAU`).

## Đã có
- **Backend GAS** (`gas/`, project `1i_jV1Rc9m1bop4mAy-3x9-oZRdYw7Dzuc5-LhcHtTfrfJF4EMeST3aQY`, deploy `AKfycbxcAd3c…GzH25xw` @1): đăng nhập dùng chung SHTD + SSO token · 9 sheet · nạp lô có khóa ghi, mã DT cấp ở server · duyệt lô/yêu cầu theo team · thay lô cũ · từ chối xóa dòng · gộp đối tác · tham số · KH TPBank · xóa KHHH · nhập kho v0.1 · nhật ký · idempotency reqId · Guard chỉ TK chủ mở file DB. Health check live OK, gọi không token → AUTH_REQUIRED.
- **DB:** `CN360_DB` = `1E4xevOsikNoPh75r9bS91C7COZECG0hPc-9CYL3cwvk` (anh chạy setupAll 13/10).
- **FE** (`index.html` + `assets/` + `core/` + `vendor/`): Tổng quan · Nạp dữ liệu (4 bước v0.1 + D11 tên pháp lý/VietQR, Lưu/Gửi duyệt) · Khách hàng 360 · Đối tác (lây lan, sửa/gộp/kiểm MST) · Cơ hội (09 + 10) · Rủi ro (11 + đối tác ngừng HĐ) · Lô & duyệt · Danh mục (tham số, KH TPBank, tên gộp, xuất Excel, nhập kho v0.1, nhật ký). CSP chặt, không CDN/font ngoài, dữ liệu chỉ trong bộ nhớ trang.
- **Test (dữ liệu giả):** GAS 58/58 · mô hình 34/34 (số tính tay theo template) · E2E Chrome ⇄ backend giả lập 42/42 (0 request ngoài, 0 CSP, 0 lỗi JS, OCR tự host đọc được chữ Việt).

## Nguồn dữ liệu / tích hợp
- SHTD `User_Master` (chỉ đọc) + `AUTH_SECRET` chung · VietQR / doanhnghiep.vn từ trình duyệt (chỉ MST/tên pháp nhân đối tác).

## Đang treo
- **[CC] Tra MST/CIF nội bộ TPBank (WIP `wip/mst-noi-bo`, 2026-10-15):** code + test GAS/MST xong, E2E MST còn 1 lỗi → chưa deploy. Thiết kế: `PHUONG_AN_TRA_MST_NOI_BO.md`.
- [TT] teamlead MN duyệt/từ chối lô `LO20261013-0001` (soát tên OCR bằng ảnh gốc trước) · xác nhận teamlead trong `User_Master` đúng Team.
- [CC] cột "KHHH cầu nối" trang Cơ hội hẹp → nới · action Admin xóa bộ mẫu `MAU` một lần.

## Rủi ro / hiện tượng đã biết
- **Ngoại lệ data-boundary** (TD-CN360-01, anh duyệt 13/10) — giữ 9 biện pháp §6.
- GAS chậm/chập chờn → FE timeout 30–120 giây + retry cùng reqId (không ghi lặp).
- Lõi đọc có 2 bản AIOS ↔ core/ (TD-CN360-03).
