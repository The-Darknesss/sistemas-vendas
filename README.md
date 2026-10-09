# Sistema de Vendas — Grupo 2

Elo 2 da cadeia de integração por arquivos CSV (disciplina de **Integração de
Aplicações**). O grupo é responsável pelo **Sistema de Vendas** e atua nos dois
papéis exigidos pelo trabalho:

```
Grupo 1 (Clientes) ──CSV──> [ VOCÊS: Vendas ] ──CSV──> Grupo 3 (Produtos)
                             consumidor          produtor
```

- **Produtor**: gera 5 remessas de `vendas-NNN.csv` — 2 válidas e 3 com as
  inconsistências definidas pelo professor —, com controle de remessa.
- **Consumidor**: recebe o arquivo de clientes do Grupo 1, valida contra o
  contrato, processa os registros válidos no banco e rejeita os inválidos sem
  interromper o lote.

Documentos da entrega: [`docs/CONTRATO-VENDAS.md`](docs/CONTRATO-VENDAS.md)
(contrato de saída), [`docs/CONTRATO-CLIENTES.md`](docs/CONTRATO-CLIENTES.md)
(contrato de entrada),
[`docs/RELATORIO-TECNICO.md`](docs/RELATORIO-TECNICO.md) e
[`docs/INCONSISTENCIAS-PROFESSOR.md`](docs/INCONSISTENCIAS-PROFESSOR.md)
(somente para o professor — não enviar ao grupo consumidor). As versões `.docx`
ficam em `docs/entrega/`.

## Stack

| Camada    | Tecnologia                                    |
|-----------|-----------------------------------------------|
| Frontend  | Vite + React 19 + Tailwind CSS 4              |
| Backend   | Node.js + Express (porta 3001)                |
| CSV       | `csv-stringify` (escrita) + `csv-parse` (leitura) |
| Banco     | `node:sqlite` (nativo do Node 22+)            |
| Dev       | `concurrently` (sobe front e API juntos)      |

## Requisitos

- Node.js **>= 20.19** (necessário para Vite 8 / rolldown / oxlint).
- Alternativa: `bun run dev` (usa o Node do sistema).

## Como rodar

```bash
npm run dev
```

O comando `npm run dev` sobe os dois processos juntos (via `concurrently`):

- Frontend (Vite): http://localhost:5173
- API (Express): http://localhost:3001

## Como usar

1. Abra http://localhost:5173
2. Em **Produzir**, clique em um dos 5 botões (`001` a `005`) — cada um gera
   dados aleatórios novos, grava a remessa e o arquivo de controle `.ctl` em
   `output/produtor/`, registra o log e baixa os dois no navegador:
   - `001` e `002` → remessas **válidas**
   - `003`, `004` e `005` → remessas com as **inconsistências** do professor
   - a caixa *"gerar como arquivo de substituição"* produz
     `vendas-NNN-substituto.csv` (item 15.8), já **corrigido** (sem as
     inconsistências)
3. Em **Consumir**, escolha um arquivo do Grupo 1 e clique em **validar**. A
   caixa *"é um arquivo corrigido (reprocessar)"* aciona o ciclo do item 21.
4. Para reproduzir o problema 10.21 (remessa fora de sequência), gere o
   **005 antes do 004** — o `remessa.log` registra a ordem real.

Via API:

```bash
curl -X POST http://localhost:3001/api/gerar-csv/1
curl -X POST http://localhost:3001/api/gerar-csv/2
curl -X POST http://localhost:3001/api/gerar-csv/3
curl -X POST http://localhost:3001/api/gerar-csv/4
curl -X POST http://localhost:3001/api/gerar-csv/5
```

## Endpoints da API

