# Relatório Técnico — Integração por Arquivos CSV

**Grupo 2 — Sistema de Vendas**
Paulo Eduardo · Joao Pedro Azevedo · Hyago Fernandes

Atende à entrega 19.7 do trabalho: explica a solução desenvolvida, as decisões
técnicas e responde às questões do item 22.

---

## 1. Papéis do grupo na cadeia

| Papel | Contrato | Origem/destino |
|---|---|---|
| **Consumidor** | `docs/CONTRATO-CLIENTES.md` | recebe `sistema_clientes.csv` do **Grupo 1** |
| **Produtor** | `docs/CONTRATO-VENDAS.md` | entrega `vendas-NNN.csv` ao **Grupo 3** |

Os dois lados foram desenvolvidos de forma independente e só se comunicam por
arquivo, sem chamada de função, banco compartilhado ou API entre os grupos
(Regra 1 do item 24).

## 2. Arquitetura

```
SISTEMA PRODUTOR (server/produtor/)
  dados.js          gera as vendas
  injecoes.js       insere as inconsistências pela linha real do arquivo
  csv-1..csv-5.js   monta cada remessa
  arquivos.js       grava o CSV e o .ctl em output/produtor/
  remessa.js        logs/produtor/remessa.log + inconsistencias.log
        |
        | arquivo CSV + arquivo de controle
        v
ÁREA DE TRANSFERÊNCIA (output/produtor/vendas-NNN.csv + vendas-NNN.ctl)
        |
        v
SISTEMA CONSUMIDOR (server/consumidor/)
  validador.js          etapas 1 a 5 do item 11
  contrato-clientes.js  regras do contrato de entrada
  banco.js              SQLite: só os válidos entram
  relatorio.js          relatório, rejeitados.csv e log de recebimento
        |
        +--> válidos   -> banco de dados (server/vendas.db)
        +--> inválidos -> output/consumidor/rejeitados-*.csv
```

**Stack:** Node.js 24 + Express no backend, React 19 + Vite + Tailwind na
interface, `csv-stringify` para escrever, `csv-parse` para ler e `node:sqlite`
(nativo, sem dependência externa) para persistir.

## 3. As cinco explicações exigidas pelo item 17

### 3.1 Como o arquivo é lido

O conteúdo chega inteiro em memória e é entregue ao `csv-parse` em modo
*stream*, em `lerRegistros()` (`server/consumidor/validador.js`). O parser
devolve cada linha como um vetor de campos junto de `info.lines`, que guarda o
**número real da linha no arquivo** — é esse número que aparece no relatório e
no arquivo de rejeitados, e não o índice do registro, para que a pessoa
consiga abrir o CSV e ir direto na linha com problema.

As opções de leitura são deliberadamente tolerantes, porque o objetivo é que
nenhum defeito de uma linha derrube o arquivo inteiro:

| Opção | Efeito |
|---|---|
| `relax_quotes: true` | uma aspa aberta e não fechada vira texto comum em vez de abortar a leitura |
| `relax_column_count: true` | linhas com 5 ou 7 campos chegam inteiras e são rejeitadas individualmente |
| `skip_empty_lines: false` | a linha em branco chega como registro vazio e é rejeitada com motivo próprio (10.17) |
| `record_delimiter: ['\n', '\r\n']` | aceita LF (contrato) e CRLF (desvio tolerado) |
| `bom: true` | descarta o BOM que alguns editores do Windows inserem |

Esse foi o ponto mais importante da implementação. Na primeira versão, o
`csv-parse` operava em modo estrito e um único campo com aspas fora de posição
(`Camila "Reis`, linha 142 do arquivo 3) lançava exceção e **descartava os 200
registros**, incluindo os 177 íntegros — exatamente o que o item 14 proíbe.

### 3.2 Como o delimitador é identificado

O delimitador **não** é adivinhado: está fixado no contrato (`;`) e declarado
em `ESTRUTURA.delimitador`. Antes de qualquer leitura, a primeira linha é
inspecionada; se não contiver `;`, o arquivo é rejeitado por inteiro e outra
remessa é solicitada.

