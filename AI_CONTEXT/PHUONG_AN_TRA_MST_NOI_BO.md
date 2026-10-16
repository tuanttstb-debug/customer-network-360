# PHƯƠNG ÁN — Tra MST/CIF nội bộ trước công cụ ngoài (CN360)

> **Trạng thái:** ĐÃ DUYỆT 2026-10-15 (3 điểm §7 đồng ý) → đang triển khai (nhánh `wip/mst-noi-bo`, xem SESSION_HANDOVER) · Nguồn phỏng vấn: phiên 15/10 (7 câu) · Không chứa dữ liệu — chỉ logic + số đếm tổng.
> ⚠ **Dữ liệu nội bộ TPBank — TUYỆT ĐỐI không vào Git.** File gốc + file build nằm ngoài repo: `D:\Công việc\USMN\Nen\` (repo chỉ ghi đường dẫn).

## 1. Mục tiêu
Tên đối tác (sổ 131/331, nạp lô hoặc trang Đối tác) → **tự tra file nội bộ trước** lấy MST + CIF (nếu là KH CB TPBank) → chỉ khi không ra mới gọi VietQR/doanhnghiep.vn. Ưu tiên **trải nghiệm + tốc độ**. Người dùng: team MN + **Trung tâm SP** (đăng nhập chung SHTD, log như hiện tại).

## 2. Dữ liệu nguồn (quét 15/10)
| Sheet | Dòng | Dùng | Ghi chú |
|---|---|---|---|
| `data mst 900l` | 799.999 | Tên → MST | MST duy nhất · 98,7k mã chi nhánh `-xxx` · tên HOA có dấu · `MST 2` = `MST` (bỏ) · không có địa chỉ/trạng thái · đã lọc KH không active |
| `KH line CB` | 133.882 CIF | MST → CIF + bổ sung tên | tên **không dấu** · bỏ MST 12 số (cá nhân/HKD) → 111.292 pháp nhân · 70.946 MST không có trong sheet 1 |
→ **Chỉ mục tên: 870.945 pháp nhân** · 6.069 tên trùng nhiều MST (chủ yếu chi nhánh) → khớp tên phải chấm điểm, có danh sách ứng viên.

## 3. Đánh giá phương án
| PA | Cách | Tốc độ tra | Ưu | Nhược |
|---|---|---|---|---|
| A | Mỗi người tự chọn file xlsx trên máy → trình duyệt dựng chỉ mục | tức thì | 0 dữ liệu lên cloud | mỗi người phải giữ file 53 MB, nạp lại khi có bản mới → **UX kém**, TT SP khó dùng |
| B | Đổ 870k dòng vào Google Sheet, GAS quét mỗi lần tra | 10–30 s/lần | đơn giản | quá chậm, dễ quá giờ GAS (6 phút) khi tra cả lô |
| C | GAS tra theo chỉ mục chia mảnh trên Drive | 2–4 s/lần | dữ liệu không rời server | mỗi lần tra đều chờ GAS; fuzzy nhiều mảnh phức tạp |
| **D (đề xuất)** | **Lai:** chỉ mục tên→MST (~8–12 MB nén) để trên Drive, **tải về trình duyệt 1 lần/máy/phiên bản** (IndexedDB) → tra tại máy · **MST→CIF giữ ở GAS**, tra 1 lời gọi/lô | **< 0,1 s/tên, cả lô 500 đối tác ~1 s** | nhanh nhất, máy anh **không cần bật** · cập nhật = thay file trên Drive | lần đầu tải 10–20 s (có thanh tiến độ) · mỗi máy giữ bản tên+MST pháp nhân (không có CIF) |

**Lý do chọn D:** tên + MST pháp nhân phần lớn là thông tin đăng ký DN công khai → để ở trình duyệt chấp nhận được; phần nhạy cảm thật (**ai là KH TPBank — CIF**) không rời server, chỉ trả về cho MST đang tra, có log. Chỉ mục **không** đánh dấu dòng nào đến từ `KH line CB`.

## 4. Kiến trúc
```
[Máy anh] Python build (tools/build_mst_index.py — code ở repo, dữ liệu KHÔNG)
   TRA CUU MST.xlsx → name_index_vN.json.gz (MST·tên chuẩn hóa·tên hiển thị) + cif_map_vN.json.gz
   → anh kéo 2 file vào thư mục Drive CN360_MST (TK chủ) · ghi version
