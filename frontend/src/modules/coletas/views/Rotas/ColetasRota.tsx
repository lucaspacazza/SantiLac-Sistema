import { ArrowLeft, MapPinned, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { rotasApi, type ColetaRota, type RotaResumo } from '../../api/rotasApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'
import { formatDateTime, formatLitros, formatNumber } from './formatters'

type Props = {
  uuid: string
  onBack: () => void
  onOpenMapa: () => void
  onOpenColeta: (id: number) => void
}

export function ColetasRota({ uuid, onBack, onOpenMapa, onOpenColeta }: Props) {
  const [rota, setRota] = useState<RotaResumo | null>(null)
  const [coletas, setColetas] = useState<ColetaRota[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingOverlayVisible = useLoadingOverlayVisible(loading)

  const filtradas = useMemo(() => {
    const termo = q.trim().toLowerCase()
    if (!termo) return coletas
    return coletas.filter((coleta) => {
      return coleta.produtor_nome.toLowerCase().includes(termo)
        || coleta.produtor_codigo.toLowerCase().includes(termo)
        || coleta.usuario.toLowerCase().includes(termo)
    })
  }, [coletas, q])

  async function carregar() {
    setLoading(true)
    setError(null)
    try {
      const result = await rotasApi.coletas(uuid)
      setRota(result.rota)
      setColetas(result.coletas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'NÃ£o foi possÃ­vel carregar as coletas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [uuid])

  return (
    <section className="page">
      {loadingOverlayVisible ? <LoadingOverlay message="Carregando coletas..." /> : null}

      <div className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}>
            <ArrowLeft size={15} />
            Voltar
          </button>
          <h1>Coletas da rota</h1>
          <p>{rota ? `Rota ${rota.rota_nome} Â· ${formatLitros(rota.total_litros)}` : 'Registros enviados pelo app mobile.'}</p>
        </div>
        <div className="actions">
          <button className="icon-btn" type="button" onClick={carregar} title="Atualizar">
            <RefreshCcw size={16} />
          </button>
          <button className="btn primary" type="button" onClick={onOpenMapa}>
            <MapPinned size={15} />
            Mapa
          </button>
        </div>
      </div>

      <div className="filters single">
        <label className="field coletas-search-field">
          <span>Busca</span>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Produtor, cÃ³digo ou usuÃ¡rio" />
        </label>
      </div>

      <div className={`status-line ${error ? 'is-error' : loading ? 'is-loading' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? (loading ? 'Carregando coletas...' : `${filtradas.length.toLocaleString('pt-BR')} produtor(es) exibido(s).`)}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produtor</th>
              <th>Data e hora</th>
              <th className="num">Litros</th>
              <th className="num">Temperatura</th>
              <th>UsuÃ¡rio</th>
              <th>ObservaÃ§Ã£o</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((coleta) => (
              <tr
                className="clickable-row"
                key={coleta.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenColeta(coleta.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpenColeta(coleta.id)
                  }
                }}
              >
                <td>
                  <strong>{coleta.produtor_nome || '-'}</strong>
                  <small>CÃ³digo {coleta.produtor_codigo}</small>
                </td>
                <td>{formatDateTime(coleta.datahora)}</td>
                <td className="num">{formatLitros(coleta.litros)}</td>
                <td className="num">{coleta.temperatura === null ? '-' : `${formatNumber(coleta.temperatura, 1)} Â°C`}</td>
                <td>{coleta.usuario || '-'}</td>
                <td>{coleta.observacoes || '-'}</td>
              </tr>
            ))}
            {!loading && filtradas.length === 0 && (
              <tr>
                <td className="empty-row" colSpan={6}>Nenhuma coleta encontrada para esta rota.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
