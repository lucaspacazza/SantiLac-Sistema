import { Filter, RefreshCcw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { rotasApi, type RotaResumo } from '../../api/rotasApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'
import { formatDateTime, formatKm, formatLitros } from './formatters'

type Props = {
  onOpen: (uuid: string) => void
}

export function ListagemRotas({ onOpen }: Props) {
  const [rotas, setRotas] = useState<RotaResumo[]>([])
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingOverlayVisible = useLoadingOverlayVisible(loading)

  async function carregar() {
    setLoading(true)
    setError(null)
    try {
      setRotas(await rotasApi.listar({ q, status, inicio, fim }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as rotas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  return (
    <section className="page">
      {loadingOverlayVisible ? <LoadingOverlay message="Carregando rotas..." /> : null}

      <div className="page-head">
        <div>
          <h1>Rotas</h1>
          <p>Histórico operacional das rotas do app de coletas.</p>
        </div>
        <button className="icon-btn" type="button" onClick={carregar} title="Atualizar">
          <RefreshCcw size={16} />
        </button>
      </div>

      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault()
          void carregar()
        }}
      >
        <label className="field coletas-search-field">
          <span>Busca</span>
          <div className="coletas-input-with-icon">
            <Search size={15} />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Rota ou motorista" />
          </div>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="aberta">Aberta</option>
            <option value="finalizada">Finalizada</option>
          </select>
        </label>
        <label className="field">
          <span>Início</span>
          <input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} />
        </label>
        <label className="field">
          <span>Fim</span>
          <input type="date" value={fim} onChange={(event) => setFim(event.target.value)} />
        </label>
        <button className="btn primary" type="submit">
          <Filter size={15} />
          Filtrar
        </button>
      </form>

      <div className={`status-line ${error ? 'is-error' : loading ? 'is-loading' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? (loading ? 'Carregando rotas...' : `${rotas.length.toLocaleString('pt-BR')} rota(s) encontrada(s).`)}</span>
      </div>

      <div className="route-list" role="list">
        {rotas.map((rota) => (
          <button className="route-row" type="button" key={rota.uuid} onClick={() => onOpen(rota.uuid)}>
            <span className="route-main">
              <small>Data</small>
              <strong>{formatDateTime(rota.inicio)}</strong>
            </span>
            <span className="route-main">
              <small>Motorista</small>
              <strong>{rota.motorista_nome || '-'}</strong>
            </span>
            <span className="route-metric">
              <small>Km</small>
              <strong>{formatKm(rota.km_rodado)}</strong>
            </span>
            <span className="route-metric">
              <small>Litros</small>
              <strong>{formatLitros(rota.total_litros)}</strong>
            </span>
            <span className="route-metric">
              <small>Coletas</small>
              <strong>{rota.total_coletas.toLocaleString('pt-BR')}</strong>
            </span>
          </button>
        ))}

        {!loading && rotas.length === 0 && (
          <div className="empty-row">Nenhuma rota encontrada para os filtros informados.</div>
        )}
      </div>
    </section>
  )
}
