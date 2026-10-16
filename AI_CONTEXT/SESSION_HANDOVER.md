# SESSION HANDOVER — Customer Network 360

**Từ phiên:** 2026-10-13 / Claude Code (hub AIOS) · **Cho:** phiên kế tiếp

## Delta phiên (2026-10-16 — sửa E2E MST → merge main → GAS @2 + Pages LIVE)
- **Việc xong:** E2E MST timeout do `crypto.subtle` (kiểm sha256 3 tệp ở Danh mục) chỉ có trong secure context, trang test chạy `http://cn360.test` → test thêm cờ Chrome `--unsafely-treat-insecure-origin-as-secure` (prod https không bị, không sửa FE). Merge `wip/mst-noi-bo` → `main` `20e7693`, push; `clasp push` + anh chạy `clasp deploy -i … @2` (giữ URL); Pages phục vụ `mstidx.js` 200. CLAUDE.md: gate thêm `mst.test`, ghi ngoại lệ A4 IndexedDB.
- **Files changed:** `test/e2e.mjs` (cờ launch) · `CLAUDE.md` · `AI_CONTEXT/{PROJECT_STATE,TODO_NEXT,SESSION_HANDOVER}.md`. Nhánh `wip/mst-noi-bo` đã xóa (local).
- **Decision made:** không thêm — thực thi DEC-20261015-02 (D13).
- **Blocker:** không. Chỉ mục MST chưa tải lên prod → tính năng báo "Chưa có chỉ mục" tới khi Admin tải.
- **Next step:** [TT] Admin tải 3 tệp `_build\20261015-1752\` → thử máy công ty (RAM/tải 12 MB, mạng TPBank) → Teamlead "Đối chiếu CIF nội bộ".
- **Vá @3 (cùng ngày):** tải chỉ mục lỗi "Session.getEffectiveUser … userinfo.email" → `Mst.gs` lấy chủ qua `folder.getOwner()`; harness giả lập ném lỗi như GAS thật.
- **Regression risk:** Trung bình — `submit-batch`/`_applyDtEdit_` có gọi tự điền CIF (bọc try, không chặn khi thiếu chỉ mục). Test: GAS 58 · mô hình 34 · MST 55 · E2E 57 — tất cả xanh.

## Delta phiên (2026-10-15 — tra MST/CIF NỘI BỘ TPBank trước công cụ ngoài · WIP nhánh `wip/mst-noi-bo`, CHƯA push/deploy)
- **Việc xong:** quét `TRA CUU MST.xlsx` (800k MST + 134k CIF KH line CB) → phỏng vấn 7 câu → phương án D (lai) anh duyệt (`PHUONG_AN_TRA_MST_NOI_BO.md`) → build: `tools/build_mst_index.py` (ra `D:\Công việc\USMN\Nen\_build\20261015-1752\` — 870.025 pháp nhân 11,8 MB · 110.399 MST có CIF) · lõi `core/mstmatch.js` · `gas/Mst.gs` (tải lên/tải về chỉ mục, MST→CIF chỉ server, tự điền CIF khi lưu lô/sửa MST, sync-cif, gỡ, guard) · FE `assets/js/mstidx.js` + worker · bước ③ tự tra nội bộ · Đối tác "Tìm MST (nội bộ)" + "Đối chiếu CIF nội bộ" · Danh mục tab "MST nội bộ" (tra thử + Admin tải lên/gỡ) · model: có CIF = Đã là KH TPBank.
- **Đo trên chỉ mục thật (tên làm méo, `tools/eval_mst_match.mjs`):** nguyên văn top1 96% · viết tắt/bỏ dấu 95% · OCR 1 ký tự 84% · tự điền ~54% với độ đúng 99,8% (ngưỡng điểm ≥ 0,86 + cách ứng viên 2 ≥ 0,10) · ~22 ms/tên · dựng chỉ mục ~14 s, ~380 MB heap (Node).
- **Test:** GAS 58/58 · mô hình 34/34 · MST mới 55/55 · E2E cũ 40/40 nhưng **phần E2E MST mới lỗi 1** (timeout 15 s ở `test/e2e.mjs:278` — chờ "Chưa có chỉ mục" trong tab Danh mục → MST nội bộ; chưa điều tra). 1 lần chạy trước timeout ở bước đăng nhập đầu (chạy lại thì qua — nghi chập chờn).
- **Quyết định:** PA D — chỉ mục tên→MST (không CIF) tải về trình duyệt + IndexedDB (ngoại lệ A4, xóa khi đăng xuất/30 ngày) · CIF chỉ GAS, ≤ 1.000 MST/lần, có nhật ký · cho phép lưu CIF vào DoiTac (anh duyệt câu 4) · bỏ cá nhân/HKD (MST 12 số) · TT SP dùng chung · ngưỡng tự điền 0,86/0,10.
- **Blocker:** E2E MST chưa xanh → chưa push, chưa clasp push/deploy.
- **Bước kế:** [CC] sửa E2E dòng 278 → 4 bộ test xanh → merge `main` + push · `clasp push` + deploy @2 (thêm `Mst.gs`) · [TT] đăng nhập Admin → Danh mục → MST nội bộ → chọn 3 tệp trong `_build\20261015-1752\` → Tải lên → thử trên máy công ty (tải lần đầu ~12 MB, RAM máy) · [CC] cập nhật CLAUDE.md (gate thêm `node test/mst.test.mjs`; ngoại lệ A4 IndexedDB) · [TT] Teamlead bấm "Đối chiếu CIF nội bộ" cho đối tác cũ.
- **Rủi ro hồi quy:** trung bình — chạm `submit-batch`/`_applyDtEdit_` (bọc try, không chặn khi thiếu chỉ mục — có test) · bước ③ tự gọi `mst-meta` khi vào (không chỉ mục → chỉ đổi dòng trạng thái). Dữ liệu nội bộ chỉ ở `_build` ngoài repo; `.gitignore` chặn `*.gz`, `_build/`, `manifest.json`.

## Delta phiên (2026-10-13 #3 — LIVE + nạp dữ liệu mẫu giả lập)
- **Việc xong:** push `main` `22ad475` → anh bật Pages → **LIVE** · nạp bộ MẪU giả lập template (12 KHHH · 36 đối tác · 96 lô · 480 dòng, tháng→quý) vào `CN360_DB` qua Sheets connector sau khi xem trước trên backend giả lập (0 lỗi JS) · DEC ngoại lệ ghi ở AIOS `DEC-20261013-01`.
- **File đổi:** `AI_CONTEXT/{PROJECT_STATE,TODO_NEXT,SESSION_HANDOVER,PHUONG_AN_VA_KE_HOACH,PROJECT_OVERVIEW,TECH_DEBT}.md` (số DEC) · DB live: KHHH/DoiTac/TenGop/Lo/CongNo (+ mẫu).
- **Quyết định:** dữ liệu mẫu đánh dấu `MAU` / `LO20261013-Mxxx` để xóa dễ · không ghi thẳng Sheet khi đã có người dùng.
- **Blocker:** không.
- **Bước kế:** [TT] teamlead MN duyệt lô `LO20261013-0001` · [CC] nới cột cầu nối + action xóa mẫu.
- **Rủi ro hồi quy:** thấp — chỉ thêm dữ liệu; đã đọc lại Lo/KHHH/DoiTac/TenGop/CongNo sau ghi: đủ mẫu + đủ lô của Hương (ghi trùng thời điểm, không mất dòng).

## Delta phiên (2026-10-13 #2 — build v0.1.0: backend GAS deploy + FE 8 trang + 3 bộ test)
- **Việc xong:** anh duyệt kế hoạch (D12 — giữ GAS dữ liệu rõ, chỉ TK chủ mở file DB) · backend 8 file (`gas/`) → clasp push + deploy @1, anh chạy setupAll (DB `1E4xevOsik…`) · FE khuôn SHTD 8 trang + lõi v0.1 + vendor tự host · test GAS 58 · mô hình 34 · E2E 42 (dữ liệu giả) · phát hiện + vá lỗi lõi `parse131.js` cắt chữ có dấu ở đầu/cuối tên (sửa gốc AIOS + chép sang).
- **File đổi:** toàn repo (lần đầu): `index.html` · `assets/{css,js,js/views}` · `core/` · `vendor/` · `gas/` · `test/` · `tools/sync_gas.mjs` · `README.md` · `CLAUDE.md` · `AI_CONTEXT/*`.
- **Quyết định:** D12 duyệt hướng 1 · D13 triển khai (GAS project/DB/deploy) · bỏ Google Fonts (0 request ngoài) · mô hình port công thức 08–11, 3 khác biệt có chủ đích ghi đầu `model.js`.
- **Blocker:** repo GitHub chưa tạo (máy không có `gh`) → chưa có Pages.
- **Bước kế:** [TT] tạo repo → [CC] push + Pages · [TT] thử trên máy công ty · [CC] đồng bộ lõi sau golden 14/10.
- **Rủi ro hồi quy:** trung bình — code mới hoàn toàn, chưa chạy với GAS thật ngoài health check/AUTH_REQUIRED; đã test toàn luồng với backend THẬT trong giả lập (cùng file .gs). Lõi v0.1 sửa 1 regex tên → test v0.1 mapping 19 · e2e 25 · tên 18 pass.

## Cách bắt đầu một phiên (bắt buộc)
1. `git pull`.
2. Đọc `AI_CONTEXT/PROJECT_STATE.md` + `TODO_NEXT.md` + file này.
3. Làm việc nhỏ → commit nhỏ → cập nhật context → `git push`.

## Gotchas
- `clasp create-script` ghi đè `gas/appsscript.json` bằng bản mặc định (múi giờ New York, mất webapp/scope) — kiểm lại trước khi push.
- Auto mode của Claude Code chặn ghi code đưa dữ liệu KH lên GAS (Data Exfiltration) — anh tắt auto mode và duyệt từng file khi làm phần này.
- Tệp mẫu/kho thật ở `D:\Công việc\USMN\` — **không chép vào repo**; test chỉ dùng dữ liệu giả.
- Script có dấu `\`: viết file bằng Write rồi chạy, không nhét vào heredoc Bash.
- E2E dùng puppeteer-core + SheetJS Node của AIOS (`cong-cu-an-danh`, `W-2610-he-sinh-thai-131-331/tool`) — mỗi user 1 browser context.
