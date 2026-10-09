import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const OUTPUT_DIR = path.join(__dirname, '..', '..', 'logs', 'produtor')
export const LOG_REMESSA_FILE = path.join(OUTPUT_DIR, 'remessa.log')
export const LOG_INCONSISTENCIAS_FILE = path.join(OUTPUT_DIR, 'inconsistencias.log')

// Registra o envio de uma remessa no log de controle (item 15.2 do PDF).
// `obs` permite anotacoes extras na linha do log (ex.: numero de sequencia).
export async function registrarRemessa(arquivo, registros, obs = '') {
  await mkdir(OUTPUT_DIR, { recursive: true })
  const remessa = randomUUID()
  const agora = new Date()
  const dataHora = agora.toISOString().replace('T', ' ').slice(0, 19)
  const linhaLog = `[${dataHora}] arquivo=${arquivo} registros=${registros} remessa=${remessa}${obs}\n`
  await appendFile(LOG_REMESSA_FILE, linhaLog, 'utf8')
  return { remessa, dataHora }
}

// Registra o relato das inconsistencias inseridas (item 15.7 do PDF) -
// destinado ao professor, nao ao grupo consumidor.
export async function registrarLogInconsistencias(linhas) {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await appendFile(LOG_INCONSISTENCIAS_FILE, linhas.join('\n') + '\n', 'utf8')
}