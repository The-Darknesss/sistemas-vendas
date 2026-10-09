// Contrato de integracao do Sistema de Vendas (Grupo 2 -> Grupo 3).
// Ordem exata das colunas exportadas no CSV, conforme docs/CONTRATO.md.
export const COLUNAS = [
  'id_venda',
  'id_cliente',
  'id_produto',
  'quantidade',
  'valor_unitario',
  'valor_total',
  'data_venda',
  'forma_pagamento',
  'status',
  'integrante',
  'email',
]

// Integrantes do Grupo 2. O nome aparece por registro no CSV (item 8 do PDF),
// alternando entre os membros em cada linha exportada.
export const INTEGRANTES = [
  'Paulo Eduardo',
  'Joao Pedro Azevedo',
  'Hyago Fernandes',
]

// E-mail derivado do integrante na exportacao (coluna 11 do contrato).
export function emailDoIntegrante(integrante) {
  const mapa = {
    'Paulo Eduardo': 'paulo.eduardo@grupo2.com',
    'Joao Pedro Azevedo': 'joao.pedro@grupo2.com',
    'Hyago Fernandes': 'hyago.fernandes@grupo2.com',
  }
  return mapa[integrante] || ''
}

export const FORMAS_PAGAMENTO = ['PIX', 'CARTAO', 'BOLETO']
export const STATUS = ['CONCLUIDA', 'CANCELADA']

// Formato decimal do contrato: 9999.99 com ponto decimal e 2 casas.
export function formatarDecimal(valor) {
  return Number(valor).toFixed(2)
}

// Regra de aspas do contrato: o campo so recebe aspas duplas quando contem
// o delimitador (';'), aspas (") ou quebra de linha.
export function quoteSeNecessario(valor) {
  const s = String(valor)
  return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

// Monta a linha CSV de um registro seguindo a ordem das colunas do contrato.
export function linhaParaCsv(registro, colunas = COLUNAS) {
  return colunas.map((coluna) => quoteSeNecessario(registro[coluna])).join(';')
}