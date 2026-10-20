#!/usr/bin/env python3
"""Gera contratos/<id>/dados.json (formato em contratos/LEIA-ME.md) a partir de dados_final.json."""
import json, sys
d = json.load(open('dados_final.json')); REP = d['REP']; TRE = d['TRE']; ATE = d['ATE']
j = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'))
LADO = ['D', 'E', 'D/E', 'C']; TIPO = ['RL', 'RP', 'CD']
def rep(r):
    mc, mp, data, est, inte, lado, ext, larg, tipo, mist, esp, er, eb, q = r
    o = {'mc': mc, 'mp': mp, 'data': data, 'estaca': est, 'estacaInteira': bool(inte), 'lado': LADO[lado], 'extensao': ext,
         'largura': larg, 'tipo': TIPO[tipo], 'mistura': {0: 'PMF', 1: 'CBUQ'}.get(mist), 'espessura': esp}
    if er is not None: o['espessuraRevestimento'] = er
    if eb is not None: o['espessuraBase'] = eb
    o['quantidade'] = q
    return o
def tre(t):  # posições do extrator estão em metros (estaca×20); o arquivo guarda estacas
    o = {'solucao': t['sv'], 'mc': t['mc'], 'mp': t['mp'], 'data': t['data'], 'estacaInicial': round(t['s'] / 20, 4), 'estacaFinal': round(t['e'] / 20, 4),
         'lado': t['lado'], 'largura': t['larg'], 'espessura': t['esp'], 'quantidade': t['qtd']}
    if t['ponto']: o['semExtensao'] = True
    if t['inf']: o['ladoInferido'] = True
    if t['obs']: o['obs'] = t['obs']
    return o
def ate(a):
    return {'mc': a['mc'], 'data': a['data'], 'estaca': a['est'], 'lado': a['lado'], 'extensao': a['ext'], 'baseMaior': a.get('bmaior'), 'altura': a.get('alt'), 'quantidade': a['qtd']}
out = '{"reparos":[\n' + ',\n'.join(j(rep(r)) for r in REP) + '\n],\n"solucoes":[\n' + ',\n'.join(j(tre(t)) for t in TRE) + '\n],\n"aterros":[\n' + ',\n'.join(j(ate(a)) for a in ATE) + '\n]}\n'
open(sys.argv[1], 'w', encoding='utf8').write(out)
print(len(out) // 1024, 'KB')
