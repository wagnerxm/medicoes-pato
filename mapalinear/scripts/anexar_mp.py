#!/usr/bin/env python3
"""Acrescenta medições NOVAS (extraídas com extrair_*.py de poucas MCs) ao dados.json de um contrato, sem refazer as antigas.
Uso: anexar_mp.py <contratos/ID/dados.json> <pasta com reparos_raw.json, trechos_raw.json e aterro_raw.json>
Faz o mesmo que montar_dados.py + gerar_dados.py para as MCs novas, mas NÃO cruza com as MCs antigas: se a MC nova refaz
trechos de uma MC anterior (como a MC 23 fez com a 20 e a 22), confira a repetição à mão. Refazer a mesma MC substitui os registros dela."""
import json, sys, collections
dados_p, pasta = sys.argv[1], sys.argv[2]
d = json.load(open(dados_p))
rep = json.load(open(f'{pasta}/reparos_raw.json')); tre = json.load(open(f'{pasta}/trechos_raw.json')); ate = json.load(open(f'{pasta}/aterro_raw.json'))
mcs = sorted({x['mc'] for x in rep + tre + ate})
# recolocar uma MC já lançada: tira os registros antigos dela primeiro
d['reparos'] = [r for r in d['reparos'] if r['mc'] not in mcs]; d['solucoes'] = [t for t in d['solucoes'] if t['mc'] not in mcs]; d['aterros'] = [a for a in d['aterros'] if a['mc'] not in mcs]
rk = lambda x: (x['mc'], x['data'], x['lado'], round(x['ext'], 3), round(x['larg'], 3))   # base BGS pareia com o remendo profundo
bgs = collections.defaultdict(list)
for x in rep:
    if x['sv'] == 'BGS': bgs[rk(x)].append(x)
novos = 0
for x in rep:
    if x['sv'] == 'BGS': continue
    rp = x['sv'] == 'RP3'
    o = {'mc': x['mc'], 'mp': x.get('mpo') or x['mc'], 'data': x['data'], 'estaca': x['est'], 'estacaInteira': bool(x['inteira']), 'lado': x['lado'] or 'D/E',
         'extensao': x['ext'], 'largura': x['larg'], 'tipo': {'RL': 'RL', 'RP3': 'RP', 'CD': 'CD'}[x['sv']], 'mistura': x['mist'] if x['mist'] in ('PMF', 'CBUQ') else None,
         'espessura': x.get('espRem') if rp else x.get('esp')}
    if rp:
        o['espessuraRevestimento'] = x.get('espRev')
        b = bgs.get(rk(x))
        if b: o['espessuraBase'] = b.pop(0)['esp']
    o['quantidade'] = x['qtd']
    d['reparos'].append({k: v for k, v in o.items() if v is not None or k in ('mistura', 'espessura')}); novos += 1
pos = lambda r: (min(r['ei'] * 20 + r['fi'], (r['ef'] * 20 + r['ff']) if r['ef'] is not None else r['ei'] * 20 + r['fi']),
                 max(r['ei'] * 20 + r['fi'], (r['ef'] * 20 + r['ff']) if r['ef'] is not None else r['ei'] * 20 + r['fi']))
for r in tre:
    if r['sv'] not in ('CAPA', 'REC', 'FRES') or not (r.get('ext') or r.get('ponto')): continue
    a0, a1 = pos(r)
    o = {'solucao': r['sv'], 'mc': r['mc'], 'mp': r.get('mpo') or r['mc'], 'data': r['data'], 'estacaInicial': round(a0 / 20, 4), 'estacaFinal': round(a1 / 20, 4),
         'lado': r['lado'], 'largura': r.get('larg'), 'espessura': r.get('esp'), 'quantidade': r.get('qtd')}
    if r.get('ponto'): o['semExtensao'] = True
    if r.get('ladoInf'): o['ladoInferido'] = True
    if r['obs']: o['obs'] = r['obs'][:60]
    d['solucoes'].append(o)
for a in ate:
    n = a['nums']
    d['aterros'].append({'mc': a['mc'], 'data': a['data'], 'estaca': a['est'], 'lado': a['lado'], 'extensao': n[0],
                         'baseMaior': n[1] if len(n) >= 4 else None, 'altura': n[3] if len(n) == 5 else (n[2] if len(n) == 4 else None), 'quantidade': n[-1]})
d['reparos'].sort(key=lambda r: (r['data'], r['estaca'])); d['solucoes'].sort(key=lambda t: (t['data'], t['estacaInicial'])); d['aterros'].sort(key=lambda a: (a['data'], a['estaca']))
j = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'))
out = '{"reparos":[\n' + ',\n'.join(j(r) for r in d['reparos']) + '\n],\n"solucoes":[\n' + ',\n'.join(j(t) for t in d['solucoes']) + '\n],\n"aterros":[\n' + ',\n'.join(j(a) for a in d['aterros']) + '\n]}\n'
open(dados_p, 'w', encoding='utf8').write(out)
print(f'MC {mcs}: {novos} reparos, {sum(1 for t in d["solucoes"] if t["mc"] in mcs)} soluções em trecho, {len(ate)} aterros acrescentados')
