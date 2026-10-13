# CLAUDE.md — Customer Network 360

Repo này theo chuẩn **AI OS Registry (Hub-and-Spoke)**. Tri thức dự án sống ở `AI_CONTEXT/`; danh mục trung tâm ở repo **AIOS** (`D:\Workspace\AIOS`). ID dự án: **PRJ-CN360**.

## Bắt đầu mỗi phiên (BẮT BUỘC)
1. `git pull`.
2. Đọc theo thứ tự: `AI_CONTEXT/PROJECT_OVERVIEW.md` → `PROJECT_STATE.md` → `TODO_NEXT.md` → `SESSION_HANDOVER.md` (**delta mới nhất trên cùng**) → `TECH_DEBT.md`. Thiết kế: `PHUONG_AN_VA_KE_HOACH.md` · phỏng vấn: `PHONG_VAN.md`.
3. **Không quét toàn repo.** Chỉ mở module liên quan việc đang làm (bảng thư mục ở `README.md`).

## Quy tắc làm việc
- Việc nhỏ → commit nhỏ → cập nhật `AI_CONTEXT/` → `git push` (chỉ khi anh Tuân yêu cầu hoặc `/handover`).
- **Gate trước push / clasp push:** `node test/gas.test.mjs` + `node test/model.test.mjs` + `node test/e2e.mjs` pass 100%.
- **Kết thúc phiên:** delta `SESSION_HANDOVER.md` đủ 6 trường; cập nhật `PROJECT_STATE`/`TODO_NEXT`/`TECH_DEBT` nếu đổi.

## Dữ liệu (đọc kỹ — ngoại lệ data-boundary do anh Tuân duyệt 2026-10-13)
- Hệ thống **lưu dữ liệu khách hàng thật** (tên KHHH, đối tác, số công nợ) trên Google Sheets `CN360_DB` của TK chủ — **ngoại lệ có chủ đích**, kèm 9 biện pháp bắt buộc (`PHUONG_AN_VA_KE_HOACH.md` §6). Không nới bất kỳ biện pháp nào khi chưa hỏi anh.
- **Repo GitHub là public, CHỈ CODE:** không commit xlsx/pdf/csv/dữ liệu (đã `.gitignore`); test chỉ dùng dữ liệu GIẢ; không chép tệp mẫu `D:\Công việc\USMN\` vào repo.
- Tệp gốc PDF/scan/BCTC **không bao giờ** gửi lên GAS; FE không lưu dữ liệu KH vào localStorage/IndexedDB (chỉ bộ nhớ trang).
- Chỉ TK chủ mở file DB: `Guard.gs` gỡ chia sẻ khi setup + 7h hằng ngày. Không thêm endpoint đọc dữ liệu không cần token.

## Nguồn sự thật
- **Lõi đọc 131–331** (`core/parse131|mapping|pipeline|ocr_core|deskew.js`): gốc ở AIOS `08_Work/W-2610-he-sinh-thai-131-331/tool/src/` — sửa ở gốc rồi chép sang (`02_Rules/cross-repo-workflow.md`). `gas/Mapping.gs` sinh từ `core/mapping.js` (`node tools/sync_gas.mjs`).
- **Công thức mô hình** = `assets/js/model.js` (port sheet 08–11 `CB_Ecosystem_360_TEMPLATE`, tham số = sheet Config). Khác template có chủ đích ghi ở đầu file.
- **Quyền** kiểm ở server (`Auth.gs` `canDirect_`/`canApprove_`), FE chỉ ẩn/hiện.

## Định danh registry
- Thẻ dự án: `AIOS/04_Knowledge/projects/PRJ-CN360.md` · Danh mục: `AIOS/00_System/PORTFOLIO.md` · việc lớn gốc: `AIOS/08_Work/W-2610-he-sinh-thai-131-331/TASK.md`.
