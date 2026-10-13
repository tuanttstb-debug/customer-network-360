# SESSION HANDOVER — Customer Network 360

**Từ phiên:** 2026-10-13 / Claude Code (hub AIOS) · **Cho:** phiên kế tiếp

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
