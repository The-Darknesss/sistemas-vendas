import { COLUNAS } from '../contrato.js'
import { gerarVendas } from './dados.js'
import { aplicarInconsistencias } from './injecoes.js'
import { registrarLogInconsistencias } from './remessa.js'
import { nomeRemessa, publicarRemessa } from './arquivos.js'

// Remessa 005 - inconsistencias do professor (itens 10.12, 10.15 e 10.19),
// intercaladas entre registros validos. O problema 10.21 (remessa fora de
// sequencia) e reproduzido gerando/enviando a 005 antes da 004.
const INJECOES = [
  {
    tipo: '10.12 valor monetario formatado',
    linha: 33,
    detalhe: 'valor_total=R$ 1.250,50 (contrato espera 1250.50)',
    aplicar: (r) => {
      r.valor_total = 'R$ 1.250,50'
    },
  },
  {
    tipo: '10.15 e-mail invalido',
    linha: 47,
    detalhe: 'email=joao@ (formato invalido)',
    aplicar: (r) => {
      r.email = 'joao@'
    },
  },
  {
    tipo: '10.19 valor booleano diferente do contrato',
    linha: 121,
    detalhe: 'status=SIM (contrato espera CONCLUIDA/CANCELADA)',
    aplicar: (r) => {
      r.status = 'SIM'
    },
  },
]

export async function gerarCsv5(opcoes = {}) {
  const base = gerarVendas()
  const total = base.length
  // Item 15.8: o arquivo de substituicao sai CORRIGIDO, sem as injecoes - e
  // ele que substitui a remessa rejeitada pelo consumidor.
  const injecoes = opcoes.substituto ? [] : INJECOES
  const { linhas, erros } = aplicarInconsistencias(base, injecoes)
  const csv = COLUNAS.join(';') + '\n' + linhas.join('\n') + '\n'

  const arquivo = nomeRemessa('vendas-005.csv', opcoes.substituto)
  const { caminho, remessa, dataHora, arquivoControle, controle } = await publicarRemessa(
    arquivo,
    csv,
    total,
    '5',
    opcoes,
  )

  await registrarLogInconsistencias([
    `[${dataHora}] arquivo=${arquivo} registros=${total} inconsistencias=${erros.length} remessa=${remessa} sequencia=5`,
    ...erros.map((e) => `Linha ${e.linha}: ${e.tipo} (${e.detalhe})`),
    ...(opcoes.substituto
      ? ['OBS: arquivo de substituicao, gerado sem inconsistencias.']
      : ['OBS: 10.21 - enviar a remessa 005 antes da 004 reproduz o problema de sequencia.']),
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
    sequencia: '5',
    substituto: Boolean(opcoes.substituto),
  }
}