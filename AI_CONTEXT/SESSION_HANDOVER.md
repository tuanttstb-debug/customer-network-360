# SESSION HANDOVER — Customer Network 360

**Từ phiên:** 2026-10-13 / Claude Code (hub AIOS) · **Cho:** phiên kế tiếp

## Delta phiên (2026-10-24 — CR anh: User xuất theo team + Admin xóa bộ MẪU · v0.5.1)
- **Task completed:** User xuất Excel/Counterparty theo phạm vi **team** (KHHH có lô do mình HOẶC đồng nghiệp cùng team nạp — backup nhau khi vận hành; Admin/Teamlead vẫn toàn bộ) · action GAS `delete-mau` + nút Danh mục › "Nhập kho / Xóa MẪU" (dryRun đếm → hỏi xác nhận; chỉ KHHH mà mọi lô đều do `MAU` nạp, KHHH đã có lô thật giữ nguyên; đối tác chỉ bộ mẫu dùng xóa kèm) · `_deleteCifs_` dùng chung với `delete-khhh`.
- **Files changed:** `assets/js/{xlsx_io.js,views/danhmuc.js,config.js}` · `gas/{Service.gs,Code.gs,Config.gs}` · `test/{gas.test.mjs,e2e.mjs}` — `c6184cb`.
- **Decision made:** phạm vi team theo cột Team của lô (team người nạp lúc nạp) — dữ liệu đã duyệt vốn mọi người XEM được (D09), CR chỉ mở quyền TẢI.
- **Blocker:** cần [TT] `clasp push` + deploy GAS (giữ URL) — trước deploy nút "Xóa bộ MẪU" báo "Hành động không hỗ trợ"; xuất theo team chạy ngay (server chỉ chặn User xuất 'all').
- **Next step:** [TT] deploy GAS → Admin bấm "Xóa bộ MẪU…" (xem danh sách CIF trong hộp xác nhận trước khi Xóa) → Ctrl+F5 kiểm tab Xuất dữ liệu bằng TK User team MN.
- **Regression risk:** thấp — test GAS 67 · mô hình 45 · MST 91 · Excel 26 · E2E 81 pass; `delete-khhh` refactor giữ nguyên test cũ.

