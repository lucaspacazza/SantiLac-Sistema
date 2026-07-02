import { useEffect, useMemo, useState } from 'react'
import { rotasApi, type LeiteResumoMensal, type LeiteResumoMes } from '../../api/rotasApi'
import { formatLitros } from '../Rotas/formatters'

export function LeiteInicio() {
  const [resumo, setResumo] = useState<LeiteResumoMensal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setError(null)
      try {
        setResumo(await rotasApi.resumoMensal())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar o resumo do leite.')
      } finally {
        setLoading(false)
      }
    }

    void carregar()
  }, [])

  const maxLitros = useMemo(() => Math.max(...(resumo?.serie.map((item) => item.litros) ?? [0]), 1), [resumo])

  return (
    <section className="page leite-inicio" aria-label="Leite">
      <div className="page-head">
        <div>
          <h1>Leite</h1>
          <p>Resumo mensal do volume coletado.</p>
        </div>
      </div>

      <div className={`status-line ${error ? 'is-error' : loading ? 'is-loading' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? (loading ? 'Carregando resumo...' : 'Resumo atualizado.')}</span>
      </div>

      <div className="leite-kpis">
        <ResumoCard titulo="Mês atual" item={resumo?.mes_atual} />
        <ResumoCard titulo="Mês anterior" item={resumo?.mes_anterior} />
      </div>

      <section className="leite-chart" aria-label="Volume coletado por mês">
        <div className="leite-section-head">
          <h2>Volume por mês</h2>
          <span>{resumo?.serie.length ? `${resumo.serie.length} mês(es)` : 'Sem registros'}</span>
        </div>

        <div className="leite-bars">
          {(resumo?.serie ?? []).map((item) => (
            <div className="leite-bar-item" key={item.mes}>
              <span className="leite-bar-value">{formatLitros(item.litros)}</span>
              <div className="leite-bar-track" title={`${mesLabel(item.mes)} · ${formatLitros(item.litros)}`}>
                <span style={{ height: `${Math.max((item.litros / maxLitros) * 100, item.litros > 0 ? 6 : 0)}%` }} />
              </div>
              <small>{mesCurto(item.mes)}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}

function ResumoCard({ titulo, item }: { titulo: string; item: LeiteResumoMes | undefined }) {
  return (
    <article className="leite-card">
      <span className="leite-marker" />
      <div>
        <small>{titulo}</small>
        <strong>{formatLitros(item?.litros)}</strong>
        <em>{item ? `${item.coletas.toLocaleString('pt-BR')} coleta(s)` : '-'}</em>
      </div>
    </article>
  )
}

function mesLabel(value: string) {
  const [ano, mes] = value.split('-').map(Number)
  if (!ano || !mes) return value
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(ano, mes - 1, 1))
}

function mesCurto(value: string) {
  const [ano, mes] = value.split('-').map(Number)
  if (!ano || !mes) return value
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(ano, mes - 1, 1)).replace('.', '')
}
