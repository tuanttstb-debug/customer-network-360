---
id: PRJ-CN360-PLAN
type: plan
title: Customer Network 360 — đánh giá phương án + kiến trúc + kế hoạch triển khai (bản chờ anh duyệt)
owner: PER-TTT
status: da-duyet   # anh Tuân duyệt 2026-10-13 (hướng 1: GAS lưu dữ liệu rõ, chỉ TK chủ mở file DB gốc) — A1–A6 chấp nhận
created: 2026-10-13
updated: 2026-10-13
related: [PHONG_VAN.md, AIOS/05_Journal/decisions/DEC-20261013-02, AIOS/08_Work/W-2610-he-sinh-thai-131-331]
---

# Customer Network 360 — phương án & kế hoạch v0.1

> Căn cứ: phỏng vấn 13/10 (`PHONG_VAN.md` D01–D11, A1–A6) · đọc code SHTD v6.67 (`backend/Code.gs`, `AuthService.gs`, `Concurrency.gs`, `assets/css/tokens.css`) + AIUS (`assets/gas-backend/AuthTokenService.gs`) · công cụ 131–331 v0.1 (AIOS `08_Work/W-2610-he-sinh-thai-131-331/tool/`).
> **Chưa code cho tới khi anh duyệt file này.**

## 1. Vấn đề & mục tiêu
- **Hôm nay (HTML offline v0.1):** mỗi lượt mở kho Excel → làm → tải kho, lưu đè · dán 7 sheet vào template + kéo công thức · nạp dashboard HTML. 3 bước tay, 1 người làm 1 lúc, dễ đè mất dữ liệu.
- **Mục tiêu v1:** đăng nhập bằng tài khoản SHTD → nạp tệp 131/331 → duyệt → **tự lưu vào DB dùng chung** → tra cứu mạng lưới + cơ hội + rủi ro **ngay trên web**. Không còn file kho, không còn template trung gian. Vẫn xuất Excel khi cần.
- **KR đề xuất:** 1 vòng/KHHH (nạp → có trên dashboard) ≤ 10 phút (KR team 180 → 10) · 0 bước dán tay · nhiều người nạp cùng lúc không mất dòng · ≥ 95% ô đúng trên golden (thừa hưởng lõi v0.1).

## 2. Đánh giá phương án lưu trữ
| Phương án | Kết luận | Lý do |
|---|---|---|
| Ổ team `\\ho-file01` + File System Access API | ❌ loại | Anh xác nhận ổ nội bộ không cho web đọc/ghi/load file (D01). |
| Server/DB nội bộ TPBank | ⏸ dài hạn | Đúng chuẩn nhất nhưng phụ thuộc IT, không kịp 2026. Giữ thiết kế tách lớp để chuyển sau (mục 9). |
| Google Workspace TPBank | ❌ không khả dụng | Workspace TPBank chặn Apps Script ngoài; SHTD đã thử và phải quay lại TK cá nhân (D05). |
| **GAS + Google Sheets trên TK cá nhân (chung SHTD/AIUS)** | ✅ **chọn** | Anh quyết (D01, D05, D06) — đáp ứng kinh doanh trước. **Ngoại lệ luật cứng #1 data-boundary** → DEC-20261013-02, kèm biện pháp kỹ thuật bắt buộc ở mục 6. |

**Rủi ro tồn dư em phải nói rõ (anh đã chấp nhận — D06):** dữ liệu khách hàng ngân hàng (tên KHHH, đối tác, số công nợ, cả cá nhân) nằm trên tài khoản Google cá nhân, ngoài kiểm soát của ngân hàng; trách nhiệm giải trình thuộc anh. Biện pháp ở mục 6 giảm khả năng lộ, **không** làm hết rủi ro tuân thủ.

