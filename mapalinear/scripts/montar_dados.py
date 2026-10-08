#!/usr/bin/env python3
"""Consolida reparos/trechos/aterro extraídos das MCs em dados.js (para o mapa de reparos)."""
import json, collections, sys

rep = json.load(open('reparos_raw.json'))
tre = json.load(open('trechos_raw.json'))
ate = json.load(open('aterro_raw.json'))
rel = []   # relatório de decisões

# Datas com erro de digitação na própria MC (fora do período e fora da sequência das linhas vizinhas)
corr_datas = 0
for x in rep:
    if x['mc'] == 12 and x['data'] == '2025-09-29': x['data'] = '2025-08-29'; corr_datas += 1   # sequência 28/08, 29/08, "29/09"
for r in tre:
    if r['mc'] == 18 and r['sv'] == 'REC' and r['data'] == '2026-12-11': r['data'] = '2025-12-11'; corr_datas += 1  # IMP/CAPA/PINT do mesmo trecho: 11/12/2025
rel.append(f'datas corrigidas (erro de digitação na MC): {corr_datas}')

# Estaca com erro de digitação na MC 2 (E12265 entre 15217 e 15281): confirmada pelo usuário como 15265
corr_est = 0
for x in rep:
    if x['mc'] == 2 and x['est'] == 12265.0: x['est'] = 15265.0; corr_est += 1
rel.append(f'estacas corrigidas (erro de digitação na MC): {corr_est}')

# ---------- REPAROS ----------
# MC 22 foi estornada por falta de empenho e remedida (corrigida) na MC 23 -> descartar MC 22
n22 = sum(1 for x in rep if x['mc'] == 22 and x['sv'] in ('RL', 'BGS', 'RP3'))
rep = [x for x in rep if not (x['mc'] == 22 and x['sv'] in ('RL', 'BGS', 'RP3'))]
rel.append(f'reparos MC 22 descartados (estorno; refeitos na MC 23): {n22}')

LADO = {'D': 0, 'E': 1, 'D/E': 2, 'C': 3}
rk = lambda x: (x['mc'], x['data'], x['lado'], round(x['ext'], 3), round(x['larg'], 3))  # estaca arredondada difere entre 3.2 e 3.3
bgs = collections.defaultdict(list)
for x in rep:
    if x['sv'] == 'BGS': bgs[rk(x)].append(x)
out = []; sem_base = 0
for x in rep:
    if x['sv'] == 'BGS': continue
    tipo = {'RL': 0, 'RP3': 1, 'CD': 2}[x['sv']]
    mist = {'PMF': 0, 'CBUQ': 1}.get(x['mist'], -1)
    esp = x.get('esp') if tipo != 1 else x.get('espRem')
    base = None
    if tipo == 1:
        b = bgs.get(rk(x))
        if b: base = b.pop(0)['esp']
        else: sem_base += 1
    mp = x.get('mpo') or x['mc']
    out.append([x['mc'], mp, x['data'], x['est'], 1 if x['inteira'] else 0, LADO[x['lado'] or 'D/E'], x['ext'], x['larg'],
                tipo, mist, esp, (x.get('espRev') if tipo == 1 else None), base, x['qtd']])
rel.append(f'RP sem base BGS correspondente: {sem_base}; BGS não pareados: {sum(len(v) for v in bgs.values())}')
out.sort(key=lambda r: (r[2], r[3]))
REP = out

# ---------- TRECHOS ----------
def pos(r):
    a = r['ei'] * 20 + r['fi']
    b = (r['ef'] * 20 + r['ff']) if r['ef'] is not None else a
    return min(a, b), max(a, b)
cand = [r for r in tre if r['sv'] in ('CAPA', 'REC', 'FRES')]
cand = [r for r in cand if r.get('ext') or r.get('ponto')]
def mpof(r): return r['mpo'] or r['mc']
# dedupe por sobreposição (mesma data, solução e lado): vale a MC mais recente
cand.sort(key=lambda r: (-r['mc'], -(r.get('qtd') or 0)))
keep = []; dropped = []
for r in cand:
    a0, a1 = pos(r)
    dup = None
    for k in keep:
        if k['sv'] != r['sv'] or k['data'] != r['data'] or k['lado'] != r['lado']: continue
        b0, b1 = pos(k)
        ov = min(a1, b1) - max(a0, b0)
        if ov > 0.5 * min(a1 - a0, b1 - b0): dup = k; break
    if dup: dropped.append((r, dup))
    else: keep.append(r)
rel.append(f'trechos (CAPA/REC/FRES): {len(cand)} linhas -> {len(keep)} após dedupe ({len(dropped)} repetidas entre MCs)')
for r, k in dropped: rel.append(f"   descartada MC{r['mc']} {r['sv']} {r['data']} {r['lado']} {r['ei']:.0f}+{r['fi']} (vale MC{k['mc']})")

# MC 15 (capa 16.7) vem sem lado e com 2 linhas (duas faixas de 3,60 m): atribuir D e E
c15 = sorted([r for r in keep if r['sv'] == 'CAPA' and r['mc'] == 15 and r.get('ladoInf')], key=lambda r: r['data'])
for r, l in zip(c15, ('D', 'E')): r['lado'] = l; r['ladoDeduz'] = True
rel.append(f'capa MC15 sem lado -> D/E por ordem: {len(c15)} linhas')

TRE = []
for r in sorted(keep, key=lambda r: (r['data'], pos(r)[0])):
    a0, a1 = pos(r)
    TRE.append(dict(sv=r['sv'], mc=r['mc'], mp=mpof(r), data=r['data'], s=a0, e=a1, lado=r['lado'],
                    larg=r.get('larg'), esp=r.get('esp'), qtd=r.get('qtd'), ponto=1 if r.get('ponto') else 0,
                    inf=1 if (r.get('ladoInf') or r.get('ladoDeduz')) else 0, obs=r['obs'][:60]))
rel.append('trechos por solução: ' + str(dict(collections.Counter(t['sv'] for t in TRE))))

# ---------- ATERRO (8.3) ----------
ATE = []
for a in ate:
    n = a['nums']
    d = dict(mc=a['mc'], data=a['data'], est=a['est'], lado=a['lado'], ext=n[0], qtd=n[-1])
    if len(n) == 5: d.update(bmaior=n[1], bmenor=n[2], alt=n[3])
    elif len(n) == 4: d.update(bmaior=n[1], alt=n[2])
    ATE.append(d)

json.dump(dict(REP=REP, TRE=TRE, ATE=ATE, rel=rel), open('dados_final.json', 'w'), ensure_ascii=False)
print('\n'.join(rel))
print('REP', len(REP), '| TRE', len(TRE), '| ATE', len(ATE))
print('por tipo/mist:', collections.Counter((r[8], r[9]) for r in REP))
print('REP datas', min(r[2] for r in REP), max(r[2] for r in REP))
