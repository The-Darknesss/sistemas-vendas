import { COLUNAS } from '../contrato.js'
import { gerarVendas } from './dados.js'
import { aplicarInconsistencias } from './injecoes.js'
import { registrarLogInconsistencias } from './remessa.js'
import { nomeRemessa, publicarRemessa } from './arquivos.js'

// Remessa 004 - inconsistencias do professor (itens 10.14, 10.17, 10.20 e
// 10.18), intercaladas entre registros validos.
const INJECOES = [
  {
    tipo: '10.14 tipo de dado invalido',
    linha: 15,
    detalhe: 'data_venda=ABC (campo deveria conter data)',
    aplicar: (r) => {
      r.data_venda = 'ABC'
    },
  },
  {
    tipo: '10.17 linha em branco',
    linha: 78,
    detalhe: 'linha em branco entre registros',
    aplicar: () => {},
  },
  {
    tipo: '10.20 valor nulo / representacao inesperada',
    linha: 92,
    detalhe: 'forma_pagamento=NULL',
    aplicar: (r) => {
      r.forma_pagamento = 'NULL'
    },
  },
  {
    tipo: '10.18 codificacao de caracteres',
    linha: 103,
    detalhe: 'integrante com mojibake ("JoÃ£o Pedro Azevedo")',
    aplicar: (r) => {
      r.integrante = 'JoÃ£o Pedro Azevedo'
    },
  },
]

export async function gerarCsv4(opcoes = {}) {
  const base = gerarVendas()
  const total = base.length
  // Item 15.8: o arquivo de substituicao sai CORRIGIDO, sem as injecoes - e
  // ele que substitui a remessa rejeitada pelo consumidor.
  const injecoes = opcoes.substituto ? [] : INJECOES
  const { linhas, erros } = aplicarInconsistencias(base, injecoes)
  const csv = COLUNAS.join(';') + '\n' + linhas.join('\n') + '\n'

  const arquivo = nomeRemessa('vendas-004.csv', opcoes.substituto)
  const { caminho, remessa, dataHora, arquivoControle, controle } = await publicarRemessa(
    arquivo,
    csv,
    total,
    '4',
    opcoes,
  )

  await registrarLogInconsistencias([
    `[${dataHora}] arquivo=${arquivo} registros=${total} inconsistencias=${erros.length} remessa=${remessa} sequencia=4`,
    ...erros.map((e) => `Linha ${e.linha}: ${e.tipo} (${e.detalhe})`),
    ...(opcoes.substituto ? ['OBS: arquivo de substituicao, gerado sem inconsistencias.'] : []),
  ])

  return {
    arquivo,
    caminho,
    conteudo: csv,
    registros: total,
    inconsistencias: erros.length,
    remessa,
    arquivo_controle: arquivoControle,
    controle,
    sequencia: '4',
    substituto: Boolean(opcoes.substituto),
  }
}