## Delta phiên (2026-10-19 — CR đợt 1 PTKD MN sau test golden · v0.5.0, chỉ FE)
- **Task completed:** đọc 3 email CR (Hương 15/10 · Ly 16/10 · Duyên 19/10) → đánh giá + anh chốt D17–D20 (kế hoạch `AIOS/08_Work/W-2610-he-sinh-thai-131-331/KE_HOACH_CR_V05.md`) → build: ① bước ③ **tab lọc** theo nhóm (trùng · gợi ý · mới · cá nhân · chưa MST · có ứng viên · có CIF) + **tick duyệt hàng loạt** (chấp nhận ứng viên MST #1 · gộp theo gợi ý #1 · giữ mới) + ghi "chưa có MST vẫn lưu được" (CR Ly) ② công tắc **"Chỉ số đã cân"** trên thanh đầu trang, mặc định BẬT: `model.compute(data, {chiCan})` bỏ dòng "Chưa cân" khỏi 360 + xuất CongNo; kho vẫn lưu đủ (CR Hương #5) ③ **Xuất Counterparty (template ver 3)** ở Danh mục → Xuất: 28 cột A–AB + 4 nhóm gộp ô, 1 dòng = đối tác × KHHH × TK × kỳ, B = MST/mã DT, D = mã CN của CIF đối tác (tra `mst-cif` lúc xuất), J = Σ(Nợ+Có) KHHH×TK×kỳ, S = công thức `IF(J=0,0,(H+I)/J)`, K–O · T–AB để trống (CR Duyên).
- **Files changed:** `assets/js/views/{nap,danhmuc}.js` · `assets/js/{model,store,app,xlsx_io,config}.js` · `index.html` · `assets/css/app.css` · `test/{model.test,e2e}.mjs`.
- **Decision made:** D17 lưu đủ, lọc khi dùng · D18 tick = duyệt hàng loạt (không tách lô) · D19 giữ mã DT, xuất MST ở cột ID · D20 K–O/CIC đợt 2, không lưu SĐT di động (ghi ở thẻ AIOS).
- **Blocker:** không. Không đổi GAS → không cần clasp deploy.
- **Next step:** [TT] thử LIVE: bước ③ tab/tick · công tắc · Danh mục → Xuất Counterparty → nghiệm thu 2026-10-22 → Pilot 2026-10-23 · [CC] đợt 2 sau 23/10: nạp "Bổ sung đối tác" theo MST · CIC · cấu hình cột cho BA.
- **Regression risk:** thấp–TB — công tắc mặc định BẬT làm số 360 giảm nếu kho có dòng "Chưa cân" (có nhãn "ẩn N dòng"); bước ③ dài hơn → toast có thể che nút ④ vài giây. Hồi quy tệp thật: 4 tệp mẫu Excel 1.076/1.076 cân, tổng 6/6 ×4 (gồm `131.xlsx` Hương gửi: 6/6, tên đủ đuôi dự án). Excel COM mở file Counterparty: 0 ô lỗi, gộp ô đúng. Test: GAS 60 · mô hình 45 · MST 91 · Excel 26 · E2E 78.

## Delta phiên (2026-10-16 tối #3 — test LIVE tìm KH theo tên · v0.4.3–0.4.4)
- **Task completed:** anh deploy GAS **@8** → test LIVE (Chrome, phiên anh): Danh mục tra thử "mat troi bach khoa" → ① KH TPBank 77768686 · CN 276-BTN-Bình Tân hạng 1 ✅ (lượt đầu ~40 s dựng bảng tên) · bước ① Nạp tên đầy đủ có dấu + "&" → 77768686 hạng 1 (~18 s) ✅. Phát hiện + sửa: (a) nhánh 900k vẫn xếp "MẶT TRỜI BẠC" đầu — chấm sơ bộ cắt 300 ứng viên trước khi xét "chứa đủ token" → v0.4.3 ưu tiên tên chứa đủ token khi cắt (nay 0304194942 77% hạng 1); (b) worker lấy `core/mstmatch.js` cũ từ cache HTTP Pages (~10 phút) → v0.4.4 fetch `no-cache`.
- **Files changed:** `core/mstmatch.js` · `assets/js/{mstidx,config}.js` · `test/e2e.mjs` (chờ đúng lượt tra) · `tools/probe_kh_name.mjs`.
- **Decision made:** không thêm.
- **Blocker:** không. Lượt tìm tên đầu tiên sau mỗi lần cache GAS hết hạn (6 giờ) chậm ~20–40 s.
- **Next step:** [CC] cân nhắc hâm cache bảng tên bằng trigger 5 giờ/lần (tránh lượt chậm) · [TT] dùng thử thực tế.
- **Regression risk:** thấp — chỉ đổi thứ tự cắt ứng viên khi opts.contain (tự điền MST đối tác không dùng contain). Test: GAS 60 · mô hình 34 · MST 91 · Excel 26 · E2E 66.

## Delta phiên (2026-10-16 tối #2 — lỗi tìm "mat troi bach khoa" · tìm KH: TPBank trước → 900k · v0.4.2, FE + GAS)
- **Task completed:** tái hiện trên chỉ mục thật (`tools/probe_kh_name.mjs`): CIF 77768686 có MST 0304194942 nhưng không có tên 900k → đường cũ (900k top 15 → KH) trả rỗng. Thêm tìm tên ở GAS trong KH line CB (`core/khname.js`, sinh `gas/KhName.gs` qua `tools/sync_gas.mjs`) + `CN.mstidx.findKh` (song song ① GAS tên TPB · ② 900k trên máy → MST) dùng cho bước ① Nạp + Danh mục tra thử; `mstmatch` mở thêm viết tắt TPB (CPDT/PTNL/DT/PT/NL/&/CT CP…) + opts.contain; FE chịu GAS cũ (lùi về 900k).
- **Files changed:** `core/khname.js` (mới) · `gas/KhName.gs` (sinh) · `gas/Mst.gs` (`_khNames_` cache `khn:` · `khByName_` · `apiKhFind_` nhận tên + gộp msts) · `core/mstmatch.js` · `assets/js/{mstidx,mstidx.worker,config}.js` · `views/{nap,danhmuc}.js` · `tools/{sync_gas,probe_khname,probe_kh_name}.mjs` · test `mst.test.mjs` (+7, bỏ test "từ chối tên") · `e2e.mjs` (+2).
- **Decision made:** đảo quyết định 15/10 "tên chỉ tra trên máy, server không nhận tên" — nay server nhận TÊN truy vấn để so trong KH line CB (theo flow anh Tuân 16/10); danh sách KH vẫn không về trình duyệt, nhật ký chỉ ghi số lượng.
- **Blocker:** cần [TT] `clasp deploy` GAS (giữ URL) — trước khi deploy, FE vẫn chạy (chỉ còn nhánh 900k).
- **Next step:** [TT] clasp push + deploy → thử "mat troi bach khoa" ở Danh mục → MST nội bộ và bước ① Nạp · lượt đầu sau deploy dựng bảng tên (vài giây–chục giây), sau đó cache 6 giờ.
- **Regression risk:** trung bình — `kh-find` đổi hợp đồng (q chữ được chấp nhận); `mstmatch.norm` đổi → chỉ mục 900k dựng lại theo norm mới khi tải trang (không cần build lại tệp). Test: GAS 60 · mô hình 34 · MST 91 · Excel 26 · E2E 66.

## Delta phiên (2026-10-16 tối — CR anh Tuân: Excel là luồng nạp chính · v0.4.1, chỉ FE)
- **Task completed:** bộ đọc Excel theo cột `core/xlsx131.js` thay đường "sheet → chữ OCR giả → bố cục" (giữ làm dự phòng) · mã ĐT dạng MST → điền sẵn MST + khớp đối tác theo MST (chip "MST theo mã ĐT trên sổ — nên Kiểm MST") · CCCD 12 số → cá nhân · TK con → Ghi chú dòng · gợi ý ① "ưu tiên Excel". Chẩn đoán "lỗi font" tệp Kho_DoiTac_…20261015: **không phải giao diện/xuất file** — chuỗi Unicode chuẩn NFC, 0 ký tự hỏng; 3 PDF nguồn là ảnh scan RICOH không có lớp chữ → sai chữ do **OCR bản mờ** (vd "CÔ PHÁN", đuôi rác "3”I", kỳ 2025 đọc thành 2015).
- **Files changed:** `core/xlsx131.js` (mới) · `assets/js/views/nap.js` · `index.html` · `assets/js/config.js` (v0.4.1) · `test/xlsx.test.mjs` (mới, 26) · `test/e2e.mjs` (fixture 331 dạng sổ kế toán, +4) · `tools/probe_xlsx.mjs` (đo tệp thật, chỉ in số đếm) · `CLAUDE.md` (gate + ngoại lệ nguồn gốc xlsx131).
- **Decision made:** `core/xlsx131.js` gốc ở repo này (không ở AIOS như parse131). MST lấy từ mã ĐT chỉ là gợi ý — người kiểm VietQR trước khi tin.
- **Blocker:** không. Chưa có GAS đổi → không cần clasp deploy.
- **Next step:** [TT] push → Pages · thử nạp 4 tệp ICV trên web (CIF 03735845) · [CC] thu thêm mẫu Excel phần mềm khác (MISA/FAST/Bravo) để mở rộng nhận tiêu đề.
- **Regression risk:** thấp–TB — mọi tệp Excel nay qua bộ đọc mới trước (template tổng hợp vẫn ưu tiên đầu tiên); bảng không nhận tiêu đề → đường cũ. Test: GAS 60 · mô hình 34 · MST 85 · Excel 26 · E2E 64.

## Delta phiên (2026-10-16 chiều — KHHH chuẩn theo dữ liệu TPB · v0.4.0 · GAS @4→@7)
- **Task completed:** bước ① tìm KH (CIF/MST server · tên trên máy) + tự điền · CN `001-HKM-Hoàn Kiếm` theo BLOCK.xlsx · lưu lô tự chuẩn hóa · "Chuẩn hóa KHHH" theo CIF→MST (đổi CIF dây chuyền) + nút chuẩn hóa ở chi tiết (2 tên · PTKD · loại ĐVKD · tỉnh) · xóa KHHH dọn đối tác mồ côi · màn chờ tải (hard reload) · tra KH 10–14 s → 2,3–4,2 s (putAll → put từng khóa; log_ không đọc cả NhatKy). Tuning tự điền MST thử rồi BỎ (đúng 100% → 99,2%). Lô Hương: từ chối + xóa KHHH 12345678 (anh làm); backup `CN360_DB_backup_20261016_truoc-xoa-lo-Huong`.
- **Files changed:** `gas/{Mst,Service,Db,Code}.gs` · `assets/js/{app,config,mstidx}.js` · `views/{nap,khhh}.js` · `index.html` · `tools/build_mst_index.py` · test (GAS 60 · mô hình 34 · MST 85 · E2E 61). Build ngoài repo `D:\Công việc\USMN\Nen\_build\20261016-1401\`.
- **Decision made:** DEC-20261016-01 (AIOS) — CIF/CN theo TPB · MST + tên đẹp theo 900k · BLOCK cho ĐVKD; server là nguồn chuẩn khi lưu. Bộ MẪU không "chuẩn hóa" (không có KH thật tương ứng — 0/12 CIF/MST khớp).
- **Blocker:** không. Tên đẹp chỉ 30% (TD-CN360-06).
- **Next step:** [TT] tải chỉ mục `20261016-1401` → thử chuẩn hóa · chốt cách xóa 12 KHHH MẪU · nhắn Hương nạp lại bằng luồng mới. [CC] nếu chọn (b): nút "Xóa bộ MẪU".
- **Regression risk:** trung bình — submit-batch ghi đè Tên/MST/CN theo TPB (đúng chủ đích) · đổi CIF chạm Lo/DoiTac (có test) · `log_` đổi cách ghi (appendRow) dùng ở mọi action. Đã verify prod: kh-find src=cache, xóa KHHH, chuẩn hóa ghi nhật ký.

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
