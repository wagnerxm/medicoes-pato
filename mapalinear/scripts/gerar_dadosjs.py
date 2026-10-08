#!/usr/bin/env python3
"""Gera mapalinear/dados.js a partir de dados_final.json."""
import json, sys
d = json.load(open('dados_final.json')); REP = d['REP']; TRE = d['TRE']; ATE = d['ATE']
j = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'))
tre = [[t['sv'], t['mc'], t['mp'], t['data'], t['s'], t['e'], t['lado'], t['larg'], t['esp'], t['qtd'], t['ponto'], t['inf'], t['obs']] for t in TRE]
ate = [[a['mc'], a['data'], a['est'], a['lado'], a['ext'], a.get('bmaior'), a.get('alt'), a['qtd']] for a in ATE]
out = '/* Dados extraídos das Memórias de Cálculo do contrato SR/RN 515/2024 (MC 2 a 24).\n   Gerado por scripts/*.py — não editar à mão. */\n'
out += '/* Reparos: um registro por reparo/remendo medido.\n   [mc, mp, data, estaca, estInteira(1=estaca arredondada, ±20 m), lado(0 D,1 E,2 D/E,3 eixo), extensão m, largura m,\n    tipo(0 reparo localizado,1 remendo profundo,2 correção de defeitos), mistura(0 PMF,1 CBUQ,-1 n/d),\n    espessura m (remendo: espessura do remendo), espessura revest. m (só RP), espessura base BGS m (só RP), quantidade m³] */\n'
out += 'const REP=' + j(REP).replace('],[', '],\n[') + ';\n'
out += '/* Soluções em trecho: [solução(CAPA|REC|FRES), mc, mp, data, posição inicial (m = estaca×20+fração), posição final (m), lado, largura m, espessura m, quantidade (CAPA: t; REC e FRES: m³), ponto(1=sem extensão informada), ladoInferido, observação] */\n'
out += 'const TRE=' + j(tre).replace('],[', '],\n[') + ';\n'
out += '/* Recomposição manual de aterro (item 8.3): [mc, data, estaca, lado, extensão m, base maior m, altura m, quantidade m³] */\n'
out += 'const ATE=' + j(ate).replace('],[', '],\n[') + ';\n'
open(sys.argv[1], 'w', encoding='utf8').write(out)
print(len(out) // 1024, 'KB')
