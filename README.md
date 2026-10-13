# Customer Network 360 (CN360)

Web nội bộ TT SP & GP Tín dụng (Khối NHDN): đọc bảng công nợ **131 (phải thu) / 331 (phải trả)** của KHHH → mã đối tác duy nhất `DTxxxxx` → **kho dùng chung** → tra cứu mạng lưới đối tác, **cơ hội bán chéo "vết dầu loang"** và **rủi ro tập trung / lây lan**. Đăng nhập bằng **tài khoản SHTD** (đang đăng nhập SHTD trên cùng trình duyệt thì vào thẳng).

- **Người dùng:** toàn Trung tâm · xem dữ liệu đã duyệt của mọi team · Admin/Teamlead nạp & sửa trực tiếp · thành viên gửi → Teamlead cùng team duyệt.
- **Dữ liệu:** Google Sheets `CN360_DB` (TK chủ) — **chỉ TK chủ mở được file gốc**, người dùng chỉ truy cập qua web (token + quyền). Tệp PDF/scan/Excel gốc **đọc tại máy, không gửi đi**. Ngoại lệ data-boundary: xem `AI_CONTEXT/PHUONG_AN_VA_KE_HOACH.md` §6.

## Kiến trúc
```
index.html + assets/ (FE khuôn SHTD) + core/ (lõi đọc 131–331, OCR tại máy) + vendor/ (pdf.js · tesseract + vie · SheetJS — tự host)
      │ POST text/plain {action, token}            GitHub Pages: https://tuanttstb-debug.github.io/customer-network-360/
      ▼
gas/ (Apps Script, Execute as Me) ── đọc User_Master (SHTD) để xác thực ── CN360_DB (9 sheet, riêng tư, guard hằng ngày)
```
| Thư mục | Nội dung |
|---|---|
| `assets/js/` | `net.js` (token, SSO, retry idempotent) · `store.js` (dữ liệu chỉ trong bộ nhớ trang) · `model.js` (công thức 08–11 template) · `views/*` (8 trang) · `xlsx_io.js` · `mst.js` |
| `core/` | `parse131 · mapping · pipeline · ocr_core · deskew` — **nguồn gốc hiện ở AIOS** `08_Work/W-2610-he-sinh-thai-131-331/tool/src/` (sửa ở đó rồi chép sang) · `ocr_loader.js` riêng web |
| `gas/` | `Code.gs` (cửa vào + idempotency) · `Auth.gs` · `Db.gs` · `Service.gs` · `Guard.gs` · `Setup.gs` · `Config.gs` · `Mapping.gs` (**sinh từ core/mapping.js** — `node tools/sync_gas.mjs`) |
| `test/` | `gas.test.mjs` (backend trong giả lập GAS) · `model.test.mjs` (công thức tính tay) · `e2e.mjs` (Chrome thật ⇄ backend giả lập) — dữ liệu GIẢ |

## Kiểm thử (bắt buộc pass trước khi push / clasp push)
```
node test/gas.test.mjs      # 58
node test/model.test.mjs    # 34
node test/e2e.mjs           # 42 (Chrome + puppeteer-core của công cụ ẩn danh AIOS)
```

## Triển khai
- **Backend:** `cd gas && node ../tools/sync_gas.mjs && clasp push --force && clasp create-deployment -i <deploymentId cũ>` (giữ URL) — lần đầu: Script Property `AUTH_SECRET` = của SHTD → chạy `setupAll` → `checkSetup`.
- **Frontend:** push nhánh `main` → GitHub Pages (Settings → Pages → main / root). URL GAS ở `assets/js/config.js`.
- Đổi lõi đọc ở AIOS → chép `src/{parse131,mapping,pipeline,ocr_core,deskew}.js` sang `core/` → chạy lại 3 bộ test.
