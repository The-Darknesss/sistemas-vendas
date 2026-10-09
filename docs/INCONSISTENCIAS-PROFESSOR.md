# Inconsistências Inseridas — Sistema de Vendas (Grupo 2)

Documento **destinado ao professor**. Não deve ser disponibilizado ao grupo
consumidor antes da execução da integração (item 15.7).

As remessas `vendas-001.csv` e `vendas-002.csv` são válidas, 100% conformes ao
contrato. As inconsistências foram inseridas entre registros válidos nas
remessas 3, 4 e 5. A numeração de linha é a do arquivo (o cabeçalho é a linha 1).

## Remessa 3 — `vendas-003.csv`

| Linha | Problema | O que foi inserido |
|---|---|---|
| 6  | 10.11 Valor numérico em formato diferente | `valor_unitario=1250,50` (vírgula em vez de ponto) |
| 41 | 10.16 Espaços indevidos | Espaços em volta do delimitador (`" ; "`) |
| 65 | 10.13 Registro duplicado | `id_venda` repetido (mesma chave da linha 2) |

## Remessa 4 — `vendas-004.csv`

| Linha | Problema | O que foi inserido |
|---|---|---|
| 15  | 10.14 Tipo de dado inválido | `data_venda=ABC` |
| 78  | 10.17 Linha em branco | Linha em branco entre registros |
| 92  | 10.20 Valor nulo / representação inesperada | `forma_pagamento=NULL` |
| 103 | 10.18 Codificação de caracteres | `integrante=JoÃ£o Pedro Azevedo` (mojibake) |

## Remessa 5 — `vendas-005.csv`

| Linha | Problema | O que foi inserido |
|---|---|---|
| 33  | 10.12 Valor monetário formatado | `valor_total=R$ 1.250,50` (contrato espera `1250.50`) |
| 47  | 10.15 E-mail inválido | `email=joao@` |
| 121 | 10.19 Valor booleano diferente do contrato | `status=SIM` (contrato espera `CONCLUIDA`/`CANCELADA`) |

## Remessa fora de sequência

**10.21** — reproduzida enviando a remessa 5 **antes** da 4. O `.ctl` de cada
arquivo traz a `sequencia`, então o consumidor consegue detectar a inversão.

## Arquivo de substituição

`vendas-005-substituto.csv` (com `vendas-005-substituto.ctl`, `tipo=SUBSTITUICAO`)
é a versão **corrigida** da remessa 5, sem nenhuma inconsistência. Ele é enviado
se o consumidor rejeitar a remessa original por inteiro.

O registro gerado automaticamente a cada execução, com data/hora e UUID da
remessa, fica em `logs/produtor/inconsistencias.log`.
