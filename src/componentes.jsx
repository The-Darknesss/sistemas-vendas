// Pecas visuais da tela. Poucas, deliberadamente: o valor e o protagonista e
// o rotulo fica recessivo. Cor de status nunca carrega significado sozinha.

// Numero grande com rotulo pequeno embaixo.
export function Numero({ rotulo, valor, tom = 'neutro' }) {
  const cor = {
    neutro: 'text-stone-900',
    good: 'text-status-good',
    critical: 'text-status-critical',
  }[tom]
  return (
    <div>
      <p className={`text-3xl font-semibold tabular-nums ${cor}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-stone-500">{rotulo}</p>
    </div>
  )
}

// Parte-do-todo: processados + rejeitados = total.
export function Barra({ processados, rejeitados }) {
  const total = processados + rejeitados
  if (total === 0) return null
  return (
    <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-stone-200">
      {processados > 0 && (
        <div
          className="h-full rounded-full bg-status-good"
          style={{ width: `${(processados / total) * 100}%` }}
        />
      )}
      {rejeitados > 0 && <div className="h-full flex-1 rounded-full bg-status-critical" />}
    </div>
  )
}

// Bloco que abre e fecha - guarda o detalhe sem ocupar a tela.
export function Detalhe({ titulo, contador, children }) {
  return (
    <details className="group border-t border-stone-200 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-stone-600 hover:text-stone-900">
        <span className="text-stone-400 transition group-open:rotate-90">▸</span>
        {titulo}
        {contador !== undefined && <span className="text-stone-400">({contador})</span>}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

export function Rotulo({ children }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">{children}</h2>
  )
}