## 3. Kiến trúc (theo khuôn SHTD/AIUS)
```
Trình duyệt (Chrome/Edge, máy công ty)
  GitHub Pages: tuanttstb-debug.github.io/customer-network-360/   ← chỉ code, không dữ liệu
  ├─ index.html (SPA: sidebar + topbar kiểu SHTD)  · assets/css (tokens.css chép từ SHTD) · assets/js/*
  ├─ core/  (lõi 131–331 đã test: ocr_core · deskew · parse131 · mapping · pipeline)  ← OCR CHẠY TẠI MÁY
  └─ vendor/ (pdf.js · tesseract + mô hình vie · SheetJS — tự host, không CDN)
          │  fetch POST text/plain {action, token, ...}   (giống SHTD doPost)
          ▼
  GAS project CN360 (TK anh, Execute as Me)  — Code.gs · AuthTokenService.gs (chép AIUS) · Repo*.gs · Audit.gs
          │  token HMAC dùng chung AUTH_SECRET với SHTD/AIUS · đọc User_Master (SHTD) chỉ để xác thực
          ▼
  Spreadsheet CN360_DB (riêng, KHÔNG chia sẻ ai)          Spreadsheet SHTD → User_Master (chỉ đọc)
```
- **Đăng nhập chung:** form username/mật khẩu SHTD → `auth-login` trên GAS CN360 (đọc `User_Master`, cấp token 24 giờ như AIUS). **SSO:** cùng origin `tuanttstb-debug.github.io` → nếu đang đăng nhập SHTD, web đọc phiên SHTD và GAS CN360 xác minh được token (cùng `AUTH_SECRET`) → vào thẳng. Quản lý user/role/team **chỉ ở SHTD** (như AIUS).
- **File gốc không rời máy:** PDF/ảnh/Excel đọc bằng lõi tại trình duyệt; chỉ **dòng số đã duyệt** + tên đối tác/MST gửi lên GAS.
- **Tra MST** giữ như v0.1 (VietQR / doanhnghiep.vn từ trình duyệt, chỉ gửi MST/tên pháp nhân đối tác).

## 4. Mô hình dữ liệu (CN360_DB — mở rộng từ kho v0.1)
| Sheet | Khóa | Nội dung chính |
|---|---|---|
| `KHHH` | CIF | MST, tên, ngành, phân khúc, CN/ĐVKD, RM, **Team** |
| `DoiTac` | Counterparty_ID `DTxxxxx` (cấp ở server, có khóa) | MST, tên pháp lý, tên rút gọn, cá nhân, trạng thái MST, nguồn MST, đã là KH TPBank, CIF TP, ghi chú |
| `TenGop` | tên chuẩn hóa | tên gốc → Counterparty_ID, trạng thái (Máy gộp/Đã duyệt), người, ngày |
| `KH_TPBank` | CIF | danh mục KH tại TPBank (CIF, MST, tên, CN) — nền "đã là KH" |
| `Lo` | Batch_ID | KHHH, TK, kỳ, tệp (chỉ tên tệp), người nạp, team, **trạng thái** (Nháp/Chờ duyệt/Đã duyệt/Từ chối/Thay thế), người duyệt, thời điểm, số dòng, cân đối |
| `CongNo` | Batch_ID + dòng | Counterparty_ID, tên gốc, ĐK/PS/CK Nợ–Có, cờ cân đối |
| `YeuCau` | Req_ID | đề nghị sửa danh mục (đổi tên/MST, gộp, tách mã) — trước/sau, người đề nghị, trạng thái, người duyệt |
| `NhatKy` | — | ai · lúc nào · action (đăng nhập, xem KHHH, xuất Excel, duyệt, sửa) · đối tượng |
| `Config` | — | NEXT_DT, ngưỡng gợi ý gộp (85%), ngưỡng tập trung/rủi ro (chị Dung/Thu chốt), danh sách Admin bổ sung |

- **Nạp lại cùng KHHH + TK + kỳ:** lô mới khi được duyệt → lô cũ chuyển "Thay thế" (không xóa, truy vết được) — giữ quy tắc "thay lô cũ, không nhân đôi" của v0.1.
- **Các bảng 08–11 của template** (cạnh quan hệ, cơ hội, tham chiếu, cảnh báo rủi ro) **tính bằng code** khi tải dashboard — không lưu, không công thức Excel.

## 5. Quyền & luồng duyệt (D03, D09, D10, A1–A3)
| Vai trò (`User_Master`) | Xem | Nạp lô công nợ | Sửa danh mục đối tác | Duyệt |
|---|---|---|---|---|
| **Admin** | tất cả | vào thẳng | trực tiếp | mọi team |
| **Teamlead** | tất cả (đã duyệt) + lô chờ của team | vào thẳng (A1) | trực tiếp với đối tác mới; đối tác đã có → trực tiếp (là người duyệt) | lô + yêu cầu của member **cùng team** |
| **User (member)** | tất cả (đã duyệt) + lô của mình | → **Chờ duyệt** | → `YeuCau` chờ duyệt | — |

