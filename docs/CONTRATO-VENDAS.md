# Contrato de Integração CSV — Sistema de Vendas

Contrato do arquivo que o **Grupo 2 (Sistema de Vendas)** produz e entrega ao
grupo seguinte da cadeia. Segue a mesma estrutura do contrato de entrada
(`CONTRATO-CLIENTES.md`) e atende ao item 7 do trabalho.

Implementado em `server/contrato.js` e nos geradores `server/produtor/csv-*.js`.

## 1. Identificação

| Item                | Valor                                                    |
|---------------------|----------------------------------------------------------|
| Nome do arquivo     | `vendas-NNN.csv`, onde `NNN` é a sequência da remessa     |
| Extensão            | `.csv`                                                    |
| Finalidade          | Exportar as vendas realizadas para o sistema consumidor    |
| Sistema produtor    | Sistema de Vendas (Grupo 2)                               |
| Sistema consumidor  | Sistema de Produtos (Grupo 3)                             |
| Arquivo de controle | `vendas-NNN.ctl`, enviado junto com cada CSV (seção 4)    |
| Arquivo substituto  | `vendas-NNN-substituto.csv` + `vendas-NNN-substituto.ctl` (item 15.8) |

## 2. Estrutura do arquivo

| Parâmetro             | Especificação                                            |
|-----------------------|-----------------------------------------------------------|
| Cabeçalho             | Presente na primeira linha, com os nomes da seção 3       |
| Delimitador de campos | Ponto e vírgula (`;`)                                     |
| Caractere de aspas    | Aspas duplas (`"`), **apenas** quando o valor contém `;`, `"` ou quebra de linha; aspas internas são duplicadas (`""`) |
| Codificação           | UTF-8, sem BOM                                            |
| Quebra de linha       | LF — Line Feed (`\n`)                                     |
| Ordem das colunas     | Fixa, conforme a seção 3                                  |
| Linhas de dados       | Mínimo 177 (a geração produz 220), conforme o item 8      |

## 3. Especificação dos campos

| #  | Campo             | Tipo    | Tamanho | Obrigatório | Formato                    | Regra de validação                                    | Exemplo                    |
|----|-------------------|---------|---------|-------------|----------------------------|--------------------------------------------------------|----------------------------|
| 1  | `id_venda`        | Inteiro | —       | Sim         | Numérico sequencial        | Chave primária única no arquivo, maior que zero        | `1042`                     |
| 2  | `id_cliente`      | Inteiro | —       | Sim         | Numérico                   | Maior que zero                                         | `102`                      |
| 3  | `id_produto`      | Inteiro | —       | Sim         | Numérico                   | Maior que zero                                         | `305`                      |
| 4  | `quantidade`      | Inteiro | —       | Sim         | Numérico                   | Entre 1 e 999                                          | `3`                        |
| 5  | `valor_unitario`  | Decimal | 9999.99 | Sim         | Ponto decimal, 2 casas     | Maior que zero e ≤ `9999.99`; **sem** símbolo de moeda e sem separador de milhar | `149.90`      |
| 6  | `valor_total`     | Decimal | 99999.99 | Sim        | Ponto decimal, 2 casas     | Igual a `quantidade × valor_unitario`, com 2 casas; ≤ `99999.99` | `449.70`                   |
| 7  | `data_venda`      | Data    | 10      | Sim         | `DD/MM/YYYY`               | Data válida no calendário gregoriano                   | `12/03/2026`               |
| 8  | `forma_pagamento` | Texto   | 7       | Sim         | Lista fechada              | Apenas `PIX`, `CARTAO` ou `BOLETO`                     | `PIX`                      |
| 9  | `status`          | Texto   | 9       | Sim         | Lista fechada              | Apenas `CONCLUIDA` ou `CANCELADA`                      | `CONCLUIDA`                |
| 10 | `integrante`      | Texto   | máx 100 | Sim         | String                     | Nome de um integrante do Grupo 2; sem caracteres proibidos | `Paulo Eduardo`        |
| 11 | `email`           | Texto   | máx 100 | Sim         | E-mail padrão              | Padrão `usuario@dominio.com`, coerente com `integrante` | `paulo.eduardo@grupo2.com` |

**Caracteres especiais proibidos** em campos de texto que não venham entre
aspas: o delimitador (`;`), o caractere de aspas (`"`), quebras de linha e
caracteres de controle.

