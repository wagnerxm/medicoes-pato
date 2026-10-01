# Medições PATO — BR-226/RN

Painel interativo de visualização linear das medições de execução do contrato DNIT **SR/RN 515/2024** na **BR-226/RN** (km 290 → 421, extensão de 130,70 km).

## O que faz

Mostra graficamente, em um mapa linear horizontal, quais serviços de conservação rodoviária foram executados em cada trecho da rodovia — CBUQ, fresagem, reciclagem, imprimação, drenagem, terraplenagem, entre outros — com base nos dados das Memórias de Cálculo (MC 15, 18, 20, 23, 24).

### Funcionalidades

- **Mapa linear** com scroll horizontal e zoom (botões, Ctrl+roda, pinch)
- **9 categorias de serviço** com cores distintas e filtragem por chip
- **Filtro por lado** (D / E / Ambos)
- **Card flutuante** com detalhes do segmento (KM, estacas, extensão, largura, espessura, tonelagem, área, volume)
- **Minimapa** para navegação rápida
- **Tabela detalhada** com ordenação por qualquer coluna
- **Indicador de KM** acompanhando o scroll
- **Tema claro/escuro** (escuro como padrão)
- **KPIs resumo**: valor contratual, executado, % execução, extensão, segmentos

## Dados do contrato

| Campo | Valor |
|---|---|
| Contrato | SR/RN 515/2024 |
| Rodovia | BR-226/RN |
| Trecho | km 290+420 → km 420+820 |
| Extensão | 130,70 km |
| Valor contratual | R$ 42.930.000,00 |
| Valor executado | R$ 16.570.059,32 (38,60%) |

## Arquitetura

Arquivo único `index.html` — HTML + CSS + JS inline, sem build, sem dependências de runtime. Basta abrir no navegador ou servir via GitHub Pages.

| Arquivo | Papel |
|---|---|
| `index.html` | Aplicação completa (visualização, dados, estilos, interatividade) |

### Fontes externas (Google Fonts)

- **Outfit** (300–800) — textos e títulos
- **Space Mono** (400, 700) — dados numéricos e monoespaçados

## Como usar

Acesse via GitHub Pages ou abra `index.html` localmente.

### Interação

- **Scroll horizontal** na faixa da rodovia para navegar
- **Ctrl + roda do mouse** para zoom
- **Clique nos chips** de categoria para filtrar serviços
- **Passe o mouse** sobre segmentos para ver detalhes
- **Clique em um segmento** (no mapa ou na tabela) para centralizar e ampliar
- **Clique no minimapa** para saltar para um trecho
- **Botão Tema** para alternar claro/escuro

## Licença

Dados públicos do DNIT. Visualização de uso interno.