Luồng member: nạp tệp → duyệt ô đỏ tại máy (như bước ② v0.1) → gộp/MST (bước ③) → **Gửi duyệt** → teamlead nhận badge "chờ duyệt" (chỉ đếm mục cần chú ý — như SHTD) → mở lô, xem số + so lô cũ → Duyệt/Từ chối kèm lý do → dashboard cập nhật.

## 6. Biện pháp hạn chế tiếp cận (bắt buộc — điều kiện của DEC ngoại lệ)
1. **Mọi action GAS kiểm token + role** (khuôn `doPost` SHTD); không có endpoint đọc dữ liệu không cần token; quyền ghi/duyệt kiểm ở server, không tin client.
2. **Spreadsheet CN360_DB không chia sẻ ai** (kể cả "anyone with link"); chỉ GAS (Execute as Me) đọc/ghi. GAS deployment "Anyone" chỉ là cửa vào HTTP, vẫn chặn bằng token. **Điều kiện anh đặt khi duyệt (13/10): chỉ TK chủ mở được file DB gốc** → `Guard.gs`: setupAll + trigger 7h hằng ngày gỡ link công khai/editor/viewer khác, ghi "CẢNH BÁO chia sẻ" vào NhatKy.
3. **Không lưu file gốc** (PDF/scan/BCTC) ở bất cứ đâu ngoài máy người dùng.
4. **Không cache bền dữ liệu KH trên máy** (A4): không localStorage/IndexedDB cho dữ liệu nghiệp vụ; token + tùy chọn giao diện thì được.
5. **Nhật ký truy cập** (`NhatKy`): đăng nhập, xem chi tiết KHHH/đối tác, xuất Excel, duyệt, sửa — Admin xem được.
6. **Xuất Excel**: Admin + Teamlead; member xuất phạm vi KHHH của mình — ghi nhật ký.
7. **Repo GitHub chỉ code**: `.gitignore` chặn `*.xlsx/*.pdf/data/`; test dùng dữ liệu giả; GAS URL công khai nhưng vô dụng nếu không có token.
8. **Khóa ghi** `LockService` + cấp mã `DTxxxxx` ở server (bài học SHTD `Concurrency.gs`: 2 người tạo cùng mã → đè mất).
9. Có **nút xóa dữ liệu của 1 KHHH** (Admin) khi KH tất toán/yêu cầu — ghi nhật ký.

## 7. UI (D11 — theo SHTD)
Sidebar tím gradient + topbar + thẻ/bảng/token màu `tokens.css` của SHTD (chép, không link chéo repo), theme sáng mặc định, có tối.
| Mục menu | Nội dung |
|---|---|
| **Tổng quan** | số KHHH/đối tác/lô · đối tác chung nhiều KHHH nhất · cơ hội mới · cảnh báo · lô chờ duyệt |
| **Nạp dữ liệu** | 4 bước v0.1 (Nạp → Duyệt ô đỏ → Đối tác & MST → **Lưu / Gửi duyệt**) — dùng lại lõi + UI bước ③ mới (D11 thẻ 131–331) |
| **Khách hàng (KHHH)** | danh sách → chi tiết: mạng lưới phải thu/phải trả theo kỳ, tỷ trọng, biến động, đối tác đã là KH TP |
| **Đối tác** | tra cứu tên/MST → đối tác gắn với những KHHH nào (mọi team — D09), tổng phải thu/phải trả, trạng thái MST |
| **Cơ hội bán chéo** | đối tác chưa là KH TPBank, xếp theo quy mô giao dịch + số KHHH liên quan ("vết dầu loang") |
| **Rủi ro** | tập trung (1 đối tác chiếm > ngưỡng % 131/331 của KHHH) · lây lan (1 đối tác/KHHH có vấn đề → ai bị ảnh hưởng) · đối tác ngừng hoạt động/MST lỗi |
| **Duyệt** (Teamlead/Admin) | lô + yêu cầu danh mục chờ duyệt, badge chỉ đếm mục cần chú ý |
| **Danh mục** (Admin) | DoiTac · TenGop · KH_TPBank (nhập danh mục) · Config ngưỡng · nhật ký |
Chỉ số cơ hội/rủi ro lấy từ logic template 08–11 hiện có làm bản đầu; tham số ngưỡng → `Config` để chị Dung/Thu chốt (không ghi cứng).