| Método | Rota                     | Descrição                                            |
|--------|--------------------------|------------------------------------------------------|
| POST   | `/api/gerar-csv/1`       | Gera `vendas-001.csv` (válido) + registro de remessa  |
| POST   | `/api/gerar-csv/2`       | Gera `vendas-002.csv` (válido) + registro de remessa  |
| POST   | `/api/gerar-csv/3`       | Gera `vendas-003.csv` (inconsistências)               |
| POST   | `/api/gerar-csv/4`       | Gera `vendas-004.csv` (inconsistências)               |
| POST   | `/api/gerar-csv/5`       | Gera `vendas-005.csv` (inconsistências)               |
| POST   | `/api/validar`           | Recebe e valida um arquivo de clientes do Grupo 1     |
| GET    | `/api/clientes`          | Resultado da integração: base gravada + remessas      |

Os geradores aceitam `?substituto=true&motivo=...`, que produz
`vendas-NNN-substituto.csv` — o arquivo de substituição do item 15.8, gerado sem
as inconsistências, para quando o consumidor rejeita uma remessa inteira.

`POST /api/validar` aceita `{ nome_arquivo, csv, reprocessamento }`. Com
`reprocessamento: true`, o controle de sequência não se aplica e os registros
válidos atualizam os já gravados — é o ciclo do item 21.

## Contrato do arquivo CSV (remessas `vendas-NNN.csv`)

| Característica      | Valor                                          |
|---------------------|------------------------------------------------|
| Delimitador         | ponto e vírgula (`;`)                         |
| Codificação         | UTF-8 (sem BOM)                               |
| Quebra de linha     | `\n`                                          |
| Cabeçalho           | presente, na ordem da tabela abaixo           |
| Aspas               | `"` apenas quando o valor contém delimitador ou quebra de linha |
| Linhas de dados     | mínimo 177 (a geração produz 220)             |
| Arquivos gerados    | 5 remessas: `vendas-001/002.csv` (válidos) e `vendas-003/004/005.csv` (inconsistências) |

O contrato completo (identificação, estrutura e regras de validação de cada
campo) está em [`docs/CONTRATO-VENDAS.md`](docs/CONTRATO-VENDAS.md). O
delimitador e o tratamento de caracteres especiais são aplicados por
`csv-stringify` nas remessas válidas (`server/produtor/csv-1.js` e `csv-2.js`) e
por `server/contrato.js` nas remessas com inconsistências.

## Modelo de dados exportado (11 colunas)

| Campo            | Tipo    | Obrigatório | Formato                              | Exemplo    |
|------------------|---------|-------------|--------------------------------------|------------|
| id_venda         | Inteiro | Sim         | numérico                             | 1042       |
| id_cliente       | Inteiro | Sim         | numérico                             | 102        |
| id_produto       | Inteiro | Sim         | numérico                             | 305        |
| quantidade       | Inteiro | Sim         | numérico                             | 3          |
| valor_unitario   | Decimal | Sim         | 9999.99 (ponto decimal)              | 149.90     |
| valor_total      | Decimal | Sim         | 99999.99 = quantidade × valor_unitario | 449.70   |
| data_venda       | Data    | Sim         | DD/MM/YYYY                           | 12/03/2026 |
| forma_pagamento  | Texto   | Sim         | PIX \| CARTAO \| BOLETO              | PIX        |
| status           | Texto   | Sim         | CONCLUIDA \| CANCELADA               | CONCLUIDA  |
| integrante       | Texto   | Sim         | nome do integrante do Grupo 2        | Paulo Eduardo |
| email            | Texto   | Sim         | e-mail padrão, coerente com `integrante` | paulo.eduardo@grupo2.com |

Os valores de `integrante`/`email` alternam entre os membros do grupo 2
(Paulo Eduardo, Joao Pedro Azevedo, Hyago Fernandes).

## Controle de remessa (`vendas-NNN.ctl` + `logs/produtor/remessa.log`)

Cada CSV sai acompanhado de um arquivo de controle, que vai junto para o
consumidor (contrato, seção 4):

```
arquivo;sequencia;tipo;remessa;data_hora;registros;sha256
vendas-001.csv;1;NORMAL;<UUID>;2026-09-17 22:26:35;220;<sha256 do CSV>
```

E uma linha é adicionada ao histórico do produtor:

```
[AAAA-MM-DD HH:MM:SS] arquivo=vendas-001.csv registros=<qtd> remessa=<UUID> sequencia=<NNN> sha256=<hash>
```

