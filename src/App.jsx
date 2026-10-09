import { useCallback, useEffect, useState } from 'react'
import { Barra, Detalhe, Numero, Rotulo } from './componentes.jsx'

const API_BASE = '/api'
const REMESSAS = ['001', '002', '003', '004', '005']

function baixarArquivo(nome, conteudo) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [aviso, setAviso] = useState(null)
  const [gerando, setGerando] = useState(null)
  const [substituto, setSubstituto] = useState(false)

  const [arquivo, setArquivo] = useState(null)
  const [validando, setValidando] = useState(false)
  const [reprocessar, setReprocessar] = useState(false)
  const [resultado, setResultado] = useState(null)

  const [base, setBase] = useState(null)

  const carregarBase = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/clientes?limite=10`)
      if (res.ok) setBase(await res.json())
    } catch {
      // API ainda nao subiu; a secao simplesmente nao aparece
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line set-state-in-effect
    carregarBase()
  }, [carregarBase])

  const gerar = async (n) => {
    setAviso(null)
    setGerando(n)
    try {
      const qs = substituto ? '?substituto=true&motivo=remessa+rejeitada+pelo+consumidor' : ''
      const res = await fetch(`${API_BASE}/gerar-csv/${Number(n)}${qs}`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.erro)
      baixarArquivo(d.arquivo, d.conteudo)
      if (d.controle) baixarArquivo(d.arquivo_controle, d.controle)
      const inc = d.inconsistencias !== undefined ? ` · ${d.inconsistencias} inconsistências` : ''
      setAviso({ tipo: 'ok', texto: `${d.arquivo} · ${d.registros} registros${inc}` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setGerando(null)
    }
  }

  const validar = async () => {
    setAviso(null)
    setResultado(null)
    if (!arquivo) return setAviso({ tipo: 'erro', texto: 'Escolha um arquivo primeiro.' })
    setValidando(true)
    try {
      const csv = await arquivo.text()
      const res = await fetch(`${API_BASE}/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_arquivo: arquivo.name, csv, reprocessamento: reprocessar }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.erro)
      setResultado(d)
      carregarBase()
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setValidando(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-stone-900">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <header>
          <h1 className="text-xl font-semibold">Sistema de Vendas</h1>
          <p className="mt-1 text-sm text-stone-500">
            Grupo 1 → <span className="text-stone-900">Vendas</span> → Grupo 3 · integração por CSV
          </p>
        </header>

        {aviso && (
          <p
            className={`mt-8 border-l-2 py-1 pl-3 font-mono text-xs ${
              aviso.tipo === 'erro'
                ? 'border-status-critical text-status-critical'
                : 'border-status-good text-stone-600'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {/* ------------------------------------------------------------ PRODUZIR */}
        <section className="mt-12">
          <Rotulo>Produzir</Rotulo>
          <div className="mt-4 flex flex-wrap gap-2">
            {REMESSAS.map((n) => (
              <button
                key={n}
                onClick={() => gerar(n)}
                disabled={gerando !== null}
                className="rounded-md border border-stone-300 px-4 py-2 font-mono text-sm transition hover:border-stone-900 hover:bg-stone-900 hover:text-white disabled:opacity-40"
              >
                {gerando === n ? '···' : n}
              </button>
            ))}
          </div>
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-stone-500 hover:text-stone-900">
            <input
              type="checkbox"
              checked={substituto}
              onChange={(e) => setSubstituto(e.target.checked)}
              className="size-3.5 accent-stone-900"
            />
            gerar como arquivo de substituição
          </label>
        </section>

        {/* ------------------------------------------------------------ CONSUMIR */}
        <section className="mt-12">
          <Rotulo>Consumir</Rotulo>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setArquivo(e.target.files[0] || null)}
              className="max-w-full text-sm text-stone-500 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-stone-700 hover:file:border-stone-900"
            />
            <button
              onClick={validar}
              disabled={validando}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
            >
              {validando ? '···' : reprocessar ? 'reprocessar' : 'validar'}
            </button>
          </div>
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-stone-500 hover:text-stone-900">
            <input
              type="checkbox"
              checked={reprocessar}
              onChange={(e) => setReprocessar(e.target.checked)}
              className="size-3.5 accent-stone-900"
            />
            é um arquivo corrigido (reprocessar)
          </label>

          {resultado && (
            <div className="mt-8">
              <p className="font-mono text-xs text-stone-500">{resultado.nome_arquivo}</p>

              <div className="mt-4 flex gap-10">
                <Numero rotulo="recebidos" valor={resultado.total} />
                <Numero rotulo="processados" valor={resultado.processados} tom="good" />
                <Numero rotulo="rejeitados" valor={resultado.rejeitados} tom="critical" />
              </div>

              <div className="mt-4">
                <Barra processados={resultado.processados} rejeitados={resultado.rejeitados} />
              </div>

              <p className="mt-3 text-sm text-stone-600">
                {resultado.conforme ? 'Conforme o contrato.' : 'Não conforme o contrato.'}{' '}
                {resultado.banco.inseridos} novos e {resultado.banco.atualizados} atualizados no
                banco.
              </p>

              <div className="mt-6">
                {resultado.erros.length > 0 && (
                  <Detalhe titulo="Erros encontrados" contador={resultado.erros.length}>
                    <ul className="max-h-72 space-y-1.5 overflow-auto font-mono text-xs text-stone-600">
                      {resultado.erros.map((e, i) => (
                        <li key={`${e.linha}-${i}`}>
                          <span className="text-stone-400">linha {e.linha}</span> ·{' '}
                          {e.motivos.join(' · ')}
                        </li>
                      ))}
                    </ul>
                    {resultado.rejeitados_csv && (
                      <button
                        onClick={() =>
                          baixarArquivo(resultado.arquivo_rejeitados, resultado.rejeitados_csv)
                        }
                        className="mt-3 text-xs text-stone-500 underline underline-offset-4 hover:text-stone-900"
                      >
                        baixar rejeitados.csv
                      </button>
                    )}
                  </Detalhe>
                )}

                {[...(resultado.observacoes || []), ...(resultado.desvios || [])].length > 0 && (
                  <Detalhe
                    titulo="Observações"
                    contador={resultado.observacoes.length + resultado.desvios.length}
                  >
                    <ul className="space-y-2 text-xs leading-relaxed text-stone-600">
                      {[...resultado.observacoes, ...resultado.desvios].map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  </Detalhe>
                )}

                <Detalhe titulo="Relatório de processamento">
                  <pre className="max-h-96 overflow-auto font-mono text-[11px] leading-relaxed text-stone-600">
                    {resultado.relatorio}
                  </pre>
                </Detalhe>
              </div>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- RESULTADO */}
        {base && base.total > 0 && (
          <section className="mt-12">
            <Rotulo>Base integrada</Rotulo>
            <div className="mt-4">
              <Numero rotulo="clientes gravados" valor={base.total} />
            </div>
            <div className="mt-6">
              <Detalhe titulo="Remessas recebidas" contador={base.remessas.length}>
                <table className="w-full font-mono text-xs">
                  <tbody className="text-stone-600">
                    {base.remessas.map((r) => (
                      <tr key={r.remessa} className="border-b border-stone-100 last:border-0">
                        <td className="py-1.5 pr-4">{r.arquivo}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">+{r.inseridos}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-stone-400">
                          ~{r.atualizados}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-stone-400">
                          −{r.rejeitados}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Detalhe>
              <Detalhe titulo="Clientes" contador={base.total}>
                <table className="w-full font-mono text-xs">
                  <tbody className="text-stone-600">
                    {base.clientes.map((c) => (
                      <tr key={c.id_cliente} className="border-b border-stone-100 last:border-0">
                        <td className="w-12 py-1.5 tabular-nums text-stone-400">{c.id_cliente}</td>
                        <td className="py-1.5 pr-4">{c.nome}</td>
                        <td className="py-1.5 text-stone-400">{c.cidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Detalhe>
            </div>
          </section>
        )}

        <footer className="mt-16 text-xs text-stone-400">
          Paulo Eduardo · Joao Pedro Azevedo · Hyago Fernandes
        </footer>
      </div>
    </div>
  )
}

export default App
