import { stringify } from 'csv-stringify'
import { COLUNAS } from '../contrato.js'
import { gerarVendas } from './dados.js'
import { nomeRemessa, publicarRemessa } from './arquivos.js'

// Remessa 001 - arquivo VALIDO (dados aleatorios novos a cada geracao).
// csv-stringify aplica o delimitador ';', quebra '\n' e o quoting automatico
// (aspas apenas quando o campo contem delimitador/aspas/quebra de linha).
export async function gerarCsv1(opcoes = {}) {
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

  const arquivo = nomeRemessa('vendas-001.csv', opcoes.substituto)
  const { caminho, remessa, arquivoControle, controle } = await publicarRemessa(
    arquivo,
    csv,
    total,
    '1',
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
    sequencia: '1',
    substituto: Boolean(opcoes.substituto),
  }
}