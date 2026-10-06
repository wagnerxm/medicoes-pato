#!/usr/bin/env python3
"""Extrai reparos individuais (RL 3.1, base BGS 3.2, RP 3.3, correção 4.1) das Memórias de Cálculo.
Entrada: txt gerados com `pdftotext -layout`. Saída: JSON bruto + relatório de validação (soma x total impresso)."""
import re, glob, json, sys, os, collections
TXT = sys.argv[1]; OUT = sys.argv[2]

def num(s):
    s = s.strip()
    if re.fullmatch(r'-?\d{1,3}(\.\d{3})+,\d+', s): s = s.replace('.', '')
    return float(s.replace(',', '.'))
NUM = re.compile(r'^-?\d{1,3}(?:\.\d{3})*,\d+$|^-?\d+,\d+$|^-?\d+$')
EST = re.compile(r'^(\d{2}\.\d{3}|\d{5}(?:,\d+)?)$')          # 16.735 | 16934 | 16934,95
DATE = re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{2,4})$')
LADOS = {'D': 'D', 'E': 'E', 'X': 'D/E', 'D/E': 'D/E', 'E/D': 'D/E', 'LD': 'D', 'LE': 'E', "E'": 'E', "D'": 'D', 'EIXO': 'C'}

def estaca(tok):
    if re.fullmatch(r'\d{2}\.\d{3}', tok): return float(tok.replace('.', '')), True   # inteira (milhar com ponto)
    v = num(tok)
    return v, v == int(v) and ',' not in tok

MDY = False  # MC 23 usa mês/dia/ano
def iso(d):
    m = DATE.match(d); dd, mm, yy = int(m[1]), int(m[2]), int(m[3])
    if MDY: dd, mm = mm, dd
    if yy < 100: yy += 2000
    return f'{yy:04d}-{mm:02d}-{dd:02d}'

SERV = [  # (chave, regex no texto da página)
    ('RP3', r'REMENDO PROFUNDO COM IMPRIMA'),
    ('BGS', r'BRITA GRADUADA SIMPLES PARA BASE DE REMENDO'),
    ('RL', r'REPARO LOCALIZADO COM PINTURA'),
    ('CD', r'CORRE[ÇC][ÃA]O DE DEFEITOS'),
]

def servico(page):
    # só vale página de tabela de reparo (tem cabeçalho DATA ... ESTACA ... LADO)
    if not re.search(r'DATA\s+N[ºo°]?\s+ESTACA\s+LADO|DATA\s+ESTACA\s+LADO', page): return None
    head = '\n'.join(page.split('\n')[:30])
    for k, rx in SERV:
        if re.search(rx, head): return k
    return None

def parse_row(l):
    t = l.split()
    if not t or not DATE.match(t[0]): return None
    i = 1
    nn = None
    if i < len(t) and re.fullmatch(r'\d{1,4}', t[i]) and i + 1 < len(t) and EST.match(t[i + 1]):
        nn = int(t[i]); i += 1
    if i >= len(t) or not EST.match(t[i]): return None
    est, inteira = estaca(t[i]); i += 1
    lado = None
    if i < len(t) and t[i] in LADOS: lado = LADOS[t[i]]; i += 1
    nums = []; mist = None; rest = []
    while i < len(t):
        x = t[i]
        if NUM.match(x) and mist is None and not rest: nums.append(num(x))
        elif x in ('PMF', 'CBUQ', 'BGS', 'CAUQ', 'TSD') and mist is None and not rest: mist = x
        elif NUM.match(x) and mist is not None and not rest: nums.append(num(x))
        else: rest.append(x)
        i += 1
    return dict(data=iso(t[0]), n=nn, est=est, inteira=inteira, lado=lado, nums=nums, mist=mist, obs=' '.join(rest))

def pega_mp(obs):
    m = re.search(r'(\d{1,2})\s*[ªa]\s*MP', obs or '')
    return int(m[1]) if m else None

rows = []; val = []
for f in sorted(glob.glob(os.path.join(TXT, '*MC.txt')), key=lambda f: int(os.path.basename(f).split()[0])):
    mc = int(os.path.basename(f).split()[0])
    pages = open(f, encoding='utf8').read().split('\f')
    soma = collections.defaultdict(float); tot = collections.defaultdict(float); cont = collections.Counter()
    MDY = (mc == 23)
    sv = None; troca_esp = False
    for pg in pages:
        tem_cab = bool(re.search(r'C[ÓO]DIGO:|SERVIÇO:|SERVICO:', pg))
        if tem_cab:
            sv = servico(pg)          # página com cabeçalho: define (ou zera) o serviço
            # a ordem das colunas de espessura do remendo profundo muda entre as MCs: ler pelo cabeçalho
            i_rem, i_rev = pg.find('ESP. REMENDO'), pg.find('ESP. REVEST')
            if i_rem >= 0 and i_rev >= 0: troca_esp = i_rem < i_rev
        if not sv: continue           # continuação sem cabeçalho herda o serviço corrente
        for l in pg.split('\n'):
            r = parse_row(l)
            if r:
                nums = r.pop('nums')
                r['mc'] = mc; r['sv'] = sv; r['mpo'] = pega_mp(r['obs'])
                if sv == 'RL' or sv == 'CD':
                    if len(nums) < 4: r['_erro'] = 'poucos números'; r['raw'] = nums
                    else:
                        r['ext'], r['larg'], r['esp'] = nums[0], nums[1], nums[2]
                        r['qtd'] = nums[-1]; r['area'] = nums[-2] if len(nums) >= 5 else round(nums[0] * nums[1], 3)
                elif sv == 'BGS':
                    if len(nums) < 4: r['_erro'] = 'poucos números'; r['raw'] = nums
                    else:
                        r['ext'], r['larg'], r['esp'] = nums[0], nums[1], nums[2]; r['qtd'] = nums[-1]
                        r['area'] = nums[3] if len(nums) >= 5 else round(nums[0] * nums[1], 3)
                else:  # RP3
                    if len(nums) < 5: r['_erro'] = 'poucos números'; r['raw'] = nums
                    else:
                        r['ext'], r['larg'] = nums[0], nums[1]
                        r['espRem'], r['espRev'] = (nums[2], nums[3]) if troca_esp else (nums[3], nums[2])
                        r['qtd'] = nums[-1]; r['area'] = nums[4] if len(nums) >= 6 else round(nums[0] * nums[1], 3)
                rows.append(r); cont[sv] += 1
                if 'qtd' in r: soma[sv] += r['qtd']
        # total impresso: linha "QUANTIDADE ... valor" no fim do bloco
        for m in re.finditer(r'^\s*QUANTIDADE\s+(-?[\d.]+,\d+)\s*$', pg, re.M):
            tot[sv] += num(m[1])
    val.append(dict(mc=mc, n=dict(cont), soma={k: round(v, 3) for k, v in soma.items()}, total_impresso={k: round(v, 3) for k, v in tot.items()}))

json.dump(rows, open(OUT, 'w'), ensure_ascii=False)
print('total linhas', len(rows), '| com erro:', sum('_erro' in r for r in rows))
for v in val: print(v)