Foi o caso das remessas 1 e 2 recebidas do Grupo 1, que vieram separadas por
vírgula. Detectar automaticamente o delimitador seria tecnicamente simples,
mas aceitaria em silêncio um arquivo fora do contrato — e o combinado deixaria
de valer na prática. A escolha foi rejeitar, avisar e pedir o arquivo correto.

### 3.3 Como campos entre aspas são tratados

Pelo contrato, aspas duplas envolvem campos de texto e aspas internas são
duplicadas (`""`). O `csv-parse` remove as aspas externas e desdobra as
internas automaticamente.

Dois casos fogem disso e foram tratados à mão:

- **Aspa no meio do valor** (`Camila "Reis`): com `relax_quotes` ela permanece
  como texto; a validação então barra o registro por "caracteres especiais
  proibidos", que é o comportamento correto — o dado está ambíguo.
- **Espaço antes da aspa** (` ; "Joao" ; `, o problema 10.16): a aspa deixa de
  estar no início do campo, então o parser a trata como texto comum e o valor
  chega como `"Joao"`, com as aspas grudadas. O registro é rejeitado com dois
  motivos próprios — "Espacos indevidos em volta do delimitador" e "Aspas
  residuais no valor" —, em vez de uma mensagem genérica sobre caracteres
  proibidos.

  Esse caso obrigou uma distinção que não é óbvia. `"Iury Rodrigues "` tem um
  espaço sobrando, mas ele está **dentro** das aspas: as aspas delimitam o valor,
  então o espaço é parte do dado e o contrato o permite. Já em
  `10 ; Joao Silva ; joao@...` o espaço está **em volta** do delimitador, fora de
  qualquer aspas — aí é o 10.16, e todo valor da linha chega sujo. Os dois casos
  são indistinguíveis depois que o parser termina, porque ele já removeu as
  aspas; por isso o teste é feito na **linha crua**, com os trechos citados
  mascarados antes (`temEspacosNaEstrutura`, em `contrato-clientes.js`).

### 3.4 Como os dados são convertidos

**Nada é convertido antes da validação.** O registro é validado exatamente como
veio do arquivo; se algum campo estiver fora do contrato — inclusive por um
espaço sobrando —, o registro é rejeitado, não ajustado.

A conversão só acontece **depois** da aprovação, na gravação: `id_cliente` vira
`Number` e `email` é padronizado para minúsculas, porque a unicidade exigida
pelo contrato não pode depender da caixa das letras. `data_nascimento` permanece
como texto `DD/MM/YYYY`: converter para `Date` exigiria decidir fuso horário, e
isso não está no contrato.

A única tolerância é de leitura, não de dado: o arquivo com quebra de linha
`CRLF` é lido normalmente e o desvio aparece no relatório. As remessas 3, 4 e 5
chegaram assim; rejeitá-las por causa de um caractere invisível inviabilizaria a
integração inteira.

### 3.5 Como os erros são identificados e como os inválidos são armazenados

A validação é dividida em dois níveis, espelhando as Etapas 2 e 3 do item 11:

**Estrutural** — arquivo vazio, delimitador errado, arquivo ilegível ou
cabeçalho que impeça o mapeamento campo↔coluna. Rejeita o arquivo inteiro,
registra o motivo no log de recebimento, grava `relatorio-<arquivo>.txt` com o
erro de estrutura e o tratamento aplicado (nova remessa solicitada) e devolve
HTTP 400.

**Por registro** — `validarRegistro()` acumula **todos** os motivos de cada
linha em vez de parar no primeiro, então o relatório mostra de uma vez tudo o
que está errado naquele registro.

Os inválidos nunca entram no banco. Vão para
`output/consumidor/rejeitados-<arquivo>.csv`, no formato do item 13:

```
linha;motivo;dados
3;Espacos indevidos em volta do delimitador;"2;Iury Rodrigues ;iury.rodrigues@gmail.com;22/07/2000;Goiânia;S"
4;Quantidade de campos invalida (esperado 6, recebido 7);"3;Alexandry Vieira;...;Aparecida de ; Goiânia;S"
7;Formato de data nao permitido (esperado DD/MM/YYYY);"6;Claudia Fernandes;...;07/08/79;Rio de Janeiro;S"
```