[GAS] mstMeta (version, kích thước) · mstChunk(i) (trả từng mảnh ~2 MB, có token) · cifLookup([MST…]) (Cache 6h) · log NhatKy
[FE]  mstidx.js: tải mảnh → giải nén (DecompressionStream) → IndexedDB → dựng chỉ mục token trong Web Worker
      Tra: Nội bộ → (khớp chắc) điền MST + gọi cifLookup → nút "Kiểm VietQR" lấy trạng thái · (không ra) → doanhnghiep.vn
```
- **Chuẩn hóa tên** (cùng 1 hàm Python ↔ JS, có test): bỏ dấu · HOA · bỏ ký tự đặc biệt · mở viết tắt (CTY→CONG TY, CP→CO PHAN, TM→THUONG MAI, DV→DICH VU, XD→XAY DUNG, SX→SAN XUAT, XNK→XUAT NHAP KHAU, MTV→MOT THANH VIEN, DNTN…) · tách **loại hình** (TNHH/CP/DNTN/CN) khỏi **tên lõi**.
- **Chấm điểm:** chỉ mục ngược token tên lõi (trọng số IDF) → ứng viên → điểm = độ trùng token có trọng số + tương đồng ký tự (chịu lỗi OCR) + thưởng khớp loại hình · mã chi nhánh `-xxx` xếp sau trừ khi tên có "CHI NHANH".
- **Ngưỡng (đã duyệt câu 5):** 1 ứng viên điểm cao, cách xa ứng viên 2 → **tự điền** · còn lại → danh sách ≤ 5 ứng viên để chọn · nguồn ghi `Nội bộ TPBank vN (dd/mm)`. Ngưỡng cụ thể đo trên golden (§6).
- **Lưu (đã duyệt câu 4):** `DoiTac` thêm cột **CIF** + nguồn MST · trang Cơ hội: cờ "KH TPBank" lấy từ CIF.

## 5. Biện pháp bảo vệ (bổ sung TD-CN360-01)
1. `.gitignore`: `*.xlsx`, `*.json.gz`, `_build/`, `mst_index*` · script build đọc/ghi **ngoài repo** · hook chặn file > 5 MB.
2. GAS chỉ trả mảnh chỉ mục khi token hợp lệ; `cifLookup` giới hạn ≤ 1.000 MST/lần, log người + số lượng.
3. IndexedDB xóa khi đăng xuất / quá 30 ngày; không có nút xuất toàn bộ chỉ mục.
4. Gỡ: xóa 2 file Drive → mọi máy hết tra nội bộ ở lần mở sau (anh gỡ khi có cảnh báo).

## 6. Kế hoạch (sau khi anh duyệt) — ~1 ngày công [CC]
| B | Việc | Kiểm |
|---|---|---|
| 1 | `tools/build_mst_index.py` + hàm chuẩn hóa dùng chung + test | test chuẩn hóa ≥ 30 ca (dữ liệu giả) |
| 2 | Đo độ khớp trên **golden** (đối tác đã có MST trong lô thật/golden Hương) → chốt ngưỡng | báo anh: % tự điền đúng · % sai · % không ra |
| 3 | GAS: `mstMeta`/`mstChunk`/`cifLookup` + cột CIF + test GAS | clasp push + deploy @2 |
| 4 | FE: `mstidx.js` (Worker) + gắn bước ③ Nạp dữ liệu (tra cả lô) + nút "Tìm MST" trang Đối tác + cờ KH TPBank trang Cơ hội | E2E (chỉ mục giả) · 0 request ngoài whitelist |
| 5 | Anh kéo file thật lên Drive → thử trên máy công ty (tốc độ tải lần đầu, tra lô) | |

## 7. Cần anh xác nhận khi duyệt
1. **PA D** — chấp nhận chỉ mục tên+MST pháp nhân (không CIF) tải về trình duyệt người dùng?
2. TT SP dùng ngay trong CN360 (bước nạp/Đối tác) là đủ, hay cần thêm **trang "Tra cứu MST"** riêng (ô tìm + dán danh sách → xuất Excel)? Em đề xuất để đợt sau.
3. Golden đo ngưỡng: em dùng danh sách đối tác đã có MST trong các lô thật hiện có — OK?
