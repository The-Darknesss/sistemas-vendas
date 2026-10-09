import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const BANCO_FILE = path.join(__dirname, '..', 'vendas.db')

// Item 18 do PDF: CSV -> Validacao -> Transformacao -> Banco de Dados.
// Somente registros VALIDOS chegam aqui; os invalidos nunca sao inseridos.
let db = null

function conectar() {
  if (db) return db
  mkdirSync(path.dirname(BANCO_FILE), { recursive: true })
  db = new DatabaseSync(BANCO_FILE)
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id_cliente      INTEGER PRIMARY KEY,
      nome            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      data_nascimento TEXT NOT NULL,
      cidade          TEXT NOT NULL,
      ativo           TEXT NOT NULL CHECK (ativo IN ('S', 'N')),
      remessa         TEXT NOT NULL,
      arquivo         TEXT NOT NULL,
      recebido_em     TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS remessas (
      remessa      TEXT PRIMARY KEY,
      arquivo      TEXT NOT NULL,
      sequencia    INTEGER,
      total        INTEGER NOT NULL,
      inseridos    INTEGER NOT NULL,
      atualizados  INTEGER NOT NULL,
      rejeitados   INTEGER NOT NULL,
      reprocessamento INTEGER NOT NULL DEFAULT 0,
      recebido_em  TEXT NOT NULL
    );
  `)
  return db
}

// Insere ou atualiza os registros validos (item 18). A chave e o id_cliente,
// definido como chave primaria unica pelo contrato: uma remessa posterior com
// o mesmo id ATUALIZA o cadastro, e e isso que permite o reprocessamento de um
// registro antes rejeitado (item 21) sem duplicar o cliente.
export function salvarClientes(registros, { remessa, arquivo }) {
  const banco = conectar()
  const recebidoEm = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const existe = banco.prepare('SELECT id_cliente FROM clientes WHERE id_cliente = ?')
  const gravar = banco.prepare(`
    INSERT INTO clientes (id_cliente, nome, email, data_nascimento, cidade, ativo, remessa, arquivo, recebido_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id_cliente) DO UPDATE SET
      nome = excluded.nome,
      email = excluded.email,
      data_nascimento = excluded.data_nascimento,
      cidade = excluded.cidade,
      ativo = excluded.ativo,
      remessa = excluded.remessa,
      arquivo = excluded.arquivo,
      recebido_em = excluded.recebido_em
  `)

  let inseridos = 0
  let atualizados = 0
  const conflitos = []

  banco.exec('BEGIN')
  try {
    for (const r of registros) {
      const jaExistia = existe.get(r.id_cliente) !== undefined
      try {
        gravar.run(
          r.id_cliente,
          r.nome,
          r.email,
          r.data_nascimento,
          r.cidade,
          r.ativo,
          remessa,
          arquivo,
          recebidoEm,
        )
        if (jaExistia) atualizados++
        else inseridos++
      } catch (err) {
        // O e-mail e unico no banco: um id novo reaproveitando o e-mail de
        // outro cliente viola a restricao e o registro nao entra.
        conflitos.push({ id_cliente: r.id_cliente, linha: r._linha, motivo: err.message })
      }
    }
    banco.exec('COMMIT')
  } catch (err) {
    banco.exec('ROLLBACK')
    throw err
  }

  return { inseridos, atualizados, conflitos }
}

export function registrarRemessaBanco(dados) {
  const banco = conectar()
  banco
    .prepare(`
      INSERT INTO remessas (remessa, arquivo, sequencia, total, inseridos, atualizados, rejeitados, reprocessamento, recebido_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      dados.remessa,
      dados.arquivo,
      dados.sequencia,
      dados.total,
      dados.inseridos,
      dados.atualizados,
      dados.rejeitados,
      dados.reprocessamento ? 1 : 0,
      new Date().toISOString().replace('T', ' ').slice(0, 19),
    )
}

export function totalClientes() {
  return conectar().prepare('SELECT COUNT(*) AS total FROM clientes').get().total
}

export function listarClientes(limite = 50) {
  return conectar()
    .prepare('SELECT * FROM clientes ORDER BY id_cliente LIMIT ?')
    .all(limite)
}

export function listarRemessas() {
  return conectar().prepare('SELECT * FROM remessas ORDER BY recebido_em DESC').all()
}
