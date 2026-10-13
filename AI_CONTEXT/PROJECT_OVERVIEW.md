---
id: PRJ-CN360
type: project-card
title: Customer Network 360 — web quản lý mạng lưới đối tác công nợ 131–331 (bán chéo "vết dầu loang" + rủi ro lây lan), đăng nhập chung SHTD
status: draft   # draft | active | superseded — draft tới khi anh duyệt PHUONG_AN_VA_KE_HOACH.md
owner: PER-TTT
tags: [cong-no-131-331, ecosystem-360, ptkd-mn, aius-001, gas, ocr, du-lieu-kh-ngoai-le]
related: [PRJ-SHTD, PRJ-AIUS, W-2610-he-sinh-thai-131-331, DEC-20261013-01]
created: 2026-10-13
updated: 2026-10-13
version: 1
source: https://github.com/tuanttstb-debug/customer-network-360
---

## Tóm tắt điều hành
Web nội bộ cho Trung tâm SP&GP Tín dụng (Khối NHDN): đọc bảng công nợ 131 (phải thu) / 331 (phải trả) của KHHH đang vay → gán mã đối tác duy nhất `DTxxxxx` → **lưu thẳng vào DB dùng chung** → tra cứu mạng lưới đối tác, cơ hội bán chéo và rủi ro tập trung/lây lan ngay trên web. Thay vòng **mở kho Excel → tải kho lưu đè → dán template → nạp dashboard** của công cụ HTML offline v0.1. Đăng nhập bằng tài khoản SHTD (giống AIUS).

## Bối cảnh nghiệp vụ
- Gốc: việc lớn **Smart Customer Network 360** của PTKD MN (AIUS-001), công cụ 131–331 v0.1 ở AIOS `08_Work/W-2610-he-sinh-thai-131-331/` (MVP HTML 16/10/2026).
- Người dùng: toàn Trung tâm (mọi user `User_Master` SHTD), PTKD MN đợt đầu; xem đầy đủ mọi team; Admin nạp/sửa trực tiếp, member gửi teamlead duyệt.
- **Ràng buộc lớn:** dữ liệu là **thông tin khách hàng thật** (tên KHHH, đối tác, số công nợ) → lưu GAS + Google Sheets TK cá nhân là **ngoại lệ luật data-boundary** do anh Tuân quyết và chịu trách nhiệm (DEC-20261013-01) — bắt buộc 9 biện pháp hạn chế tiếp cận (`PHUONG_AN_VA_KE_HOACH.md` §6).

## Phạm vi & không thuộc phạm vi
- Trong (v1): đăng nhập/SSO SHTD · nạp + đọc tệp tại máy (lõi v0.1) · duyệt ô · gộp đối tác + tra MST · lưu DB + luồng duyệt teamlead · dashboard Tổng quan/KHHH/Đối tác/Cơ hội/Rủi ro · danh mục (Admin) · xuất Excel có nhật ký · nhập 1 lần kho Excel v0.1.
- Ngoài (v1): lưu file gốc PDF/scan · AI ngoài · kết nối BPM/CCP · BL/BCTC đợt 2 · quản lý user (ở SHTD).

## Quan hệ với dự án khác / AIOS
- **PRJ-SHTD:** nguồn user duy nhất (`User_Master`) + `AUTH_SECRET` dùng chung; khuôn UI (sidebar, `tokens.css`), khuôn backend (`doPost` + token + `LockService`).
- **PRJ-AIUS:** mẫu đọc user chéo (`AuthTokenService.gs`).
- **AIOS W-2610-he-sinh-thai-131-331:** thẻ việc lớn + công cụ offline v0.1; lõi đọc/gộp chuyển về `core/` repo này sau 16/10 (A5).

## Tài liệu
`PHONG_VAN.md` (D01–D11, A1–A6) · `PHUONG_AN_VA_KE_HOACH.md` (phương án, kiến trúc, dữ liệu, quyền, biện pháp, kế hoạch P0–UAT).