O UUID é único por remessa (`randomUUID`), permitindo rastrear envio/recebimento
entre os grupos da cadeia.

## Arquivos com inconsistências (remessas 003–005)

Os problemas do professor (10.11–10.21) são intercalados entre registros
válidos em posições fixas do arquivo:

| Remessa | Linha | Problema (professor)                        | Inconsistência inserida                        |
|---------|-------|---------------------------------------------|------------------------------------------------|
| 003     | 6     | 10.11 valor numérico em formato diferente   | `valor_unitario=1250,50` (vírgula)             |
| 003     | 41    | 10.16 espaços indevidos                     | espaços em volta do delimitador (`" ; "`)      |
| 003     | 65    | 10.13 registro duplicado                    | `id_venda` repetido (chave da linha 2)         |
| 004     | 15    | 10.14 tipo de dado inválido                 | `data_venda=ABC` (deveria ser data)            |
| 004     | 78    | 10.17 linha em branco                       | linha em branco entre registros                |
| 004     | 92    | 10.20 valor nulo / inesperado               | `forma_pagamento=NULL`                         |
| 004     | 103   | 10.18 codificação de caracteres             | `integrante=JoÃ£o Pedro Azevedo` (mojibake)    |
| 005     | 33    | 10.12 valor monetário formatado             | `valor_total=R$ 1.250,50` (esperado 1250.50)   |
| 005     | 47    | 10.15 e-mail inválido                       | `email=joao@` (formato inválido)               |
| 005     | 121   | 10.19 valor fora do contrato                | `status=SIM` (esperado CONCLUIDA/CANCELADA)    |
| —       | —     | 10.21 remessa fora da sequência             | gerar/enviar a 005 antes da 004                |

Cada erro é documentado em `logs/produtor/inconsistencias.log` com a linha do arquivo
e o motivo — relatório destinado ao professor (item 15.7), não ao grupo
consumidor. A distribuição pode ser ajustada no objeto `INJECOES` de
cada `server/produtor/csv-N.js`.

## Estrutura do projeto

```
sistema-vendas/
├── docs/
│   ├── Trabalho Prático – ... .pdf      # especificação do trabalho
│   ├── Modelo - Contrato de Integração CSV.docx  # contrato acordado (origem)
│   ├── CONTRATO-CLIENTES.md             # o mesmo contrato, transcrito
│   ├── CONTRATO-VENDAS.md               # contrato de saída (Vendas → Grupo 3)
│   ├── RELATORIO-TECNICO.md             # relatório técnico (entrega 19.7)
│   ├── entrega/                         # os 3 documentos em .docx (19.2 e 19.7)
│   │   ├── Contrato de Integracao CSV - Sistema de Clientes.docx
│   │   ├── Contrato de Integracao CSV - Sistema de Vendas.docx
│   │   └── Relatorio Tecnico - Integracao por Arquivos CSV.docx
│   └── clientes/                        # remessas recebidas do Grupo 1
│       ├── IntegraçãoCliente1.csv       # 200 registros cada
│       ├── IntegraçãoCliente2.csv
│       ├── IntegraçãoClientes3.csv      # com inconsistências
│       ├── IntegraçãoCliente4.csv
│       ├── IntegraçãoCliente5.csv
├── output/                              # entregas 19.3 a 19.6
│   ├── produtor/                        # vendas-NNN.csv gerados
│   └── consumidor/                      # relatorio-*.txt e rejeitados-*.csv
├── logs/
│   ├── produtor/
│   │   ├── remessa.log                  # controle de remessas enviadas
│   │   └── inconsistencias.log          # relatório p/ professor (item 15.7)
│   └── consumidor/
│       └── remessa-recebimento.log      # controle de remessas recebidas
├── server/
│   ├── index.js                # API Express (porta 3001)
│   ├── contrato.js             # contrato de saída (Vendas → Grupo 3)
│   ├── vendas.db               # banco SQLite do consumidor (item 18)
│   ├── produtor/
│   │   ├── dados.js            # gerador aleatório de vendas
│   │   ├── csv-1.js … csv-5.js # as 5 remessas
│   │   ├── injecoes.js         # inconsistências por linha do arquivo
│   │   ├── arquivos.js         # grava em output/produtor + arquivo substituto
│   │   └── remessa.js          # logs de remessa e de inconsistências
│   └── consumidor/
│       ├── contrato-clientes.js # contrato de entrada (Grupo 1 → Vendas)
│       ├── validador.js         # etapas 1–5 do item 11 do PDF
│       ├── banco.js             # SQLite: só os registros válidos entram
│       └── relatorio.js         # relatório, rejeitados.csv e log
└── src/
    ├── App.jsx                 # geração das remessas + validação de entrada
    ├── main.jsx
    └── index.css               # Tailwind
```

