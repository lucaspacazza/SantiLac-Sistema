import { ArrowLeft, ClipboardList, MapPinned, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { rotasApi, type GpsPonto, type RotaResumo } from '../../api/rotasApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'
import { durationLabel, formatDateTime, formatKm, formatKmh, formatLitros, secondsLabel } from './formatters'

type Props = {
  uuid: string
  onBack: () => void
  onOpenMapa: () => void
  onOpenColetas: () => void
}

export function DetalheRota({ uuid, onBack, onOpenMapa, onOpenColetas }: Props) {
  const [rota, setRota] = useState<RotaResumo | null>(null)
  const [gps, setGps] = useState<GpsPonto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingOverlayVisible = useLoadingOverlayVisible(loading)

  async function carregar() {
    setLoading(true)
    setError(null)
    try {
      const result = await rotasApi.detalhe(uuid)
      setRota(result.rota)
      setGps(result.gps)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a rota.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [uuid])

  return (
    <section className="page">
      {loadingOverlayVisible ? <LoadingOverlay message="Carregando detalhes da rota..." /> : null}

      <div className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}>
            <ArrowLeft size={15} />
            Voltar
          </button>
          <h1>Detalhe da rota</h1>
          <p>{rota ? `Rota ${rota.rota_nome} conduzida por ${rota.motorista_nome || '-'}.` : 'Resumo operacional da rota.'}</p>
        </div>
        <div className="actions">
          <button className="icon-btn" type="button" onClick={carregar} title="Atualizar">
            <RefreshCcw size={16} />
          </button>
          <button className="btn" type="button" onClick={onOpenMapa}>
            <MapPinned size={15} />
            Mapa
          </button>
          <button className="btn primary" type="button" onClick={onOpenColetas}>
            <ClipboardList size={15} />
            Coletas
          </button>
        </div>
      </div>

      <div className={`status-line ${error ? 'is-error' : loading ? 'is-loading' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? (loading ? 'Carregando detalhes...' : 'Detalhes carregados.')}</span>
      </div>

      {rota && (
        <>
          <div className="summary-grid">
            <Metric label="Status" value={rota.status_label} />
            <Metric label="Litros coletados" value={formatLitros(rota.total_litros)} />
            <Metric label="Coletas" value={rota.total_coletas.toLocaleString('pt-BR')} />
            <Metric label="Km da rota" value={formatKm(rota.km_rodado)} />
            <Metric label="Pontos GPS" value={gps.length.toLocaleString('pt-BR')} />
          </div>

          <div className="detail-grid">
            <section className="panel">
              <h2>Identificação</h2>
              <dl className="info-list">
                <Row label="UUID" value={rota.uuid} />
                <Row label="Rota" value={rota.rota_nome || '-'} />
                <Row label="Motorista" value={rota.motorista_nome || '-'} />
                <Row label="Caminhão" value={rota.caminhao_nome || '-'} />
                <Row label="Placa" value={rota.placa || '-'} />
              </dl>
            </section>

            <section className="panel">
              <h2>Tempo</h2>
              <dl className="info-list">
                <Row label="Início" value={formatDateTime(rota.inicio)} />
                <Row label="Fim" value={formatDateTime(rota.fim)} />
                <Row label="Duração" value={durationLabel(rota.inicio, rota.fim)} />
                <Row label="Paradas" value={rota.total_paradas.toLocaleString('pt-BR')} />
                <Row label="Tempo parado" value={secondsLabel(rota.tempo_parado_seg)} />
                <Row label="Vel. média" value={formatKmh(rota.velocidade_media_kmh)} />
                <Row label="Vel. máxima" value={formatKmh(rota.velocidade_maxima_kmh)} />
              </dl>
            </section>
          </div>
        </>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}
