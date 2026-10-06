#!/usr/bin/env python3
"""Extrai pontos de recomposição manual de aterro (item 8.3) das MCs (txt do pdftotext -layout)."""
import re, glob, os, json, sys
TXT, OUT = sys.argv[1], sys.argv[2]
def num(s):
    s = s.strip()
    if re.fullmatch(r'-?\d{1,3}(\.\d{3})+,\d+', s): s = s.replace('.', '')
    return float(s.replace(',', '.'))
NUM = re.compile(r'^-?\d{1,3}(?:\.\d{3})*,\d+$|^-?\d+,\d+$|^\d+$')
rows = []
for f in sorted(glob.glob(os.path.join(TXT, '*MC.txt')), key=lambda f: int(os.path.basename(f).split()[0])):
    mc = int(os.path.basename(f).split()[0]); pages = open(f, encoding='utf8').read().split('\f')
    for p in pages:
        code = re.search(r'(\d{1,2}\.\d{1,2})\s+C[ÓO]DIGO:', p)
        if not code or code[1] != '8.3' or 'RECOMPOSI' not in p[:4000]: continue
        for l in p.split('\n'):
            t = l.split()
            if len(t) < 6 or not re.fullmatch(r'\d{1,2}/\d{1,2}/\d{2,4}', t[0]): continue
            loc = t[1].replace('.', '') if re.fullmatch(r'\d{2}\.\d{3}', t[1]) else t[1].replace(',', '.')
            try: est = float(loc)
            except ValueError: continue
            lado = t[2] if t[2] in ('D', 'E', 'D/E', 'X', 'E/D') else None
            ns = [num(x) for x in t[3 if lado else 2:] if NUM.match(x)]
            d, m, y = [int(x) for x in t[0].split('/')]
            if y < 100: y += 2000
            rows.append(dict(mc=mc, data=f'{y:04d}-{m:02d}-{d:02d}', est=est, lado={'X': 'D/E', 'E/D': 'D/E', None: 'D/E'}.get(lado, lado), nums=ns, raw=l.strip()[:120]))
json.dump(rows, open(OUT, 'w'), ensure_ascii=False)
print('aterro:', len(rows))
