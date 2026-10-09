import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { quoteSeNecessario } from '../contrato.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CONSUMIDOR_DIR = path.join(__dirname, '..', '..', 'logs', 'consumidor')
export const LOG_RECEBIMENTO_FILE = path.join(CONSUMIDOR_DIR, 'remessa-recebimento.log')

// Entregas 19.5 e 19.6 do PDF: o arquivo de rejeitados e o relatorio de
// processamento ficam gravados em disco, alem de irem na resposta da API.
export const OUTPUT_CONSUMIDOR = path.join(__dirname, '..', '..', 'output', 'consumidor')

export async function salvarSaida(nomeArquivo, conteudo) {
  await mkdir(OUTPUT_CONSUMIDOR, { recursive: true })
  const destino = path.join(OUTPUT_CONSUMIDOR, nomeArquivo)
  await writeFile(destino, conteudo, 'utf8')
  return destino
}

const SEPARADOR = '===================================='
const SUBSEPARADOR = '------------------------------------'

function secao(linhas, titulo, itens) {
  if (!itens || itens.length === 0) return
  linhas.push('', SUBSEPARADOR, titulo, SUBSEPARADOR)
  for (const item of itens) linhas.push('', item)
}

// Relatorio de processamento no formato do item 12 do PDF.
export function montarRelatorio({
  nomeArquivo,
  conforme,
  reprocessamento,
  total,
  processados,
  rejeitados,
  erros,
  observacoes,
  desvios,
  banco,
  arquivoRejeitados,
}) {
  const linhas = [
    SEPARADOR,
    reprocessamento ? '    REPROCESSAMENTO DO CSV' : '       PROCESSAMENTO DO CSV',
    SEPARADOR,
    '',
    `Arquivo: ${nomeArquivo}`,
    `Situacao: ${conforme ? 'CONFORME AO CONTRATO' : 'NAO CONFORME AO CONTRATO'}`,
    '',
    `Total de registros: ${total}`,
    '',
    `Registros processados: ${processados}`,
    `Registros rejeitados: ${rejeitados}`,
  ]

  if (banco) {
    linhas.push(
      '',
      `Gravados no banco: ${banco.inseridos} inseridos, ${banco.atualizados} atualizados`,
      `Total de clientes na base: ${banco.totalNoBanco}`,
    )
  }

  linhas.push('', SUBSEPARADOR, 'ERROS ENCONTRADOS', SUBSEPARADOR)

  if (!erros || erros.length === 0) {
    linhas.push('', 'Nenhum erro encontrado.')
  } else {
    for (const erro of erros) {
      linhas.push('', `Linha ${erro.linha}:`)
      for (const motivo of erro.motivos) linhas.push(`${motivo}.`)
      linhas.push(
        `Tratamento: registro rejeitado, nao gravado no banco e enviado para ${arquivoRejeitados}.`,
      )
    }
  }

  secao(linhas, 'DESVIOS DE ESTRUTURA TOLERADOS', desvios)
  secao(linhas, 'OBSERVACOES', observacoes)

  return linhas.join('\n') + '\n'
}

// Relatorio de um arquivo rejeitado INTEGRALMENTE na validacao estrutural
// (Etapa 2): nenhum registro chega a ser lido, entao nao ha erros por linha -
// o erro e do arquivo, e o tratamento e pedir uma nova remessa (item 15.8).
export function montarRelatorioRejeicaoTotal({ nomeArquivo, motivo, observacoes, desvios }) {
  const linhas = [
    SEPARADOR,
    '       PROCESSAMENTO DO CSV',
    SEPARADOR,
    '',
    `Arquivo: ${nomeArquivo}`,
    'Situacao: ARQUIVO REJEITADO INTEGRALMENTE',
    '',
    'Total de registros: 0 (arquivo nao pode ser lido conforme o contrato)',
    '',
    'Registros processados: 0',
    'Registros rejeitados: todos (arquivo inteiro)',
    '',
    SUBSEPARADOR,
    'ERRO DE ESTRUTURA',
    SUBSEPARADOR,
    '',
    motivo,
    '',
    'Tratamento: nenhum registro foi gravado no banco. O arquivo foi recusado por inteiro ' +
      'e uma nova remessa (arquivo de substituicao) foi solicitada ao produtor.',
  ]
  secao(linhas, 'DESVIOS DE ESTRUTURA TOLERADOS', desvios)
  secao(linhas, 'OBSERVACOES', observacoes)
  return linhas.join('\n') + '\n'
}

// Arquivo de registros rejeitados no formato do item 13 do PDF
// (`linha;motivo;dados`), para posterior correcao e reprocessamento.
export function montarRejeitadosCsv(erros) {
  const linhas = [['linha', 'motivo', 'dados'].join(';')]
  for (const erro of erros) {
    const motivo = erro.motivos.join(' | ')
    const dados = erro.registro ? erro.registro.join(';') : ''
    linhas.push([erro.linha, quoteSeNecessario(motivo), quoteSeNecessario(dados)].join(';'))
  }
  return linhas.join('\n') + '\n'
}

// Controle de remessa de recebimento (item 16.1 do PDF).
export async function registrarRecebimento(nomeArquivo, remessa, processados, rejeitados, obs = '') {
  await mkdir(CONSUMIDOR_DIR, { recursive: true })
  const agora = new Date()
  const dataHora = agora.toISOString().replace('T', ' ').slice(0, 19)
  const linha = `[${dataHora}] arquivo=${nomeArquivo} registros=${processados + rejeitados} processados=${processados} rejeitados=${rejeitados} remessa=${remessa}${obs}\n`
  await appendFile(LOG_RECEBIMENTO_FILE, linha, 'utf8')
  return dataHora
}
