# TECH DEBT — Customer Network 360

Nợ kỹ thuật & hiện tượng lặp lại. Mới nhất trên cùng. ID: `TD-CN360-nn`.

## TD-CN360-04 — Chỉ mục MST nội bộ TPBank trên Drive TK chủ + IndexedDB máy người dùng (2026-10-15)
**Hiện tượng:** file nội bộ TPBank (tên + MST ~870k pháp nhân) để trên Drive TK cá nhân và tải về IndexedDB trình duyệt người dùng (ngoại lệ A4 "không lưu dữ liệu trên máy"); bảng MST→CIF chỉ GAS đọc.
**Nguyên nhân:** anh ưu tiên tốc độ tra + trải nghiệm, chấp nhận bảo mật GG Sheet/Drive hiện tại, sẽ gỡ khi có cảnh báo (phỏng vấn 15/10).
**Hướng trả nợ:** nút Admin "Gỡ chỉ mục" + guard hằng ngày · xóa IndexedDB khi đăng xuất/30 ngày · chuyển cùng TD-CN360-01 khi có server nội bộ. **Ưu tiên:** cao (tuân thủ).

## TD-CN360-03 — Lõi đọc 131–331 có 2 bản (AIOS gốc ↔ core/ ở đây) (2026-10-13)
**Hiện tượng:** `core/{parse131,mapping,pipeline,ocr_core,deskew}.js` là bản chép từ AIOS `08_Work/W-2610-he-sinh-thai-131-331/tool/src/`; sửa 1 nơi dễ quên nơi kia (vd vá `\W` cắt chữ có dấu 13/10 phải sửa cả 2).
**Hướng trả nợ:** sau MVP 16/10 chuyển gốc về repo này (A5) — công cụ offline build từ `core/` · tạm thời: sửa ở AIOS rồi `cp` sang + chạy 3 bộ test. **Ưu tiên:** trung.

## TD-CN360-02 — Ghi lại cả bảng mỗi lần ghi (writeTable_) (2026-10-13)
**Hiện tượng:** `Db.gs` ghi lại toàn bộ bảng DoiTac/TenGop/Lo/KHHH (và CongNo khi gộp/từ chối/xóa) — đơn giản, an toàn dưới LockService, ổn ở quy mô vài chục nghìn dòng.
**Hướng trả nợ:** khi CongNo > ~50.000 dòng hoặc ghi > 10 giây → ghi theo dòng / tách sheet theo năm. **Ưu tiên:** thấp.

## TD-CN360-01 — Dữ liệu khách hàng thật trên GAS/Sheets TK cá nhân (ngoại lệ data-boundary) (2026-10-13)
**Hiện tượng:** lưu tên KHHH, đối tác (kể cả cá nhân), số công nợ trên Google Sheets của TK cá nhân anh Tuân (chung SHTD/AIUS).
**Nguyên nhân:** ổ nội bộ không cho web đọc/ghi; Google Workspace TPBank chặn Apps Script ngoài; chưa có server nội bộ. Anh quyết ưu tiên nhu cầu kinh doanh, tự chịu trách nhiệm (duyệt hướng 1 ngày 2026-10-13; chỉ TK chủ được mở file DB gốc).
**Hướng trả nợ:** giữ 9 biện pháp `PHUONG_AN_VA_KE_HOACH.md` §6 + Guard.gs · lớp `net.js` + `Service.gs` tách để chuyển backend sang server/DB nội bộ khi IT cấp · rà lại mỗi `/monthly`. **Ưu tiên:** cao (tuân thủ).
