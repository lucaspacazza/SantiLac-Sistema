import L from 'leaflet'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { rotasApi, type ColetaRota } from '../../api/rotasApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'
import { formatDateTime, formatLitros, formatNumber } from './formatters'

type Props = {
  id: number
  onBack: () => void
  onOpenColeta: (id: number) => void
}

export function ColetaDetalheRota({ id, onBack, onOpenColeta }: Props) {
  const [coleta, setColeta] = useState<ColetaRota | null>(null)
  const [ultimasColetas, setUltimasColetas] = useState<ColetaRota[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingOverlayVisible = useLoadingOverlayVisible(loading)

  async function carregar() {
    setLoading(true)
    setError(null)
    try {
      const result = await rotasApi.coletaDetalhe(id)
      setColeta(result.coleta)
      setUltimasColetas(result.ultimas_coletas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a coleta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [id])

  return (
    <section className="page">
      {loadingOverlayVisible ? <LoadingOverlay message="Carregando coleta..." /> : null}

      <div className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}>
            <ArrowLeft size={15} />
            Voltar
          </button>
          <h1>Detalhe da coleta</h1>
          <p>{coleta ? `${coleta.produtor_nome || 'Produtor'} · ${formatDateTime(coleta.datahora)}` : 'Registro enviado pelo app mobile.'}</p>
        </div>
        <button className="icon-btn" type="button" onClick={carregar} title="Atualizar">
          <RefreshCcw size={16} />
        </button>
      </div>

      <div className={`status-line ${error ? 'is-error' : loading ? 'is-loading' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? (loading ? 'Carregando coleta...' : 'Coleta carregada.')}</span>
      </div>

      {coleta ? (
        <>
          <div className="summary-grid coleta-summary">
            <Metric label="Produtor" value={coleta.produtor_nome || '-'} />
            <Metric label="Litros" value={formatLitros(coleta.litros)} />
            <Metric label="Tanque" value={coleta.tanque === null ? '-' : String(coleta.tanque)} />
            <Metric label="Temperatura" value={coleta.temperatura === null ? '-' : `${formatNumber(coleta.temperatura, 1)} °C`} />
            <Metric label="Usuário" value={coleta.usuario || '-'} />
          </div>

          <div className="coleta-detail-grid">
            <section className="panel">
              <h2>Coleta</h2>
              <dl className="info-list">
                <Row label="Código" value={coleta.produtor_codigo} />
                <Row label="Data" value={formatDateTime(coleta.datahora)} />
                <Row label="Rota" value={coleta.rota_nome || '-'} />
                <Row label="Tanque" value={coleta.tanque === null ? '-' : String(coleta.tanque)} />
                <Row label="Observação" value={coleta.observacoes || '-'} />
              </dl>
            </section>

            <section className="panel">
              <h2>Ponto registrado</h2>
              <ColetaMiniMapa coleta={coleta} />
            </section>
          </div>

          <section className="panel recent-section">
            <h2>Últimas coletas</h2>
            <div className="recent-list">
              {ultimasColetas.map((item) => (
                <button
                  className={`recent-row ${item.id === id ? 'is-active' : ''}`}
                  key={item.id}
                  type="button"
                  onClick={() => onOpenColeta(item.id)}
                >
                  <span>{formatDateTime(item.datahora)}</span>
                  <strong>{formatLitros(item.litros)}</strong>
                  <span>{item.tanque === null ? '-' : `Tanque ${item.tanque}`}</span>
                  <span>{item.temperatura === null ? '-' : `${formatNumber(item.temperatura, 1)} °C`}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  )
}

function ColetaMiniMapa({ coleta }: { coleta: ColetaRota }) {
  const mapNode = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    if (!mapNode.current || coleta.ponto_lat === null || coleta.ponto_lng === null) return

    const point = L.latLng(coleta.ponto_lat, coleta.ponto_lng)
    const map = L.map(mapNode.current, {
      maxZoom: 21,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView(point, 18)

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 18,
      maxZoom: 21,
    }).addTo(map)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxNativeZoom: 18,
        maxZoom: 21,
      },
    ).addTo(map)

    L.circleMarker(point, {
      radius: 7,
      color: '#000',
      weight: 2,
      fillColor: '#f5bd41',
      fillOpacity: 0.95,
    }).addTo(map)

    mapRef.current = map

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [coleta.ponto_lat, coleta.ponto_lng])

  if (coleta.ponto_lat === null || coleta.ponto_lng === null) {
    return <div className="mini-map-empty">Sem ponto registrado para esta coleta.</div>
  }

  return (
    <div className="mini-map-wrap">
      <div ref={mapNode} className="mini-map" />
      <div className="mini-map-caption">
        {formatNumber(coleta.ponto_lat, 6)}, {formatNumber(coleta.ponto_lng, 6)}
        {coleta.ponto_accuracy_m !== null ? ` · Precisão ${formatNumber(coleta.ponto_accuracy_m, 1)} m` : ''}
      </div>
    </div>
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
