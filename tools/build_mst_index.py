# -*- coding: utf-8 -*-
"""Build chỉ mục MST nội bộ cho CN360 từ file nội bộ TPBank (TRA CUU MST.xlsx).

⚠ DỮ LIỆU NỘI BỘ TPBANK — file vào/ra đều nằm NGOÀI repo (mặc định <thư mục file nguồn>\\_build\\<version>\\).
   Repo public chỉ chứa script này. .gitignore chặn *.xlsx, *.gz, _build/.

Đầu ra (3 file → Admin tải lên ở web: Danh mục → MST nội bộ):
  name_index.tsv.gz  "MST<TAB>Tên"  — pháp nhân (sheet tra MST + KH line CB không có trong sheet đó), KHÔNG đánh dấu dòng nào là KH TPBank
  cif_map.tsv.gz     "MST<TAB>CIF<TAB>BRN_MIS<TAB>CG_SEGMT"  — chỉ GAS đọc (không tải về trình duyệt)
  manifest.json      phiên bản · số dòng · sha256

Bỏ cá nhân / hộ KD (MST 12 số) và MST sai định dạng (D: anh Tuân 2026-10-15).
Chạy:  set PYTHONUTF8=1 && python tools/build_mst_index.py "D:\\Công việc\\USMN\\Nen\\TRA CUU MST.xlsx"
"""
import datetime as dt
import gzip
import hashlib
import json
import os
import re
import sys
import time

from openpyxl import load_workbook

SHEET_MST = 'data mst 900l'
SHEET_CB = 'KH line CB'


def norm_mst(v):
    """→ '0101234567' | '0101234567-001' | None (cá nhân 12 số / sai định dạng)."""
    s = str(v or '').strip()
    if not s or re.search(r'[A-Za-z]', s):
        return None
    d = re.sub(r'\D', '', s)
    if len(d) == 10:
        return d
    if len(d) == 13:
        return d[:10] + '-' + d[10:]
    return None


def clean_name(v):
    return re.sub(r'\s+', ' ', str(v or '').replace('\t', ' ')).strip()


def find_cols(header, names):
    h = [str(x or '').strip().upper() for x in header]
    out = {}
    for n in names:
        if n.upper() not in h:
            raise SystemExit(f'Thiếu cột {n} — tiêu đề hiện có: {h}')
        out[n] = h.index(n.upper())
    return out


def write_gz(path, lines):
    data = ('\n'.join(lines) + '\n').encode('utf-8')
    with open(path, 'wb') as f:
        f.write(gzip.compress(data, 9))
    raw = open(path, 'rb').read()
    return {'file': os.path.basename(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'rows': len(lines)}


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = sys.argv[1]
    version = dt.datetime.now().strftime('%Y%m%d-%H%M')
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(src), '_build', version)
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if os.path.abspath(out).lower().startswith(repo.lower()):
        raise SystemExit('Thư mục đầu ra nằm TRONG repo — cấm (dữ liệu nội bộ).')
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    wb = load_workbook(src, read_only=True, data_only=True)

    names, skip1 = {}, 0
    rows = wb[SHEET_MST].iter_rows(values_only=True)
    c = find_cols(next(rows), ['MST', 'TEN_DN'])
    for r in rows:
        m, nm = norm_mst(r[c['MST']]), clean_name(r[c['TEN_DN']])
        if not m or not nm:
            skip1 += 1
            continue
        names.setdefault(m, nm)
    n_s1 = len(names)

    cif, skip2 = {}, 0
    rows = wb[SHEET_CB].iter_rows(values_only=True)
    c = find_cols(next(rows), ['CIF', 'FULL_NAME', 'BRN_MIS', 'CG_SEGMT', 'MST'])
    for r in rows:
        m = norm_mst(r[c['MST']])
        if not m:
            skip2 += 1
            continue
        e = cif.setdefault(m, {'cif': [], 'brn': str(r[c['BRN_MIS']] or '').strip(), 'seg': str(r[c['CG_SEGMT']] or '').strip()})
        k = str(r[c['CIF']] or '').strip()
        if k and k not in e['cif']:
            e['cif'].append(k)
        nm = clean_name(r[c['FULL_NAME']])
        if nm and m not in names:
            names[m] = nm

    name_lines = ['%s\t%s' % (m, n) for m, n in sorted(names.items())]
    cif_lines = ['%s\t%s\t%s\t%s' % (m, ','.join(e['cif']), e['brn'], e['seg']) for m, e in sorted(cif.items())]
    f_name = write_gz(os.path.join(out, 'name_index.tsv.gz'), name_lines)
    f_cif = write_gz(os.path.join(out, 'cif_map.tsv.gz'), cif_lines)
    manifest = {
        'version': version, 'builtAt': dt.datetime.now().isoformat(timespec='seconds'), 'source': os.path.basename(src),
        'counts': {'names': len(name_lines), 'fromMstSheet': n_s1, 'fromCbOnly': len(name_lines) - n_s1, 'cif': len(cif_lines),
                   'skippedMstSheet': skip1, 'skippedCb': skip2},
        'files': {'name': f_name, 'cif': f_cif},
    }
    with open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(json.dumps(manifest['counts'], ensure_ascii=False))
    print(f"name_index {f_name['bytes']/1e6:.1f} MB · cif_map {f_cif['bytes']/1e6:.2f} MB → {out} ({time.time()-t0:.0f}s)")


if __name__ == '__main__':
    main()