## Sistema Consumidor (Grupo 1 → Grupo 2)

Recebe o arquivo de clientes e aplica as 5 etapas do item 11 do PDF. O contrato
implementado está em `docs/CONTRATO-CLIENTES.md` (transcrição do
`Modelo - Contrato de Integração CSV.docx`): delimitador `;`, aspas duplas
envolvendo campos de texto, UTF-8, LF e as 6 colunas
`id_cliente;nome;email;data_nascimento;cidade;ativo`.

Na tela, em **Consumir**, escolha o arquivo e clique em **validar**; ou via API:

```bash
curl -X POST http://localhost:3001/api/validar \
  -H 'Content-Type: application/json' \
  -d "{\"nome_arquivo\":\"sistema_clientes-001.csv\",\"csv\":\"$(cat arquivo.csv)\"}"
```

Resultado com as 5 remessas recebidas do Grupo 1:

| Arquivo                   | Situação                  | Processados | Rejeitados | Motivo |
|---------------------------|---------------------------|-------------|------------|--------|
| `IntegraçãoCliente1.csv`  | **Rejeitado por inteiro** | 0           | 0          | delimitador vírgula onde o contrato fixa `;` |
| `IntegraçãoCliente2.csv`  | **Rejeitado por inteiro** | 0           | 0          | delimitador vírgula onde o contrato fixa `;` |
| `IntegraçãoClientes3.csv` | Não conforme              | 176         | 24         | cabeçalho incompleto; `;` não escapado na cidade; aspas fora de posição; datas com ano de 2 dígitos |
| `IntegraçãoCliente4.csv`  | Não conforme              | 154         | 46         | os mesmos da 3 + campos obrigatórios vazios e datas inválidas |
| `IntegraçãoCliente5.csv`  | **Rejeitado por inteiro** | 0           | 0          | cabeçalho com colunas trocadas (`cidade;ativo;idade;…`): impede o mapeamento campo↔coluna |

Base final: **176 clientes**. Três das cinco remessas não passaram da validação
estrutural; as outras duas entraram com processamento parcial. O arquivo 4
gravou 0 inseridos e 154 atualizados — os ids já existiam, vindos do arquivo 3,
e a chave primária transformou a repetição em atualização.

Como as remessas 1 e 2 foram recusadas, o arquivo 3 entra com a observação
"remessa fora da sequência" (trouxe a 3, esperava-se a 1) — o controle de
remessa registra o buraco na cadeia sem interromper o processamento.

**O consumidor não corrige registros.** Pelo item 11 do PDF, registro válido é
processado e registro inválido é rejeitado; a correção acontece fora, no ciclo
do item 21 (`rejeitados.csv` → correção → novo arquivo → reprocessamento). As
decisões de tratamento estão na seção 4 de `docs/CONTRATO-CLIENTES.md`.

## Observações

- Os CSV gerados ficam em `output/produtor/` e também são baixados pelo navegador.
- O relatório de processamento e o `rejeitados.csv` ficam em `output/consumidor/`.
- O banco (`server/vendas.db`) é criado na primeira validação; apague o arquivo
  para começar a integração do zero.
- Cada clique gera dados aleatórios novos (não há banco nem seed manual).
- O problema 10.21 é demonstrado gerando o CSV 5 antes do CSV 4.#   s i s t e m a s - v e n d a s  
 