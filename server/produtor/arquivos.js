import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { registrarRemessa } from './remessa.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Area de transferencia do produtor (item 6 do PDF): os arquivos ficam em
// disco para serem disponibilizados ao grupo consumidor (item 15.6) e
// entregues ao professor (itens 19.3 e 19.4).
export const OUTPUT_PRODUTOR = path.join(__dirname, '..', '..', 'output', 'produtor')

export async function salvarRemessa(arquivo, conteudo) {
  await mkdir(OUTPUT_PRODUTOR, { recursive: true })
  const destino = path.join(OUTPUT_PRODUTOR, arquivo)
  await writeFile(destino, conteudo, 'utf8')
  return destino
}

// Item 15.8: quando o consumidor rejeita uma remessa por erro de estrutura, o
// produtor gera um arquivo de SUBSTITUICAO, com nome proprio para nao
// sobrescrever a remessa original que ja foi enviada.
export function nomeRemessa(base, substituto) {
  return substituto ? base.replace(/\.csv$/, '-substituto.csv') : base
}

export function obsRemessa(sequencia, { substituto, motivo } = {}) {
  const extra = substituto ? ` tipo=substituicao motivo="${motivo || 'nao informado'}"` : ''
  return ` sequencia=${sequencia}${extra}`
}

// Controle de remessa de envio (item 15.2): alem do log interno, cada CSV sai
// acompanhado de um arquivo de controle "vendas-NNN.ctl", que e entregue ao
// consumidor junto com o CSV. Com ele o consumidor confere a sequencia, a
// quantidade de registros e a integridade (SHA-256 dos bytes do CSV).
export const COLUNAS_CONTROLE = ['arquivo', 'sequencia', 'tipo', 'remessa', 'data_hora', 'registros', 'sha256']

export function nomeControle(arquivo) {
  return arquivo.replace(/\.csv$/, '.ctl')
}

// Grava o CSV, registra a remessa no log e gera o arquivo de controle.
export async function publicarRemessa(arquivo, conteudo, registros, sequencia, opcoes = {}) {
  const caminho = await salvarRemessa(arquivo, conteudo)
  const sha256 = createHash('sha256').update(conteudo, 'utf8').digest('hex')
  const { remessa, dataHora } = await registrarRemessa(
    arquivo,
    registros,
    `${obsRemessa(sequencia, opcoes)} sha256=${sha256}`,
  )

  const tipo = opcoes.substituto ? 'SUBSTITUICAO' : 'NORMAL'
  const controle =
    COLUNAS_CONTROLE.join(';') +
    '\n' +
    [arquivo, sequencia, tipo, remessa, dataHora, registros, sha256].join(';') +
    '\n'
  const arquivoControle = nomeControle(arquivo)
  await salvarRemessa(arquivoControle, controle)

  return { caminho, remessa, dataHora, sha256, arquivoControle, controle }
}
