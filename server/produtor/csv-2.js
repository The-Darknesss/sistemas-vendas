import { stringify } from 'csv-stringify'
import { COLUNAS } from '../contrato.js'
import { gerarVendas } from './dados.js'
import { nomeRemessa, publicarRemessa } from './arquivos.js'

// Remessa 002 - arquivo VALIDO (dados aleatorios novos a cada geracao).
export async function gerarCsv2(opcoes = {}) {
  const linhas = gerarVendas()
  const total = linhas.length

  const csv = await new Promise((resolve, reject) => {
    stringify(
      linhas,
      {
        header: true,
        columns: COLUNAS.map((coluna) => ({ key: coluna, header: coluna })),
        delimiter: ';',
        record_delimiter: '\n',
      },
      (err, saida) => (err ? reject(err) : resolve(saida)),
    )
  })

  const arquivo = nomeRemessa('vendas-002.csv', opcoes.substituto)
  const { caminho, remessa, arquivoControle, controle } = await publicarRemessa(
    arquivo,
    csv,
    total,
    '2',
    opcoes,
  )

  return {
    arquivo,
    caminho,
    conteudo: csv,
    registros: total,
    remessa,
    arquivo_controle: arquivoControle,
    controle,
    sequencia: '2',
    substituto: Boolean(opcoes.substituto),
  }
}