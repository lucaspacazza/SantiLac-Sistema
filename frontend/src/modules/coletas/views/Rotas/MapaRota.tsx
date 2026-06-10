import L from 'leaflet'
import { ArrowLeft, ClipboardList, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { rotasApi, type ColetaRota, type GpsPonto, type RotaResumo } from '../../api/rotasApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'
import { formatDateTime, formatKm, formatKmh, formatLitros, formatNumber } from './formatters'

type Props = {
  uuid: string
  onBack: () => void
  onOpenColetas: () => void
}

export function MapaRota({ uuid, onBack, onOpenColetas }: Props) {
  const mapNode = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [rota, setRota] = useState<RotaResumo | null>(null)
  const [gps, setGps] = useState<GpsPonto[]>([])
  const [coletas, setColetas] = useState<ColetaRota[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingOverlayVisible = useLoadingOverlayVisible(loading)

  const coletasComPonto = useMemo(() => {
    return coletas.filter((coleta) => coleta.casa_lat !== null && coleta.casa_lng !== null)
  }, [coletas])

  async function carregar() {
    setLoading(true)
    setError(null)
    try {
      const [detalhe, coletasResult] = await Promise.all([
        rotasApi.detalhe(uuid),
        rotasApi.coletas(uuid),
      ])
      setRota(detalhe.rota)
      setGps(detalhe.gps)
      setColetas(coletasResult.coletas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o mapa.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [uuid])

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return
    const map = L.map(mapNode.current, { zoomControl: true, maxZoom: 21 }).setView([-24.9555, -53.4552], 12)
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxNativeZoom: 19,
      maxZoom: 21,
    })
    const satelliteImageLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 18,
        maxZoom: 21,
      },
    )
    const satelliteLabelsLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Labels &copy; Esri',
        maxNativeZoom: 18,
        maxZoom: 21,
      },
    )
    const satelliteLayer = L.layerGroup([satelliteImageLayer, satelliteLabelsLayer])

    streetLayer.addTo(map)
    L.control.layers(
      {
        Mapa: streetLayer,
        Satélite: satelliteLayer,
      },
      undefined,
      {
        collapsed: false,
        position: 'topright',
      },
    ).addTo(map)

    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    const points = gps.map((point) => L.latLng(point.lat, point.lng))
    const coletaPoints = coletasComPonto.map((coleta) => ({
      coleta,
      point: L.latLng(coleta.casa_lat as number, coleta.casa_lng as number),
    }))

    if (points.length === 0 && coletaPoints.length === 0) {
      map.setView([-24.9555, -53.4552], 12)
      return
    }

    const bounds = L.latLngBounds([])

    if (points.length > 0) {
      L.polyline(points, { color: '#000', weight: 8, opacity: 0.55 }).addTo(layer)
      const line = L.polyline(points, { color: '#21c37a', weight: 4, opacity: 0.95 })
      line.addTo(layer)
      addRouteHover(layer, map, gps, points)
      points.forEach((point) => bounds.extend(point))

      L.circleMarker(points[0], {
        radius: 6,
        color: '#21c37a',
        fillColor: '#21c37a',
        fillOpacity: 1,
      }).bindTooltip('Início').addTo(layer)

      L.circleMarker(points[points.length - 1], {
        radius: 6,
        color: '#ff4d65',
        fillColor: '#ff4d65',
        fillOpacity: 1,
      }).bindTooltip('Fim').addTo(layer)
    }

    coletaPoints.forEach(({ coleta, point }) => {
      bounds.extend(point)
      L.circleMarker(point, {
        radius: 7,
        color: '#000',
        weight: 2,
        fillColor: '#f5bd41',
        fillOpacity: 0.95,
      })
        .bindPopup(`
          <strong>${escapeHtml(coleta.produtor_nome || 'Produtor')}</strong>
          <span>Código ${escapeHtml(coleta.produtor_codigo)}</span>
          <span>${formatLitros(coleta.litros)} · ${formatDateTime(coleta.datahora)}</span>
          <span>Precisão ${coleta.casa_accuracy_m === null ? '-' : `${formatNumber(coleta.casa_accuracy_m, 1)} m`}</span>
        `)
        .addTo(layer)
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28] })
    }
  }, [gps, coletasComPonto])

  return (
    <section className="page map-page">
      {loadingOverlayVisible ? <LoadingOverlay message="Carregando GPS..." /> : null}

      <div className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}>
            <ArrowLeft size={15} />
            Voltar
          </button>
          <h1>Mapa da rota</h1>
          <p>{rota ? `Rota ${rota.rota_nome} · ${formatDateTime(rota.inicio)}` : 'Traçado GPS da rota.'}</p>
        </div>
        <div className="actions">
          <button className="icon-btn" type="button" onClick={carregar} title="Atualizar">
            <RefreshCcw size={16} />
          </button>
          <button className="btn primary" type="button" onClick={onOpenColetas}>
            <ClipboardList size={15} />
            Coletas
          </button>
        </div>
      </div>

      <div className={`status-line ${error ? 'is-error' : loading ? 'is-loading' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? (loading ? 'Carregando GPS...' : `${gps.length.toLocaleString('pt-BR')} ponto(s) GPS · ${coletasComPonto.length.toLocaleString('pt-BR')} casa(s) no mapa · ${formatKm(rota?.km_rodado ?? null)}`)}</span>
      </div>

      <div className="map-shell">
        <div className="map-legend">
          <span><i className="legend-line" /> Rota</span>
          <span><i className="legend-start" /> Início</span>
          <span><i className="legend-end" /> Fim</span>
          <span><i className="legend-home" /> Casa do produtor</span>
        </div>
        <div ref={mapNode} className="route-map" />
        {!loading && gps.length === 0 && coletasComPonto.length === 0 && <div className="map-empty">Nenhum ponto GPS gravado para esta rota.</div>}
      </div>
    </section>
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function addRouteHover(layer: L.LayerGroup, map: L.Map, gps: GpsPonto[], points: L.LatLng[]) {
  const cumulativeKm = buildCumulativeKm(points)
  const hoverLine = L.polyline(points, {
    color: '#fff',
    weight: 22,
    opacity: 0,
    interactive: true,
  }).addTo(layer)
  const marker = L.circleMarker(points[0], {
    radius: 5,
    color: '#ffffff',
    weight: 2,
    fillColor: '#21c37a',
    fillOpacity: 1,
    opacity: 0,
    interactive: false,
  }).addTo(layer)
  const tooltip = L.tooltip({
    className: 'route-hover-tooltip',
    direction: 'top',
    offset: [0, -10],
    opacity: 1,
    sticky: false,
  })

  hoverLine.on('mousemove', (event: L.LeafletMouseEvent) => {
    const index = nearestPointIndex(map, event.latlng, points)
    const point = points[index]
    marker.setLatLng(point)
    marker.setStyle({ opacity: 1 })
    tooltip
      .setLatLng(point)
      .setContent(routeHoverContent(gps, cumulativeKm, index))
      .openOn(map)
  })

  hoverLine.on('mouseout', () => {
    marker.setStyle({ opacity: 0 })
    map.closeTooltip(tooltip)
  })
}

function routeHoverContent(gps: GpsPonto[], cumulativeKm: number[], index: number) {
  const point = gps[index]
  const speed = speedKmhAt(gps, index)
  return `
    <strong>${formatKm(cumulativeKm[index])}</strong>
    <span>Velocidade ${formatKmh(speed)}</span>
    <span>${formatDateTime(point?.ts)}</span>
  `
}

function buildCumulativeKm(points: L.LatLng[]) {
  const cumulative = [0]
  for (let index = 1; index < points.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + haversineKm(points[index - 1], points[index])
  }
  return cumulative
}

function nearestPointIndex(map: L.Map, latlng: L.LatLng, points: L.LatLng[]) {
  const cursor = map.latLngToLayerPoint(latlng)
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  points.forEach((point, index) => {
    const distance = cursor.distanceTo(map.latLngToLayerPoint(point))
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return nearestIndex
}

function speedKmhAt(gps: GpsPonto[], index: number) {
  const current = gps[index]
  if (current?.speed_mps !== null && current?.speed_mps !== undefined) {
    return current.speed_mps * 3.6
  }

  const previous = gps[index - 1]
  if (!previous || !current) return null

  const previousTime = new Date(previous.ts.replace(' ', 'T')).getTime()
  const currentTime = new Date(current.ts.replace(' ', 'T')).getTime()
  if (Number.isNaN(previousTime) || Number.isNaN(currentTime) || currentTime <= previousTime) return null

  const distanceKm = haversineKm(L.latLng(previous.lat, previous.lng), L.latLng(current.lat, current.lng))
  return (distanceKm / ((currentTime - previousTime) / 1000)) * 3600
}

function haversineKm(a: L.LatLng, b: L.LatLng) {
  const earthRadiusKm = 6371
  const dLat = degreesToRadians(b.lat - a.lat)
  const dLng = degreesToRadians(b.lng - a.lng)
  const lat1 = degreesToRadians(a.lat)
  const lat2 = degreesToRadians(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return earthRadiusKm * 2 * Math.asin(Math.sqrt(h))
}

function degreesToRadians(value: number) {
  return value * (Math.PI / 180)
}
