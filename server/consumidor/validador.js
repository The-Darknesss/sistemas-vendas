import { parse } from 'csv-parse'
import { mkdir, readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import {
  COLUNAS_CLIENTES,
  ESTRUTURA,
  NOME_ARQUIVO_CONTRATO,
  classificarCabecalho,
  validarRegistro,
} from './contrato-clientes.js'
import {
  CONSUMIDOR_DIR,
  LOG_RECEBIMENTO_FILE,
  montarRejeitadosCsv,
  montarRelatorio,
  montarRelatorioRejeicaoTotal,
  registrarRecebimento,
  salvarSaida,
} from './relatorio.js'
import { registrarRemessaBanco, salvarClientes, totalClientes } from './banco.js'

// Le o arquivo com csv-parse aplicando o contrato: delimitador ';' e aspas
// duplas (inclusive escapadas como ""). As opcoes "relax" existem para que
// NENHUM defeito de uma linha derrube o arquivo inteiro (item 14 do PDF):
//  - relax_quotes: uma aspa aberta e nao fechada (ex.: Camila "Reis) e mantida
//    como texto literal, e o registro e rejeitado depois pela validacao;
//  - relax_column_count: linhas com 5 ou 7 campos chegam inteiras e sao
//    rejeitadas individualmente, em vez de abortar a leitura;
//  - skip_empty_lines: false faz a linha em branco chegar como registro vazio;
//  - record_delimiter aceita LF (contrato) e CRLF (desvio tolerado, secao 4);
//  - info: true guarda o numero real da linha no arquivo (info.lines).
function lerRegistros(conteudo) {
  return new Promise((resolve, reject) => {
    const registros = []
    const parser = parse({
      delimiter: ESTRUTURA.delimitador,
      quote: ESTRUTURA.aspas,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: false,
      bom: true,
      record_delimiter: ['\n', '\r\n'],
      info: true,
    })
    parser.on('readable', () => {
      let item
      while ((item = parser.read()) !== null) registros.push(item)
    })
    parser.on('error', reject)
    parser.on('end', () => resolve(registros))
    parser.end(conteudo)
  })
}

function erroEstrutural(motivo) {
  const erro = new Error(motivo)
  erro.status = 400
  erro.estrutural = true
  return erro
}

// Rejeicao do arquivo inteiro (Etapa 2): registra o recebimento, grava o
// relatorio de processamento e devolve o erro a ser lancado.
async function rejeitarArquivo(contexto, codigo, motivo) {
  const { nomeLimpo, remessa, observacoes, desvios } = contexto
  await registrarRecebimento(nomeLimpo, remessa, 0, 0, ` ERRO=${codigo}`)
  const relatorio = montarRelatorioRejeicaoTotal({ nomeArquivo: nomeLimpo, motivo, observacoes, desvios })
  const base = nomeLimpo.replace(/\.csv$/i, '')
  const erro = erroEstrutural(motivo)
  erro.relatorio = relatorio
  erro.arquivo_relatorio = await salvarSaida(`relatorio-${base}.txt`, relatorio)
  return erro
}

// Extrai o numero de sequencia da remessa do nome do arquivo. Aceita tanto
// "sistema_clientes-002.csv" quanto "IntegracaoCliente2.csv" (1 a 3 digitos
// imediatamente antes da extensao). Retorna null se nao houver numero.
function extrairSequencia(nomeArquivo) {
  const m = /(\d{1,3})(?=\D*$)/.exec(nomeArquivo)
  return m ? Number(m[1]) : null
}

// Ultima sequencia registrada no log de recebimento.
async function ultimaSequenciaRecebida() {
  try {
    const conteudo = await readFile(LOG_RECEBIMENTO_FILE, 'utf8')
    const linhas = conteudo.trim().split('\n').filter(Boolean)
    for (let i = linhas.length - 1; i >= 0; i--) {
      const m = /sequencia=(\d+)/.exec(linhas[i])
      if (m) return Number(m[1])
    }
  } catch {
    // arquivo de log ainda nao existe
  }
  return 0
}

// Recebe, valida e processa o arquivo de clientes do Grupo 1 seguindo as 5
// etapas do item 11 do PDF. Sem banco de dados: os registros validos sao
// devolvidos no resultado da validacao.
export async function validarArquivoClientes(nomeArquivo, conteudoCsv, opcoes = {}) {
  const reprocessamento = Boolean(opcoes.reprocessamento)
  const nomeLimpo = String(nomeArquivo).replace(/[/\\]/g, '_')
  const remessa = randomUUID()
  await mkdir(CONSUMIDOR_DIR, { recursive: true })

  const observacoes = []
  const desvios = []

  // Etapa 1 - Recepcao: controle de remessa de recebimento (item 16.1).
  const sequenciaRecebida = extrairSequencia(nomeLimpo)
  let foraDeSequencia = false
  if (reprocessamento) {
    observacoes.push(
      'REPROCESSAMENTO (item 21): arquivo reenviado apos correcao dos registros rejeitados. ' +
        'O controle de sequencia nao se aplica, e os registros validos atualizam os ja gravados.',
    )
  } else if (sequenciaRecebida !== null) {
    const ultimaSequencia = await ultimaSequenciaRecebida()
    const esperada = ultimaSequencia + 1
    if (sequenciaRecebida !== esperada) {
      foraDeSequencia = true
      observacoes.push(
        `Remessa fora da sequencia: o arquivo "${nomeLimpo}" traz a sequencia ${sequenciaRecebida}, ` +
          `mas a esperada era ${esperada} (ultima recebida: ${ultimaSequencia}).`,
      )
    }
  }

  if (nomeLimpo !== NOME_ARQUIVO_CONTRATO && !/^sistema_clientes[-_]?\d*\.csv$/i.test(nomeLimpo)) {
    desvios.push(
      `Nome do arquivo "${nomeLimpo}" difere do contrato ("${NOME_ARQUIVO_CONTRATO}"). ` +
        `Aceito: nao afeta o conteudo.`,
    )
  }

  // Etapa 2 - Validacao estrutural do arquivo inteiro.
  const contexto = { nomeLimpo, remessa, observacoes, desvios }
  if (conteudoCsv.trim() === '') {
    throw await rejeitarArquivo(
      contexto,
      'arquivo_vazio',
      `Arquivo "${nomeLimpo}" esta vazio. Rejeitado integralmente (Etapa 2 - Validacao estrutural).`,
    )
  }

  const primeiraLinha = conteudoCsv.split('\n', 1)[0]
  if (!primeiraLinha.includes(ESTRUTURA.delimitador)) {
    throw await rejeitarArquivo(
      contexto,
      'delimitador_invalido',
      `Arquivo "${nomeLimpo}" nao usa o delimitador "${ESTRUTURA.delimitador}" do contrato. ` +
        `Sem o delimitador acordado nenhum campo pode ser identificado, entao o arquivo e ` +
        `rejeitado integralmente e outra remessa deve ser solicitada (Etapa 2 - Validacao estrutural).`,
    )
  }

  if (conteudoCsv.includes('\r\n')) {
    desvios.push('Quebra de linha CRLF em vez de LF (contrato, secao 2). Aceito: tratado na leitura.')
  }

  let registros
  try {
    registros = await lerRegistros(conteudoCsv)
  } catch (err) {
    // So chega aqui um defeito que impede a leitura do arquivo inteiro.
    throw await rejeitarArquivo(
      contexto,
      'leitura_impossivel',
      `Nao foi possivel interpretar o arquivo "${nomeLimpo}" como CSV do contrato (${err.message}). ` +
        `Rejeitado integralmente (Etapa 2 - Validacao estrutural).`,
    )
  }

  if (registros.length === 0) {
    throw await rejeitarArquivo(
      contexto,
      'sem_registros',
      `Arquivo "${nomeLimpo}" nao possui registros. Rejeitado integralmente.`,
    )
  }

  // Cabeçalho: conforme, incompleto (segue posicionalmente) ou invalido.
  const cabecalho = classificarCabecalho(registros[0].record)
  let conforme = true
  if (cabecalho.situacao === 'invalido') {
    throw await rejeitarArquivo(
      contexto,
      'cabecalho_invalido',
      `Cabecalho do arquivo "${nomeLimpo}" nao corresponde ao contrato. ` +
        `Esperado "${COLUNAS_CLIENTES.join(';')}", recebido "${cabecalho.recebido.join(';')}". ` +
        `As colunas nao podem ser mapeadas com seguranca, entao o arquivo e rejeitado ` +
        `integralmente e outra remessa deve ser solicitada (Etapa 2 - Validacao estrutural).`,
    )
  }
  if (cabecalho.situacao === 'incompleto') {
    conforme = false
    observacoes.push(
      `Cabecalho incompleto: faltam as colunas "${cabecalho.faltando.join(', ')}". ` +
        `Como as colunas presentes seguem a ordem do contrato, os registros foram lidos pela ` +
        `posicao e o processamento continuou (processamento parcial).`,
    )
  }

  // Etapas 3, 4 e 5 - validacao linha a linha, processamento dos validos e
  // acumulo dos erros, sem interromper o lote.
  const vistos = { ids: new Set(), emails: new Set() }
  const validos = []
  const erros = []

  // A linha crua e necessaria para o 10.16: so nela da para ver se o espaco
  // esta em volta do delimitador (defeito) ou dentro das aspas (dado).
  const linhasBrutas = conteudoCsv.split(/\r?\n/)

  for (const item of registros.slice(1)) {
    const linha = item.info.lines
    // O registro e validado exatamente como veio: nada e corrigido antes.
    const motivos = validarRegistro(item.record, vistos, linhasBrutas[linha - 1])

    if (motivos.length === 0) {
      const [id, nome, email, dataNascimento, cidade, ativo] = item.record
      validos.push({
        _linha: linha,
        id_cliente: Number(id),
        nome,
        // Unicidade de e-mail nao diferencia maiusculas; o valor so e
        // padronizado na gravacao, para que a comparacao seja consistente.
        email: email.toLowerCase(),
        data_nascimento: dataNascimento,
        cidade,
        ativo,
      })
    } else {
      erros.push({ linha, motivos, registro: item.record })
    }

    // Registra a ocorrencia mesmo quando rejeitada, para que uma repeticao
    // posterior da mesma chave seja detectada como duplicidade.
    const [id, , email] = item.record
    if (id !== undefined && id !== '') vistos.ids.add(id)
    if (typeof email === 'string' && email !== '') vistos.emails.add(email.toLowerCase())
  }

  const total = registros.length - 1

  // "conforme" diz respeito ao ARQUIVO contra o CONTRATO, e por isso e decidido
  // aqui, antes da gravacao: um conflito no banco e resultado do processamento
  // (depende do que ja foi recebido antes), nao um defeito deste arquivo.
  if (erros.length > 0) conforme = false

  // Etapa 4 - Processamento: os registros validos sao inseridos ou atualizados
  // no banco (item 18). Os invalidos nunca chegam aqui.
  const gravacao = salvarClientes(validos, { remessa, arquivo: nomeLimpo })

  // Um registro pode passar na validacao e mesmo assim nao ser gravado: o
  // contrato exige e-mail unico, e o banco recusa um id novo que reaproveite o
  // e-mail de um cliente ja cadastrado por OUTRA remessa. Esse registro conta
  // como rejeitado, entao os totais so fecham depois da gravacao.
  for (const conflito of gravacao.conflitos) {
    erros.push({
      linha: conflito.linha ?? '-',
      motivos: [`Conflito ao gravar o cliente ${conflito.id_cliente}: ${conflito.motivo}`],
      registro: null,
    })
    observacoes.push(
      `Conflito entre remessas na linha ${conflito.linha}: o cliente ${conflito.id_cliente} usa um ` +
        `e-mail que ja pertence a outro id no banco. O arquivo esta conforme o contrato, mas os ` +
        `dois registros nao podem coexistir com "email" unico - e preciso alinhar com o produtor ` +
        `qual dos dois ids e o correto.`,
    )
  }

  const processados = gravacao.inseridos + gravacao.atualizados
  const rejeitados = erros.length
  registrarRemessaBanco({
    remessa,
    arquivo: nomeLimpo,
    sequencia: sequenciaRecebida,
    total,
    inseridos: gravacao.inseridos,
    atualizados: gravacao.atualizados,
    rejeitados,
    reprocessamento,
  })

  const base = nomeLimpo.replace(/\.csv$/i, '')

  // Relatorio de processamento (item 12) + arquivo de rejeitados (item 13),
  // gravados em disco (entregas 19.5 e 19.6) e devolvidos na resposta da API.
  const relatorio = montarRelatorio({
    nomeArquivo: nomeLimpo,
    conforme,
    reprocessamento,
    total,
    processados,
    rejeitados,
    erros,
    observacoes,
    desvios,
    banco: { ...gravacao, totalNoBanco: totalClientes() },
    arquivoRejeitados: `rejeitados-${base}.csv`,
  })

  const rejeitadosCsv = erros.length > 0 ? montarRejeitadosCsv(erros) : null
  const arquivoRelatorio = await salvarSaida(`relatorio-${base}.txt`, relatorio)
  const arquivoRejeitados = rejeitadosCsv
    ? await salvarSaida(`rejeitados-${base}.csv`, rejeitadosCsv)
    : null

  await registrarRecebimento(
    nomeLimpo,
    remessa,
    processados,
    rejeitados,
    ` sequencia=${sequenciaRecebida === null ? '-' : sequenciaRecebida}` +
      (foraDeSequencia ? ' ERRO=remessa_fora_sequencia' : ''),
  )

  return {
    nome_arquivo: nomeLimpo,
    remessa,
    sequencia: sequenciaRecebida,
    remessa_fora_sequencia: foraDeSequencia,
    reprocessamento,
    conforme,
    total,
    processados,
    rejeitados,
    erros,
    observacoes,
    desvios,
    banco: { ...gravacao, total_no_banco: totalClientes() },
    relatorio,
    arquivo_relatorio: arquivoRelatorio,
    arquivo_rejeitados: `rejeitados-${base}.csv`,
    caminho_rejeitados: arquivoRejeitados,
    rejeitados_csv: rejeitadosCsv,
    registros_validos: validos,
    log_recebimento: LOG_RECEBIMENTO_FILE,
  }
}
