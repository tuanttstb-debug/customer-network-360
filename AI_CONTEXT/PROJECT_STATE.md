# PROJECT STATE — Customer Network 360

**Cập nhật:** 2026-10-13 · **Version:** 0.1.0 · **Repo:** https://github.com/tuanttstb-debug/customer-network-360 (❓ anh tạo trên GitHub → em push)

## Tóm tắt
Web CN360 v0.1.0 **build xong trong ngày 13/10** theo kế hoạch đã duyệt (`PHUONG_AN_VA_KE_HOACH.md`): FE khuôn SHTD (8 trang) + backend GAS (đã deploy @1, DB đã setup) + lõi đọc 131–331 v0.1. Chờ đưa FE lên GitHub Pages + thử trên máy công ty.

## Đã có
- **Backend GAS** (`gas/`, project `1i_jV1Rc9m1bop4mAy-3x9-oZRdYw7Dzuc5-LhcHtTfrfJF4EMeST3aQY`, deploy `AKfycbxcAd3c…GzH25xw` @1): đăng nhập dùng chung SHTD + SSO token · 9 sheet · nạp lô có khóa ghi, mã DT cấp ở server · duyệt lô/yêu cầu theo team · thay lô cũ · từ chối xóa dòng · gộp đối tác · tham số · KH TPBank · xóa KHHH · nhập kho v0.1 · nhật ký · idempotency reqId · Guard chỉ TK chủ mở file DB. Health check live OK, gọi không token → AUTH_REQUIRED.
- **DB:** `CN360_DB` = `1E4xevOsikNoPh75r9bS91C7COZECG0hPc-9CYL3cwvk` (anh chạy setupAll 13/10).
- **FE** (`index.html` + `assets/` + `core/` + `vendor/`): Tổng quan · Nạp dữ liệu (4 bước v0.1 + D11 tên pháp lý/VietQR, Lưu/Gửi duyệt) · Khách hàng 360 · Đối tác (lây lan, sửa/gộp/kiểm MST) · Cơ hội (09 + 10) · Rủi ro (11 + đối tác ngừng HĐ) · Lô & duyệt · Danh mục (tham số, KH TPBank, tên gộp, xuất Excel, nhập kho v0.1, nhật ký). CSP chặt, không CDN/font ngoài, dữ liệu chỉ trong bộ nhớ trang.
- **Test (dữ liệu giả):** GAS 58/58 · mô hình 34/34 (số tính tay theo template) · E2E Chrome ⇄ backend giả lập 42/42 (0 request ngoài, 0 CSP, 0 lỗi JS, OCR tự host đọc được chữ Việt).

## Nguồn dữ liệu / tích hợp
- SHTD `User_Master` (chỉ đọc) + `AUTH_SECRET` chung · VietQR / doanhnghiep.vn từ trình duyệt (chỉ MST/tên pháp nhân đối tác).

## Đang treo
- [TT] tạo repo GitHub `customer-network-360` (public — chỉ code) → [CC] push + bật Pages.
- [TT] thử trên máy công ty: mở Pages + đăng nhập SHTD + nạp 1 file Excel giả/ẩn danh.
- [TT] xác nhận các teamlead có trong `User_Master` đúng Team (quyền duyệt theo Team).

## Rủi ro / hiện tượng đã biết
- **Ngoại lệ data-boundary** (TD-CN360-01, anh duyệt 13/10) — giữ 9 biện pháp §6.
- GAS chậm/chập chờn → FE timeout 30–120 giây + retry cùng reqId (không ghi lặp).
- Lõi đọc có 2 bản AIOS ↔ core/ (TD-CN360-03).
