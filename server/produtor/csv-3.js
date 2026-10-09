import { COLUNAS } from '../contrato.js'
import { gerarVendas } from './dados.js'
import { aplicarInconsistencias } from './injecoes.js'
import { registrarLogInconsistencias } from './remessa.js'
import { nomeRemessa, publicarRemessa } from './arquivos.js'

// Remessa 003 - inconsistencias do professor (itens 10.11, 10.16 e 10.13),
// intercaladas entre registros validos.
const INJECOES = [
  {
    tipo: '10.11 valor numerico em formato diferente',
    linha: 6,
    detalhe: 'valor_unitario=1250,50 (virgula em vez de ponto)',
    aplicar: (r) => {
      r.valor_unitario = '1250,50'
    },
  },
  {
    tipo: '10.16 espacos indevidos',
    linha: 41,
    detalhe: 'espacos em volta do delimitador (" ; ")',
    aplicar: (r) => {
      r.__espacos = true
    },
  },
  {
    tipo: '10.13 registro duplicado',
    linha: 65,
    detalhe: 'id_venda repetido (mesma chave da linha 2)',
    aplicar: (r, base) => {
      r.id_venda = base[0].id_venda
    },
  },
]

export async function gerarCsv3(opcoes = {}) {
  const base = gerarVendas()
  const total = base.length
  // Item 15.8: o arquivo de substituicao sai CORRIGIDO, sem as injecoes - e
  // ele que substitui a remessa rejeitada pelo consumidor.
  const injecoes = opcoes.substituto ? [] : INJECOES
  const { linhas, erros } = aplicarInconsistencias(base, injecoes)
  const csv = COLUNAS.join(';') + '\n' + linhas.join('\n') + '\n'

  const arquivo = nomeRemessa('vendas-003.csv', opcoes.substituto)
  const { caminho, remessa, dataHora, arquivoControle, controle } = await publicarRemessa(
    arquivo,
    csv,
    total,
    '3',
    opcoes,
  )

  await registrarLogInconsistencias([
    `[${dataHora}] arquivo=${arquivo} registros=${total} inconsistencias=${erros.length} remessa=${remessa} sequencia=3`,
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
    sequencia: '3',
    substituto: Boolean(opcoes.substituto),
  }
}