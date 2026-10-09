import express from 'express'
import cors from 'cors'
import { gerarCsv1 } from './produtor/csv-1.js'
import { gerarCsv2 } from './produtor/csv-2.js'
import { gerarCsv3 } from './produtor/csv-3.js'
import { gerarCsv4 } from './produtor/csv-4.js'
import { gerarCsv5 } from './produtor/csv-5.js'
import { validarArquivoClientes } from './consumidor/validador.js'
import { listarClientes, listarRemessas, totalClientes } from './consumidor/banco.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
// Os arquivos CSV chegam inteiros no corpo da requisicao.
app.use(express.json({ limit: '25mb' }))

// Sistema Produtor: gera um dos 5 arquivos de remessa (1 e 2 validos,
// 3, 4 e 5 com inconsistencias). Cada chamada gera dados aleatorios novos.
const GERADORES = {
  '1': gerarCsv1,
  '2': gerarCsv2,
  '3': gerarCsv3,
  '4': gerarCsv4,
  '5': gerarCsv5,
}

// `?substituto=true&motivo=...` produz o arquivo de substituicao do item 15.8,
// para quando o consumidor rejeita a remessa por erro de estrutura.
app.post('/api/gerar-csv/:numero', async (req, res) => {
  const gerador = GERADORES[req.params.numero]
  if (!gerador) {
    return res.status(400).json({ erro: 'Numero invalido. Use 1 a 5.' })
  }
  try {
    const resultado = await gerador({
      substituto: req.query.substituto === 'true',
      motivo: req.query.motivo,
    })
    const rotulo = resultado.substituto ? 'de substituicao gerado' : 'gerado'
    res.json({ mensagem: `Arquivo "${resultado.arquivo}" ${rotulo} com sucesso.`, ...resultado })
  } catch (err) {
    res.status(err.status || 500).json({ erro: err.message })
  }
})

// Sistema Consumidor: recebe e valida o arquivo de clientes do Grupo 1.
// `reprocessamento: true` marca o reenvio de um arquivo corrigido (item 21):
// o controle de sequencia nao se aplica e os validos atualizam o cadastro.
app.post('/api/validar', async (req, res) => {
  const { nome_arquivo, csv, reprocessamento } = req.body || {}
  if (!nome_arquivo || typeof csv !== 'string' || csv.trim() === '') {
    return res.status(400).json({ erro: 'Envie { nome_arquivo, csv } com o conteudo do arquivo.' })
  }
  try {
    const resultado = await validarArquivoClientes(nome_arquivo, csv, {
      reprocessamento: Boolean(reprocessamento),
    })
    const rotulo = resultado.reprocessamento ? 'reprocessado' : 'recebido e validado'
    res.json({ mensagem: `Arquivo ${rotulo}.`, ...resultado })
  } catch (err) {
    // Rejeicao total: o relatorio de processamento tambem volta na resposta.
    res.status(err.status || 500).json({ erro: err.message, relatorio: err.relatorio })
  }
})

// Resultado da integracao (item 16.9): o que foi efetivamente gravado.
app.get('/api/clientes', (req, res) => {
  try {
    res.json({
      total: totalClientes(),
      clientes: listarClientes(Number(req.query.limite) || 50),
      remessas: listarRemessas(),
    })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

const server = app.listen(PORT, () => {
  console.log(`API do Sistema de Vendas rodando em http://localhost:${PORT}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `ERRO: a porta ${PORT} ja esta em uso. Encerre o outro processo do sistema ` +
        `(ex.: pkill -f "node server/index.js") e rode "npm run dev" novamente.`,
    )
    process.exit(1)
  }
  console.error(err)
  process.exit(1)
})