**Por que `valor_total` é maior que `valor_unitario`.** O total é o produto da
quantidade (até 999 por contrato, até 10 na geração) pelo valor unitário (até
`9999.99`), então declarar os dois com o mesmo tamanho deixaria o próprio
arquivo válido fora do contrato — um item de `4499.90` vendido 10 vezes já dá
`44999.00`. O consumidor deve dimensionar o campo para 8 dígitos com 2 casas.

Exemplo de arquivo:

```
id_venda;id_cliente;id_produto;quantidade;valor_unitario;valor_total;data_venda;forma_pagamento;status;integrante;email
1;116;314;10;899.90;8999.00;26/08/2026;PIX;CONCLUIDA;Joao Pedro Azevedo;joao.pedro@grupo2.com
2;103;302;2;89.90;179.80;14/01/2026;BOLETO;CANCELADA;Hyago Fernandes;hyago.fernandes@grupo2.com
```

## 4. Controle de remessa

Cada CSV é entregue acompanhado de um **arquivo de controle** com o mesmo nome e
extensão `.ctl` (ex.: `vendas-001.csv` → `vendas-001.ctl`). O `.ctl` segue a
mesma estrutura do CSV (cabeçalho, `;`, UTF-8, LF) e tem uma única linha de dados:

| # | Campo       | Tipo    | Formato                     | Regra de validação                                           | Exemplo |
|---|-------------|---------|-----------------------------|---------------------------------------------------------------|---------|
| 1 | `arquivo`   | Texto   | Nome do CSV                 | Igual ao nome do CSV recebido                                  | `vendas-001.csv` |
| 2 | `sequencia` | Inteiro | Numérico                    | Igual ao `NNN` do nome; crescente, sem lacunas                 | `1` |
| 3 | `tipo`      | Texto   | Lista fechada               | `NORMAL` ou `SUBSTITUICAO`                                     | `NORMAL` |
| 4 | `remessa`   | Texto   | UUID                        | Identificador único do envio                                   | `745e9abd-3eb5-4c97-a450-5736f69f554f` |
| 5 | `data_hora` | Data/hora | `AAAA-MM-DD HH:MM:SS` (UTC) | Data e hora da geração                                        | `2026-09-17 22:26:35` |
| 6 | `registros` | Inteiro | Numérico                    | Quantidade de linhas de dados do CSV (sem cabeçalho e sem linhas em branco) | `220` |
| 7 | `sha256`    | Texto   | 64 caracteres hexadecimais  | SHA-256 dos bytes do CSV                                       | `9e05d367…` |

Exemplo:

```
arquivo;sequencia;tipo;remessa;data_hora;registros;sha256
vendas-001.csv;1;NORMAL;745e9abd-3eb5-4c97-a450-5736f69f554f;2026-09-17 22:26:35;220;9e05d367941d80f3100f6a7d7a4c925e3e9003dda4696fd5e5e44a11fc98bb18
```

**Conferência pelo consumidor (controle de recebimento):**

- `sequencia` fora de ordem ou com lacuna → registrar no controle de recebimento
  e informar o produtor;
- `sha256` diferente do calculado sobre o CSV recebido → o arquivo foi alterado
  ou truncado no caminho: **rejeitar o arquivo inteiro** e pedir reenvio;
- CSV sem `.ctl` correspondente → registrar a ausência do controle.

O produtor também mantém o histórico dos envios em `logs/produtor/remessa.log`:

```
[AAAA-MM-DD HH:MM:SS] arquivo=vendas-001.csv registros=220 remessa=<UUID> sequencia=1 sha256=<hash>
```

## 5. Rejeição do arquivo inteiro e arquivo substituto

O consumidor deve rejeitar **o arquivo inteiro**, em vez de linhas isoladas,
quando o defeito impede interpretar qualquer registro com segurança:

- delimitador diferente de `;` — nenhum campo pode ser separado;
- cabeçalho ausente, com colunas desconhecidas ou fora da ordem — não há como
  saber qual valor pertence a qual campo;
- arquivo vazio ou sem registros;
- codificação ilegível ou falha de leitura do arquivo como um todo;
- `sha256` do `.ctl` não confere com o CSV recebido.

Os demais problemas (campo inválido, valor fora do formato, duplicidade, linha
em branco etc.) afetam só o registro: a linha vai para o arquivo de rejeitados e
o restante do lote é processado.

Quando uma remessa é rejeitada por inteiro, o produtor envia um **arquivo de
substituição** com a mesma sequência: `vendas-NNN-substituto.csv`, corrigido e
acompanhado de `vendas-NNN-substituto.ctl` com `tipo=SUBSTITUICAO`.
