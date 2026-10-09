# Contrato de Integração CSV — Sistema de Clientes

Transcrição fiel de `docs/Modelo - Contrato de Integração CSV.docx`, acordado
entre as duas equipes. É a **fonte da verdade** implementada em
`server/consumidor/contrato-clientes.js`.

## 1. Identificação

| Item                | Valor                                  |
|---------------------|----------------------------------------|
| Nome do arquivo     | `sistema_clientes.csv`                 |
| Extensão            | `.csv`                                 |
| Finalidade          | Integração de dados entre sistemas     |
| Sistema produtor    | Sistema de Clientes (Grupo 1)          |
| Sistema consumidor  | Sistema de Vendas (Grupo 2)            |

## 2. Estrutura do arquivo

| Parâmetro             | Especificação                                    |
|-----------------------|--------------------------------------------------|
| Cabeçalho             | Presente na primeira linha                       |
| Delimitador de campos | Ponto e vírgula (`;`)                            |
| Caractere de aspas    | Aspas duplas (`"`) para envolver campos de texto |
| Codificação           | UTF-8                                            |
| Quebra de linha       | LF — Line Feed (`\n`)                            |
| Ordem das colunas     | Fixa, conforme a seção 3                         |

## 3. Especificação dos campos

| # | Campo             | Tipo     | Tamanho  | Obrigatório | Formato             | Regra de validação                                | Exemplo                     |
|---|-------------------|----------|----------|-------------|---------------------|---------------------------------------------------|-----------------------------|
| 1 | `id_cliente`      | Inteiro  | —        | Sim         | Numérico sequencial | Chave primária única, maior que zero              | `1`                         |
| 2 | `nome`            | Texto    | máx 100  | Sim         | String              | Não vazio, sem caracteres especiais proibidos     | `Maria Souza`               |
| 3 | `email`           | Texto    | máx 100  | Sim         | E-mail padrão       | Padrão `usuario@dominio.com`, único no arquivo    | `maria.souza@gmail.com`     |
| 4 | `data_nascimento` | Data     | 10       | Sim         | `DD/MM/YYYY`        | Data válida no calendário gregoriano              | `15/03/2000`                |
| 5 | `cidade`          | Texto    | máx 100  | Sim         | String              | Não vazio, sem caracteres especiais proibidos     | `Curitiba`                  |
| 6 | `ativo`           | Booleano | 1        | Sim         | `S`/`N`             | Apenas os valores `S` ou `N`                      | `S`                         |

**Caracteres especiais proibidos** em campos de texto: o delimitador (`;`), o
caractere de aspas (`"`), quebras de linha (`\n`, `\r`) e caracteres de
controle. Um campo que precise conter `;` deve vir envolvido em aspas duplas;
aspas internas devem ser duplicadas (`""`).

## 4. Decisões de tratamento adotadas pelo consumidor

Registradas aqui porque o contrato não as especifica (item 24, Regra 6 do PDF).

**Princípio adotado:** o sistema **não corrige** registros. Pelo item 11 do PDF,
registro válido é processado e registro inválido é rejeitado — e o item 13
guarda os rejeitados justamente para que sejam *"posteriormente corrigidos e
processados novamente"*, no ciclo do item 21. Corrigir dentro do consumidor
esconderia o defeito do produtor, que nunca ficaria sabendo do problema.

| Situação                                              | Decisão              | Justificativa |
|-------------------------------------------------------|----------------------|---------------|
| Espaço **em volta do delimitador** (`10 ; João ; ...`) — 10.16 | **Rejeita o registro** | É defeito de formatação do produtor: todo valor da linha chega sujo. O PDF (item 11) trata registro inválido como rejeição |
| Espaço **dentro das aspas** (`"Iury Rodrigues "`) | **Aceita como está** | As aspas delimitam o valor, então o espaço faz parte do dado. O contrato permite: `nome` é texto livre de até 100 caracteres |
| Aspas que sobram no valor (`"Joao"`), efeito de ` ; "Joao" ; ` | **Rejeita o registro** | Mesma razão: é defeito de formatação do produtor e precisa aparecer no relatório |
| `email` com diferença de caixa (`A@X.com` / `a@x.com`) | **Compara** sem diferenciar maiúsculas | Critério de unicidade, não alteração do dado: o valor é gravado como veio |
| Arquivo com `CRLF` em vez de `LF`                      | **Aceita**, com aviso no relatório | Diferença de sistema operacional (item 22.7), não corrompe o dado |
| Nome do arquivo diferente de `sistema_clientes.csv`    | **Aceita**, com aviso no relatório | Não afeta o conteúdo; o controle de remessa usa o número do nome |
| Cabeçalho ausente, com colunas desconhecidas ou fora de ordem | **Rejeita o arquivo inteiro** | Impede o mapeamento confiável campo↔coluna (item 14) |
| Cabeçalho incompleto, mas prefixo correto na ordem do contrato | **Aceita posicionalmente**, marca o arquivo como não conforme e segue com processamento parcial | A ordem das colunas é fixa no contrato, então os dados continuam interpretáveis |
| Delimitador diferente de `;`                           | **Rejeita o arquivo inteiro** | Sem o delimitador do contrato nenhum campo é identificável (item 22.5) |
| Linha com quantidade de campos diferente de 6          | **Rejeita o registro** | Não há como saber qual campo foi deslocado |
| Valor `NULL`, `-`, `N/A` em campo obrigatório          | **Rejeita o registro** | O contrato não prevê representação de nulo |
| Texto com mojibake (`JoÃ£o`)                           | **Rejeita o registro** | Indica leitura fora do UTF-8 acordado; corrigir seria adivinhar |
| `id_cliente` ou `email` repetidos                      | **Rejeita a 2ª ocorrência** | Ambos são únicos por contrato; a 1ª é mantida |