A linha original vai preservada, entre aspas, para que o registro possa ser
corrigido e reenviado sem precisar voltar ao arquivo de origem. No relatório de
processamento, cada erro vem acompanhado do tratamento aplicado ("registro
rejeitado, não gravado no banco e enviado para rejeitados-<arquivo>.csv").

### 3.6 Controle de remessa e arquivo de substituição

**Envio.** Cada CSV sai com um arquivo de controle `vendas-NNN.ctl` (contrato,
seção 4) contendo arquivo, sequência, tipo (`NORMAL`/`SUBSTITUICAO`), UUID da
remessa, data/hora, quantidade de registros e o SHA-256 do CSV. O controle vai
**junto com o arquivo**, e não só num log interno, porque quem precisa conferir
é o consumidor: com ele o Grupo 3 detecta remessa fora de ordem, arquivo
truncado (quantidade não bate) ou alterado no caminho (hash não bate). O mesmo
registro fica no histórico `logs/produtor/remessa.log`.

**Recebimento.** O consumidor extrai a sequência de cada remessa recebida,
compara com a última registrada em `logs/consumidor/remessa-recebimento.log` e
aponta no relatório a remessa fora de ordem (seção 5.3).

**Substituição (item 15.8).** Quando o consumidor rejeita uma remessa por
inteiro, o produtor gera `vendas-NNN-substituto.csv` com a mesma sequência,
**corrigido** — as inconsistências não são reinseridas — e com `.ctl` do tipo
`SUBSTITUICAO`. O nome próprio evita sobrescrever a remessa original, que
continua registrada no histórico.

## 4. Banco de dados (item 18)

SQLite via `node:sqlite`. Duas tabelas: `clientes` (o cadastro integrado) e
`remessas` (o histórico de cada recebimento).

A chave é `id_cliente`, definido como chave primária pelo contrato. A gravação
usa `INSERT ... ON CONFLICT(id_cliente) DO UPDATE`, então uma remessa posterior
com o mesmo id **atualiza** o cadastro em vez de duplicá-lo. É isso que
sustenta o reprocessamento do item 21. O `email` tem restrição `UNIQUE`: um id
novo reaproveitando o e-mail de outro cliente não entra, e o conflito é
reportado.

## 5. Resultados da integração

Recebemos 5 remessas do Grupo 1 e processamos as cinco, na ordem, a partir de um
banco vazio. O resultado está em `output/consumidor/` e em
`logs/consumidor/remessa-recebimento.log`:

| Arquivo | Situação | Total | Processados | Rejeitados |
|---|---|---|---|---|
| `IntegraçãoCliente1.csv` | **Rejeitado por inteiro** — delimitador | — | 0 | 0 |
| `IntegraçãoCliente2.csv` | **Rejeitado por inteiro** — delimitador | — | 0 | 0 |
| `IntegraçãoClientes3.csv` | Não conforme | 200 | 176 | 24 |
| `IntegraçãoCliente4.csv` | Não conforme | 200 | 154 | 46 |
| `IntegraçãoCliente5.csv` | **Rejeitado por inteiro** — cabeçalho | — | 0 | 0 |

**Base final: 176 clientes.** Dos 5 arquivos recebidos, 3 foram recusados
inteiros na validação estrutural e 2 entraram com processamento parcial.

### 5.1 Os três arquivos recusados por inteiro

**Remessas 1 e 2 — delimitador.** Vieram separadas por **vírgula**, e o contrato
fixa `;`. A primeira linha é inspecionada antes de qualquer leitura: sem o
delimitador acordado não existe "campo", tudo vira uma coluna só, e validar
qualquer coisa depois seria validar um dado que não foi realmente lido. Os dois
arquivos foram recusados na Etapa 2 e uma nova remessa, solicitada. O log
registra o motivo (`ERRO=delimitador_invalido`), e o relatório de cada um está em
`output/consumidor/relatorio-IntegraçãoCliente1.txt` e `...Cliente2.txt`.

**Remessa 5 — cabeçalho.** Veio como
`cidade;ativo;idade;id_cliente;nome;data_nascimento`: tem uma coluna que não
existe no contrato (`idade`), não tem `email`, e as demais estão fora de ordem.
Sem saber qual coluna é qual, qualquer processamento seria adivinhação
(`ERRO=cabecalho_invalido`).

### 5.2 Os dois arquivos processados parcialmente

Os arquivos 3 e 4 têm o cabeçalho **truncado**
(`id_cliente;nome;email;data_nascimento` — faltam `cidade` e `ativo`), mas as
colunas presentes seguem a ordem do contrato. Como essa ordem é fixa, os
registros continuam interpretáveis pela posição: o arquivo é marcado como não
conforme, a falha entra no relatório, e o processamento segue. É a diferença
prática entre um cabeçalho **incompleto** e um cabeçalho **impossível de
mapear**, que é o caso da remessa 5.

Motivos das rejeições, como saíram no relatório de processamento:

| Motivo | Arquivo 3 | Arquivo 4 |
|---|---|---|
| Formato de data não permitido (ano com 2 dígitos) | 8 | 15 |
| Quantidade de campos inválida — 7 campos (`;` não escapado na cidade) | 7 | 8 |
| Quantidade de campos inválida — 5 campos | 6 | 6 |
| Data inválida (dia/mês que não existem) | — | 8 |
| `nome` contém caracteres especiais proibidos | 2 | 2 |
| Espaços indevidos em volta do delimitador | 1 | 1 |
| Campo obrigatório vazio (`id_cliente`, `nome`, `email`, `data_nascimento`, `cidade`, `ativo`) | — | 6 |
| **Total de linhas rejeitadas** | **24** | **46** |

### 5.3 O que a persistência mostrou

Duas coisas só apareceram porque os registros válidos vão para o banco:

**A segunda remessa atualizou, não duplicou.** O arquivo 4 gravou **0 inseridos
e 154 atualizados**: todos os seus registros válidos tinham `id_cliente` que já
existia na base, vindo do arquivo 3. Como o `id_cliente` é chave primária pelo
contrato, a gravação usa `INSERT ... ON CONFLICT DO UPDATE` e a repetição entre
remessas vira atualização do cadastro. Sem o banco, os mesmos 154 clientes
entrariam duas vezes.

**O controle de remessa acusou a lacuna.** O arquivo 3 entrou com a observação
*"Remessa fora da sequência: traz a sequência 3, mas a esperada era 1"* — porque
as remessas 1 e 2 foram recusadas e nunca registraram recebimento. O consumidor
não interrompe o processamento por isso, mas deixa registrado que há um buraco
na cadeia, que é exatamente o problema 10.21.

**Um conflito que nenhum arquivo isolado revela.** Em um teste feito à parte,
realinhando as remessas 1 e 2 para `;` só para enxergar o conteúdo delas, o
cliente "Henrique Ribeiro" (`henrique.ribeiro@gmail.com`) aparece como
`id_cliente` 60 na remessa 1 e como `id_cliente` 7 na remessa 2, com data de
nascimento e cidade diferentes. Cada arquivo, sozinho, respeita o contrato: a
contradição só existe quando os dois são integrados na mesma base, e é a
restrição `UNIQUE` do e-mail que a detecta. Esse teste não faz parte da
integração entregue — os arquivos como foram recebidos estão fora do contrato e
foram recusados.

## 6. Respostas às questões do item 22

**1. Quais foram os principais problemas encontrados durante a integração?**

Os problemas graves foram **estruturais, não de dado** — e é isso que explica o
resultado: 3 das 5 remessas não puderam sequer ser lidas. Duas vieram com
delimitador vírgula onde o contrato pedia `;`, e uma veio com o cabeçalho
embaralhado e uma coluna inexistente. Nenhuma linha dessas três chegou a ser
validada.

Do lado dos registros, em uma única linha uma aspa fora de posição
(`Camila "Reis`) derrubava a leitura das outras 199 até tornarmos o leitor
tolerante. Depois disso: o cabeçalho truncado nos arquivos 3 e 4; o `;` não
escapado dentro de nomes de cidade (`Aparecida de ; Goiânia`), que desloca todos
os campos seguintes; e datas com ano de 2 dígitos (`10/11/01`), em que não há
como saber se é 1901 ou 2001 — sozinhas, 23 das 70 rejeições.

**2. Quais problemas poderiam ter sido evitados com um contrato mais detalhado?**

Quase todos os de formatação. O contrato dizia "aspas duplas para envolver
campos de texto", mas não dizia se era obrigatório ou opcional, nem o que fazer
com aspas dentro do valor — e foi exatamente aí que os arquivos divergiram. Um
contrato completo precisaria fixar: obrigatoriedade das aspas, escape de aspas
internas (`""`), ano com 4 dígitos, tratamento de espaços, representação de
nulo, e um exemplo de arquivo completo. Faltou também combinar quem avisa quem
quando uma remessa é rejeitada.

O nosso contrato de saída tinha o mesmo tipo de falha, e ela só apareceu quando
conferimos o arquivo gerado contra o texto que nós mesmos escrevemos:
`valor_total` estava declarado com tamanho `9999.99`, o mesmo de
`valor_unitario`, mas o total é o produto da quantidade pelo unitário — um item
de `4499.90` vendido 10 vezes dá `44999.00`, e 36 das 220 linhas do arquivo
"válido" estouravam o tamanho do próprio contrato. O campo foi redimensionado
para `99999.99`. A lição é a do item 26: o contrato só vale se alguém verificar
o arquivo contra ele — inclusive o lado que o produz.

**3. O sistema consumidor deve aceitar automaticamente formatos diferentes daqueles definidos no contrato?**

Não. Aceitar em silêncio faz o contrato perder o valor: cada lado passa a
programar contra o comportamento observado do outro, e a integração quebra na
próxima mudança. Nossa política tem dois níveis, os mesmos do item 11: o
registro fora do contrato é **rejeitado** com o motivo no relatório; o defeito
que impede interpretar o arquivo derruba a **remessa inteira**. A única
tolerância é de leitura — `CRLF` em vez de `LF` e o nome do arquivo —, e mesmo
essas aparecem no relatório como desvio. Nada é aceito em silêncio.

**4. Quando é melhor rejeitar um registro e quando é melhor tentar corrigi-lo automaticamente?**

Nós optamos por **sempre rejeitar**, e essa foi uma decisão consciente.

O argumento a favor de corrigir é tentador: `" Maria "` só pode virar `Maria`,
não há ambiguidade nenhuma. Chegamos a implementar assim. O problema apareceu
no relatório: com o `trim` automático, o problema **10.16 (espaços indevidos)**
simplesmente sumia da lista de erros. Quem lesse o relatório concluiria que o
arquivo não tinha aquele defeito — e o Grupo 1, que o produziu, nunca ficaria
sabendo que precisa corrigir a exportação.

É aí que está a diferença entre um programa que lê CSV e uma integração: a
correção silenciosa resolve o sintoma de hoje e perpetua a causa. O PDF aponta
para o mesmo lugar — o item 11 só conhece "processado" e "rejeitado", e o item
13 guarda os rejeitados para que sejam *"posteriormente corrigidos e
processados novamente"*, no ciclo do item 21. A correção existe, mas fora do
consumidor, e com o produtor sabendo dela.

Onde corrigir automaticamente faria sentido: num sistema em produção, com
volume alto e um defeito conhecido, recorrente e já comunicado ao produtor, em
que parar a operação custa mais do que o dado imperfeito. Ainda assim a
correção teria que ser contada e reportada em separado — nunca invisível.

**5. O que deveria acontecer se o arquivo inteiro estiver utilizando um delimitador diferente do especificado no contrato?**

Rejeição total e pedido de nova remessa, que foi o que fizemos com os arquivos
1 e 2. Sem o delimitador acordado não existe "campo": tudo vira uma coluna só,
e qualquer validação seguinte seria sobre um dado que não foi realmente lido.
Detectar o delimitador automaticamente é fácil, mas transformaria o contrato em
sugestão.

**6. Como o sistema poderia evitar a duplicação de registros?**

Em duas camadas. Durante a leitura, os conjuntos `vistos.ids` e `vistos.emails`
detectam repetição **dentro** do arquivo — e a ocorrência é registrada mesmo
quando a linha foi rejeitada por outro motivo, senão uma cópia posterior
passaria batida. No banco, `id_cliente` é chave primária e `email` é `UNIQUE`,
então a repetição **entre** remessas vira atualização do cadastro, não um
segundo cliente. Sem o banco, essa segunda camada não existiria.

**7. Quais problemas poderiam ocorrer se o produtor e o consumidor utilizassem sistemas operacionais ou configurações regionais diferentes?**

Foi o que aconteceu de fato, duas vezes. As remessas 3, 4 e 5 vieram com CRLF
(Windows) onde o contrato pedia LF — se o parser não tratasse, o último campo de
cada linha viria como `S\r` e **todo** registro seria rejeitado por "ativo
inválido". E as remessas 1 e 2 vieram separadas por vírgula, provavelmente
exportadas por uma ferramenta configurada em outro padrão regional: essas duas
não tiveram conserto, foram recusadas por inteiro. Além desses: a vírgula
decimal do pt-BR (`1250,50`) contra o ponto do
contrato, que é justamente o problema 10.11; a data `MM/DD/YYYY` do en-US
contra `DD/MM/YYYY`; e UTF-8 lido como Latin-1, que produz o `JoÃ£o` do
problema 10.18.

**8. Quais são as principais vantagens da utilização de CSV para integração?**

Simplicidade e independência: qualquer linguagem lê e escreve, sem biblioteca
específica nem acoplamento entre as tecnologias dos dois lados. É legível por
pessoas, o que torna a depuração direta — dá para abrir o arquivo e ver a linha
com problema. Funciona bem em lote e com volume grande, o produtor não precisa
estar no ar quando o consumidor processa, e o arquivo é auditável: fica gravado
como evidência do que foi enviado.

**9. Quais são as principais limitações dessa abordagem?**

Não há tipagem nem esquema: tudo é texto, e o significado depende de um acordo
externo ao arquivo. Não representa dados hierárquicos. Não existe padrão único
— delimitador, aspas, encoding e quebra de linha variam, e é daí que vem a
maior parte dos problemas que enfrentamos. É assíncrono por natureza, então não
serve para operação em tempo real, e não tem validação na origem: o erro só
aparece do lado do consumidor, quando o produtor já seguiu adiante. Também não
há transação: metade do arquivo pode ser processada e a outra metade não.

**10. Em que situações uma API ou um sistema de mensageria poderia ser mais adequado que a transferência de arquivos CSV?**

API quando a resposta precisa ser imediata e a validação tem que acontecer na
origem — um cadastro de cliente que precisa ser confirmado na hora, com o erro
voltando para quem digitou. Mensageria quando o volume é contínuo em vez de em
lote, quando é preciso garantir entrega e reprocessamento automático, ou quando
vários sistemas consomem o mesmo evento. O CSV continua sendo a escolha certa
para carga em lote, integração com sistemas legados, grandes volumes fora do
horário de pico e quando o arquivo precisa ficar arquivado como comprovante.

## 7. Conceitos de integração observados (item 25)

Onde cada conceito exigido pelo enunciado aparece na implementação.

| Conceito | Onde aparece |
|---|---|
| Integração por transferência de arquivos | O único canal entre os grupos é o CSV. Nenhuma chamada de função, API ou banco compartilhado atravessa a fronteira |
| Sistema produtor | `server/produtor/` — gera as 5 remessas de `vendas-NNN.csv` |
| Sistema consumidor | `server/consumidor/` — recebe o arquivo do Grupo 1 |
| Controle de envio e recebimento de remessa | Arquivo de controle `vendas-NNN.ctl` (sequência, UUID, data/hora, registros, SHA-256) enviado com cada CSV; histórico em `logs/produtor/remessa.log` e `logs/consumidor/remessa-recebimento.log`; a sequência fora de ordem é apontada no relatório |
| Contrato de integração | `docs/CONTRATO-VENDAS.md` (saída) e `docs/CONTRATO-CLIENTES.md` (entrada), este último implementado campo a campo em `contrato-clientes.js` |
| **Interoperabilidade** | Ver abaixo |
| Formato de dados | Tipos, tamanhos e formatos fixados na seção 3 de cada contrato: `DD/MM/YYYY`, decimal com ponto, `S`/`N` |
| Delimitadores | `;` fixado no contrato e nunca adivinhado; arquivo com outro delimitador é recusado por inteiro |
| Codificação | UTF-8 acordado; mojibake (`JoÃ£o`) é detectado e o registro rejeitado |
| Validação | Dois níveis: estrutural (arquivo) e por registro, acumulando todos os motivos |
| Transformação de dados | Só depois da aprovação: `id_cliente` para inteiro, `email` padronizado em minúsculas para a comparação de unicidade |
| Tratamento de erros | Cada motivo vai para o relatório com o número real da linha; nenhum erro interrompe o lote |
| Registros rejeitados | `output/consumidor/rejeitados-*.csv`, no formato `linha;motivo;dados` do item 13 |
| Processamento parcial | 176 de 200 processados na remessa 3, 154 de 200 na remessa 4 |
| Duplicidade | Dentro do arquivo, pelos conjuntos `vistos.ids`/`vistos.emails`; entre remessas, pela chave primária e pelo `UNIQUE` do e-mail no banco |
| Reprocessamento | `POST /api/validar` com `reprocessamento: true` — o registro corrigido atualiza o cadastro em vez de duplicá-lo |
| Confiabilidade da integração | Nada é aceito em silêncio: correção automática foi deliberadamente removida, e todo desvio aparece no relatório |

### Interoperabilidade

É o conceito que mais apareceu na prática, e sempre pelo mesmo motivo: os dois
lados foram escritos por equipes diferentes, em máquinas diferentes, e cada
ferramenta tem um padrão próprio que ninguém combinou.

- **Quebra de linha** — as remessas 3, 4 e 5 chegaram com `CRLF` (Windows) onde
  o contrato pedia `LF`. Se o leitor não tratasse, o último campo de cada linha
  viria como `S\r` e **todos os 200 registros** seriam rejeitados por "ativo
  inválido". Um caractere invisível derrubaria a integração inteira.
- **Delimitador** — as remessas 1 e 2 vieram separadas por vírgula. Provável
  exportação por uma ferramenta configurada em outro padrão regional. Foi o
  desvio mais caro: duas das cinco remessas perdidas por inteiro.
- **Separador decimal** — a vírgula do pt-BR (`1250,50`) contra o ponto do
  contrato é exatamente o problema 10.11; `R$ 1.250,50` (10.12) é a mesma
  origem, agravada pela formatação de moeda.
- **Formato de data** — `MM/DD/YYYY` do en-US contra `DD/MM/YYYY` do contrato, e
  o ano de 2 dígitos (`10/11/01`), que é irrecuperável: não há como saber se é
  1901 ou 2001.
- **Codificação** — UTF-8 lido como Latin-1 produz o `JoÃ£o` do problema 10.18.

A lição: nenhum desses é erro de programação. São dois sistemas corretos, cada
um no seu padrão, e a integração só funciona porque o contrato decide qual
padrão vale — e porque o consumidor verifica, em vez de supor.

## 8. Limitações conhecidas

- Os dados de venda são gerados aleatoriamente a cada execução; o lado produtor
  não tem banco, porque o trabalho pede o banco no consumidor (item 18).
- O arquivo inteiro é lido em memória. Para os volumes deste trabalho (220
  linhas) é irrelevante, mas um arquivo de milhões de linhas exigiria
  processar em *streaming* e gravar em lotes.
- A detecção de mojibake é heurística: procura as sequências típicas de UTF-8
  lido como Latin-1 (`Ã`, `Â` seguidos de caractere não-ASCII). Não há como
  distinguir com certeza um erro de codificação de um texto que legitimamente
  contenha essa sequência.
- A detecção de espaços indevidos (10.16) depende das aspas. Em um arquivo que
  usa aspas, `"Iury Rodrigues "` é aceito, porque as aspas delimitam o valor e o
  espaço é parte do dado. Em um arquivo **sem aspas** — o caso das remessas 3 e
  4 —, a mesma linha chega como `2;Iury Rodrigues ;...`, e um espaço colado no
  delimitador é indistinguível de um espaço no fim do valor: o registro é
  rejeitado. É uma rejeição defensável (o contrato manda envolver texto em
  aspas, e sem elas o dado é ambíguo), mas vale registrar que o mesmo nome tem
  destinos diferentes conforme o arquivo respeite ou não essa regra.
