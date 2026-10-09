import { COLUNAS, linhaParaCsv } from '../contrato.js'

// Aplica as injeccoes pela LINHA REAL do arquivo: cada problema ocupa a
// posicao exata do plano (cabecalho = linha 1). Quando uma linha em branco
// (10.17) e inserida, os registros seguintes deslocam automaticamente e as
// demais injeccoes continuam caindo na linha certa.
export function aplicarInconsistencias(base, injecoes) {
  const modificados = base.map((r) => ({ ...r }))
  const erros = []
  const injecoesPorLinha = new Map()
  for (const injecao of injecoes) {
    if (!injecoesPorLinha.has(injecao.linha)) injecoesPorLinha.set(injecao.linha, [])
    injecoesPorLinha.get(injecao.linha).push(injecao)
  }

  const linhas = []
  let fileLine = 2 // a linha 1 do arquivo e o cabecalho
  for (let i = 0; i < modificados.length; i++) {
    const daLinha = injecoesPorLinha.get(fileLine) || []
    for (const injecao of daLinha) {
      if (injecao.tipo.startsWith('10.17')) {
        linhas.push('')
        fileLine++
        erros.push({ linha: injecao.linha, tipo: injecao.tipo, detalhe: injecao.detalhe })
      } else {
        injecao.aplicar(modificados[i], base)
        erros.push({ linha: injecao.linha, tipo: injecao.tipo, detalhe: injecao.detalhe })
      }
    }
    const registro = modificados[i]
    let linha = linhaParaCsv(registro, COLUNAS)
    if (registro.__espacos) {
      linha = linha.replace(/;/g, ' ; ')
      delete registro.__espacos
    }
    linhas.push(linha)
    fileLine++
  }

  return { linhas, erros }
}