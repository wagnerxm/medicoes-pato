#!/usr/bin/env python3
"""Extrai soluções em trecho (ESTACA INICIAL/FINAL: 16.1, 16.2, 16.7/10.1, 16.10/10.3, 16.12) e recomposição de aterro (8.3)."""
import re, glob, json, sys, os, collections
TXT = sys.argv[1]; OUT = sys.argv[2]

def num(s):
    s = s.strip()
    if re.fullmatch(r'-?\d{1,3}(\.\d{3})+,\d+', s): s = s.replace('.', '')
    return float(s.replace(',', '.'))
NUM = re.compile(r'^-?\d{1,3}(?:\.\d{3})*,\d+$|^-?\d+,\d+$')
DOT = re.compile(r'^\d{2}\.\d{3}$')
DATE = re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{2,4})$')
LADOS = {'D': 'D', 'E': 'E', 'X': 'D/E', 'D/E': 'D/E', 'E/D': 'D/E'}
SV = {'16.1': 'IMP', '16.2': 'REC', '16.7': 'CAPA', '10.1': 'CAPA', '16.10': 'PINT', '10.3': 'PINT', '16.12': 'FRES'}

def iso(d, mdy=False):
    m = DATE.match(d); a, b, y = int(m[1]), int(m[2]), int(m[3])
    if y < 100: y += 2000
    if mdy: a, b = b, a
    return f'{y:04d}-{b:02d}-{a:02d}'

def pega_mp(obs):
    m = re.search(r'(\d{1,2})\s*[ªa°º]\s*(?:MP|MED)', obs or '', re.I)
    return int(m[1]) if m else None

ESTT = re.compile(r'^(\d{2}\.\d{3})(?:,(\d+))?$')
def parse_trecho(l):
    t = l.split()
    if not t or not DATE.match(t[0]): return None
    i = 1
    if i < len(t) and t[i].startswith('BR-'): i += 1
    ests = []
    while i < len(t) and len(ests) < 2:
        m = ESTT.match(t[i])
        if not m: break
        e = float(m[1].replace('.', '')); fr = int(m[2]) if m[2] else 0; i += 1
        if not m[2] and i < len(t) and re.fullmatch(r'\d{1,2}', t[i]) and not (i + 1 < len(t) and t[i + 1] in LADOS and len(ests) == 1 and False):
            fr = int(t[i]); i += 1
        ests.append((e, fr))
    if not ests: return None
    lado = None
    if i < len(t) and t[i] in LADOS: lado = LADOS[t[i]]; i += 1
    nums = []; rest = []
    while i < len(t):
        x = t[i]
        if NUM.match(x) and not rest: nums.append(num(x))
        elif x.lower() == 'ok' and not rest: pass
        else: rest.append(x)
        i += 1
    return dict(data=t[0], ests=ests, lado=lado, nums=nums, obs=' '.join(rest))

rows = []; val = []
for f in sorted(glob.glob(os.path.join(TXT, '*MC.txt')), key=lambda f: int(os.path.basename(f).split()[0])):
    mc = int(os.path.basename(f).split()[0])
    pages = open(f, encoding='utf8').read().split('\f')
    for pi, pg in enumerate(pages):
        code = re.search(r'(\d{1,2}\.\d{1,2})\s+C[ÓO]DIGO:', pg)
        if not code or code[1] not in SV or not re.search(r'ESTACA\s+INICIAL', pg): continue
        sv = SV[code[1]]
        hdr = ' '.join(l for l in pg.split('\n') if re.search(r'EXTENS[ÃA]O\s+LARGURA|\(M\)|LADO', l))
        cols = [c for c in ('EXT', 'LARG', 'ESP', 'AREA', 'DENS', 'QTD')
                if {'EXT': 'EXTENS', 'LARG': 'LARGURA', 'ESP': 'ESPESSURA', 'AREA': 'ÁREA', 'DENS': 'DENSIDADE', 'QTD': 'QUANTIDADE'}[c] in hdr or
                (c == 'AREA' and re.search(r'[ÁA]REA', hdr))]
        tot = 0.0; soma = 0.0; n = 0
        for l in pg.split('\n'):
            r = parse_trecho(l)
            if not r:
                m = re.match(r'^\s*QUANTIDADE\s+(?:(-?[\d.]+,\d+)\s+)?(-?[\d.]+,\d+)\s*$', l)
                if m: tot = num(m[2])
                continue
            nums = r.pop('nums'); ests = r['ests']
            (ei, fi) = ests[0]; (ef, ff) = ests[1] if len(ests) > 1 else (None, None)
            d = dict(mc=mc, pg=pi + 1, item=code[1], sv=sv, data=iso(r['data']), ei=ei, fi=fi, ef=ef, ff=ff,
                     lado=r['lado'], obs=r['obs'], mpo=pega_mp(r['obs']))
            if ef is not None:
                dist = abs((ei * 20 + fi) - (ef * 20 + ff))
                k = next((j for j, v in enumerate(nums) if abs(v - dist) <= max(1.0, dist * 0.02)), None)
                if k is None:
                    d['raw'] = nums; d['_erro'] = 'ext não achada'
                else:
                    d['ext'] = nums[k]; rest = nums[k + 1:]
                    if len(rest) >= 2: d['larg'], d['esp'] = rest[0], rest[1]
                    if len(rest) >= 1: d['qtd'] = rest[-1]
                    if len(rest) >= 5: d['area'] = rest[2]
                    if len(rest) == 2: d['larg'], d['esp'] = rest[0], None; d.pop('esp'); d['larg'] = rest[0]
            else:
                d['raw'] = nums; d['ponto'] = True
                if len(nums) >= 2: d['qtd'] = nums[-1]; d['area'] = nums[1] if len(nums) >= 4 else None; d['esp'] = nums[0]
            if d['lado'] is None: d['lado'] = 'D/E'; d['ladoInf'] = True
            rows.append(d); n += 1; soma += d.get('qtd', 0)
        val.append(dict(mc=mc, item=code[1], sv=sv, n=n, soma=round(soma, 3), total_impresso=tot))
json.dump(rows, open(OUT, 'w'), ensure_ascii=False)
print('trechos:', len(rows), 'sem qtd:', sum('qtd' not in r for r in rows))
for v in val: print(v)
print(collections.Counter(r['sv'] for r in rows))