## 8. Kế hoạch (sau khi anh duyệt)
| Pha | Thời gian | Việc | Nghiệm thu |
|---|---|---|---|
| P0 | 13–15/10 | Anh duyệt file này · em đọc `CB_Ecosystem_360_Dashboard` + sheet 08–11 để rút công thức · tạo repo GitHub + Pages trống · **thử trên máy công ty**: mở Pages + gọi GAS (đã chạy với SHTD → khả năng cao OK) | anh OK kế hoạch; Pages + GAS mở được ở TPBank |
| — | 14–16/10 | (song song) golden Hương + MVP HTML offline 16/10 — không đụng web | MVP việc lớn |
| P1 | 16–21/10 | GAS: auth/SSO, schema 9 sheet, repo đọc/ghi + khóa + cấp mã + nhật ký · FE: khung SHTD, đăng nhập, **Nạp dữ liệu** (lõi chuyển về `core/`), lưu thẳng (Admin) · nhập 1 lần kho Excel v0.1 | e2e: đăng nhập SHTD → nạp Excel giả → có trên DB; 2 người nạp song song không mất dòng |
| P2 | 22–25/10 | Luồng Chờ duyệt/Duyệt lô + `YeuCau` danh mục · badge · trang Duyệt · xuất Excel có nhật ký | e2e 3 vai (Admin/Teamlead/User) |
| P3 | 26–29/10 | Dashboard: Tổng quan · KHHH · Đối tác · Cơ hội · Rủi ro · Danh mục | số khớp tính tay trên bộ giả lập + 3 KHHH thật của MN |
| UAT | 30/10–31/10 | Team MN (Duyên chủ kho, Hương nạp, QuynhVN6 nghiệm thu) chạy 3–5 KHHH thật · đo giờ/vòng | KR ≤ 10 phút/KHHH · 0 bước dán tay |
| Sau | T11 | các team khác nạp · tham số ngưỡng chị Dung/Thu · đợt 2 BL/BCTC | — |

**Test:** node (lõi + logic 08–11) · puppeteer e2e với GAS giả lập (như `ten_vietqr.mjs`) · hàm `test*()` trong GAS chạy trên Sheet test riêng · 0 lỗi JS · không request ra ngoài trừ GAS/VietQR/doanhnghiep.vn.

## 9. Rủi ro kỹ thuật & cách xử
| Rủi ro | Xử lý |
|---|---|
| GAS chậm/chập chờn (BeneMatch 08/10 gặp) | đọc gom 1 lần/trang (batch-read như SHTD) + CacheService phía server; ghi theo lô; FE báo rõ khi lỗi, không mất bản đang làm |
| Giới hạn Sheets/GAS (6 phút/lần chạy, 10 triệu ô) | quy mô 20 KHHH × ~200 dòng × kỳ ≪ giới hạn; tách sheet theo năm khi > 50.000 dòng |
| 8,5 MB thư viện OCR mỗi lần mở | tự host `vendor/` trên Pages → trình duyệt cache; chỉ tải khi vào **Nạp dữ liệu** |
| Mạng TPBank chặn github.io/script.google.com | SHTD/AIUS đang chạy được → kiểm ở P0 |
| Sau này chuyển server nội bộ | lớp `api.js` một cửa + `Repo*.gs` tách nghiệp vụ → thay backend không đổi FE |
| Dữ liệu cá nhân (D07 lưu đầy đủ) | vẫn **không gửi tra cứu ngoài** với cá nhân; ẩn khỏi trang Cơ hội (R7 v0.1) |

## 10. Cần anh xác nhận khi duyệt
1. A1–A6 (`PHONG_VAN.md`) — đặc biệt A1 (teamlead nạp vào thẳng) và A4 (không cache dữ liệu trên máy).
2. Mục 6 (9 biện pháp) là điều kiện tối thiểu của ngoại lệ — có bỏ/thêm gì không.
3. Lịch P1–UAT (web chạy thật **30–31/10**, sau MVP HTML 16/10).
