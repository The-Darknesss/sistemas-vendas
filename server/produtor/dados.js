import {
  FORMAS_PAGAMENTO,
  INTEGRANTES,
  STATUS,
  emailDoIntegrante,
  formatarDecimal,
} from '../contrato.js'

// Gerador aleatorio de vendas (sem banco de dados). Cada chamada produz um
// conjunto novo de registros respeitando o contrato de integracao.
const PRODUTOS = [
  { id: 301, preco: 4499.9 },
  { id: 302, preco: 89.9 },
  { id: 303, preco: 249.9 },
  { id: 304, preco: 1899.9 },
  { id: 305, preco: 499.9 },
  { id: 306, preco: 329.9 },
  { id: 307, preco: 199.9 },
  { id: 308, preco: 349.9 },
  { id: 309, preco: 1299.9 },
  { id: 310, preco: 449.9 },
  { id: 311, preco: 159.9 },
  { id: 312, preco: 1499.9 },
  { id: 313, preco: 2799.9 },
  { id: 314, preco: 899.9 },
  { id: 315, preco: 429.9 },
]

function aleatorio(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function gerarVendas(qtd = 220) {
  const inicio = new Date(2026, 0, 1).getTime()
  const fim = new Date(2026, 8, 11).getTime()

  return Array.from({ length: qtd }, (_, i) => {
    const produto = PRODUTOS[aleatorio(0, PRODUTOS.length - 1)]
    const quantidade = aleatorio(1, 10)
    const valorUnitario = Number(produto.preco.toFixed(2))

    const data = new Date(inicio + Math.random() * (fim - inicio))
    const integrante = INTEGRANTES[i % INTEGRANTES.length]

    return {
      id_venda: i + 1,
      id_cliente: aleatorio(101, 140),
      id_produto: produto.id,
      quantidade,
      valor_unitario: formatarDecimal(valorUnitario),
      valor_total: formatarDecimal(quantidade * valorUnitario),
      data_venda: `${pad2(data.getDate())}/${pad2(data.getMonth() + 1)}/${data.getFullYear()}`,
      forma_pagamento: FORMAS_PAGAMENTO[aleatorio(0, FORMAS_PAGAMENTO.length - 1)],
      status: Math.random() < 0.1 ? STATUS[1] : STATUS[0],
      integrante,
      email: emailDoIntegrante(integrante),
    }
  })
}