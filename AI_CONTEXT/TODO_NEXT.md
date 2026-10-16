# TODO NEXT — Customer Network 360

Ưu tiên trên xuống. Owner: [CC]=Claude Code · [TT]=Tuân.

## Cao (2026-10-13 → 2026-10-16)
000. [CC] Hâm cache bảng tên KH (khn:) bằng trigger ~5 giờ/lần — tránh lượt tìm tên đầu chậm 20–40 s sau khi cache 6 giờ hết hạn.
00. [TT] 2026-10-16: push v0.4.1 → thử nạp 4 tệp Excel ICV trên web (Excel là luồng chính) → báo nếu tệp phần mềm khác không nhận được tiêu đề (gửi [CC] tệp để mở rộng).
0. [TT] 2026-10-16: tải chỉ mục `D:\Công việc\USMN\Nen\_build\20261016-1401\` (Danh mục → MST nội bộ) → thử "Chuẩn hóa KHHH" (danh sách + chi tiết) với KHHH đã đổi MST → báo lỗi nếu có.
0b. [TT] Chốt cách xóa 12 KHHH MẪU: (a) xóa tay ×12 · (b) [CC] thêm nút Admin "Xóa bộ MẪU" (1 lần deploy) → rồi team MN nạp lô thật (Hương nạp lại).
2. [TT] Trên máy công ty: kiểm GAS + VietQR không bị mạng TPBank chặn (Hương đã nạp được qua web 11:34 13/10 → GAS OK).
3. [CC] Nới cột "KHHH cầu nối" (Cơ hội) → 3 bộ test → push.
4. [CC] Sau golden Hương (17h 2026-10-14): đo lõi đọc ở AIOS → chép `core/` sang → chạy 3 bộ test.
5. [TT] Quyết cập nhật bản offline `PhatHanh_v0.1` (vá cắt chữ có dấu) cho team MN hay chuyển hẳn sang web.

## Trung bình (UAT 2026-10-30/31)
- [TT] Hướng dẫn team MN (Duyên chủ kho, Hương nạp, QuynhVN6 nghiệm thu) — 30' demo web sau MVP 16/10.
- [CC] Đo giờ 1 vòng/KHHH trên web (KR ≤ 10 phút) · thu lỗi UAT.
- [TT] Chị Dung/Thu chốt ngưỡng (Danh mục → Tham số) · Ly: danh mục KH TPBank (Danh mục → KH TPBank).

## Thấp / Backlog
- Đợt 2: dữ liệu bảo lãnh (07) → các cột BL của mô hình · kỳ tháng/quý cho cảnh báo suy giảm · biểu đồ xu hướng theo kỳ.
- Chuyển gốc lõi đọc về repo này (TD-CN360-03) · phương án chuyển backend sang server nội bộ (TD-CN360-01).
