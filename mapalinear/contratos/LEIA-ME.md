# Contratos do Mapa Linear

O Mapa Linear abre um contrato por vez, escolhido no endereço:

    .../mapalinear/?contrato=<id>

Sem `?contrato=`, abre o contrato `padrao` de `index.json`. Com mais de um contrato cadastrado, aparece um seletor no cabeçalho.
Pensado para uso em computador (desktop), em tela cheia ou dentro de um quadro (iframe).

## Estrutura

    contratos/
      index.json                 lista de contratos (e o padrão)
      <id>/
        cadastro.json            dados do contrato (nome, BR/UF, km, número, período...)
        dados.json               o que foi executado (reparos, soluções em trecho, aterros)
        geo.json                 opcional: geometria da rodovia, para o botão "Google Maps"
      _modelo/                   exemplo do formato (não aparece na lista)

O `<id>` usa só letras, números, `-` e `_` (ex.: `sr-rn-515-2024`).

## Como adicionar um contrato

1. Copie `_modelo/` para `contratos/<novo-id>/` e edite `cadastro.json` e `dados.json`.
2. Inclua o contrato em `index.json`:
   `{ "id": "<novo-id>", "nome": "BR-xxx/UF — contrato", "contrato": "número", "br": "BR-xxx", "uf": "UF" }`
3. Abra `.../mapalinear/?contrato=<novo-id>`. Se algum dado estiver fora do formato, a própria página lista o que corrigir.

Os arquivos são lidos por HTTP: é preciso um servidor web (qualquer um, até `python3 -m http.server` dentro da pasta `mapalinear`). Não abre direto do disco.

## `cadastro.json`

| Campo | Obrigatório | O que é |
|---|---|---|
| `id` | sim | igual ao nome da pasta |
| `nome` | sim | aparece no seletor |
| `contrato` | não | número do contrato (cabeçalho e rodapé) |
| `sigla` | não | aparece no rodapé |
| `br`, `uf` | não | ex.: `"BR-226"`, `"RN"` (título e cabeçalho) |
| `kmInicial`, `kmFinal` | **sim** | extensão do eixo desenhado no mapa, em km (ex.: 290 e 421). Todo reparo precisa estar dentro |
| `kmObraInicial`, `kmObraFinal` | não | início e fim da obra, em km, com decimais (290.32). Mostrados no cabeçalho; se faltar, usa `kmInicial`/`kmFinal` |
| `periodo` | não | `{ "inicio": "2024-10", "fim": "2026-08" }`, mostrado no cabeçalho |
| `medicoes` | não | `{ "de": 2, "ate": 24, "rotulo": "Memórias de Cálculo" }` |
| `fonteDados` | não | frase do rodapé sobre a origem dos dados |
| `linkAnterior` | não | `{ "url", "texto", "textoCurto", "titulo" }`: botão para outra página |
| `opcoes.aterroComoRP` | não | `true`: os aterros viram remendo profundo; `false` (padrão): faixa própria "Troca de solo (aterro)" |
| `itens` | não | item da planilha de cada solução, ex.: `{"CAPA":[{"item":"16.7"},{"item":"10.1","deMc":23}],"REC":[{"item":"16.2"}],"FRES":[{"item":"16.12"}],"ATERRO":[{"item":"8.3"}]}` (`deMc`: vale a partir daquela medição) |
| `descricoes` | não | texto de cada solução (`CAPA`, `REC`, `FRES`, `ATERRO`) |
| `notas` | não | lista de textos em "Notas sobre os dados". Use "Título: texto" (título de até 28 letras) |

## `dados.json`

Posição: **estaca** (1 estaca = 20 m). KM = estaca × 20 ÷ 1000 (estaca 16732 = km 334+640). Datas `AAAA-MM-DD`. Medidas em metros, volumes em m³.
`lado`: `"D"` (direito), `"E"` (esquerdo), `"D/E"` (ambos) ou `"C"` (eixo). Tudo cresce no sentido do KM a partir da estaca informada.

### `reparos` (um registro por reparo medido)

| Campo | Obrigatório | O que é |
|---|---|---|
| `mc` | sim | número da medição / memória de cálculo |
| `mp` | não | número da MP (se faltar, usa `mc`) |
| `data` | sim | data de execução |
| `estaca` | sim | estaca inicial (pode ter decimal: `5110.5`) |
| `estacaInteira` | não | `true` quando a medição só informa a estaca inteira (posição vale ±20 m; a sobreposição vira "possível") |
| `lado` | sim | ver acima |
| `extensao`, `largura` | sim | m |
| `tipo` | sim | `"RL"` reparo localizado, `"RP"` remendo profundo, `"CD"` correção de defeitos |
| `mistura` | não | `"PMF"`, `"CBUQ"` ou `null` |
| `espessura` | não | m (no RP, a do remendo) |
| `espessuraRevestimento`, `espessuraBase` | não | m, só no RP |
| `quantidade` | sim | m³ |

### `solucoes` (faixas contínuas em trecho)

| Campo | Obrigatório | O que é |
|---|---|---|
| `solucao` | sim | `"CAPA"` revestimento, `"REC"` reciclagem, `"FRES"` fresagem |
| `mc`, `mp`, `data` | sim (`mp` opcional) | como acima |
| `estacaInicial`, `estacaFinal` | sim | início e fim do trecho |
| `lado` | não | se faltar, vale `"D/E"` e a tela avisa que o lado foi deduzido |
| `largura`, `espessura` | não | m |
| `quantidade` | sim | CAPA em toneladas; REC e FRES em m³ |
| `semExtensao` | não | `true` quando o trecho não tem extensão (início = fim): é desenhado com 200 m |
| `ladoInferido` | não | `true` quando o lado foi deduzido |
| `obs` | não | texto |

### `aterros` (recomposição manual de aterro, "troca de solo")

`mc`, `data`, `estaca`, `lado`, `extensao`, `baseMaior`, `altura`, `quantidade` (todos como acima; `altura` e `baseMaior` em m).

## `geo.json` (opcional)

Lista de pontos `[km, latitude, longitude]` ao longo da rodovia, em ordem crescente de km (um a cada ~100 m basta). Dá o botão "Visualizar no Google Maps" no cartão de cada reparo. Sem esse arquivo, o botão não aparece.

## Exemplo completo

Veja `_modelo/`.
