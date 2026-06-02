import { ChevronDown, Download, FileImage, FileText, RefreshCcw, Search } from 'lucide-react'
import Plotly from 'plotly.js-dist-min'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Amostra, Coleta } from '../../api/pasteurizadorApi'

const CHANNEL_COLORS: Record<string, string> = {
  'Temp.Pasteuriza': '#f06b2f',
  'Temp.Retardador': '#19d3f3',
  'Agua Quente': '#ffcf5a',
  'Bomba Leite': '#00cc96',
  'Tan.Equilibrio': '#ab63fa',
  'Valvula Desvio': '#ff6692',
  Vazao: '#7dd3fc',
}

const HOVER_TOOLTIP_OFFSET_X = 14
const HOVER_TOOLTIP_EDGE_PADDING = 8

type PlotlyHoverPoint = {
  x: string | number
  y: number
  curveNumber: number
  xaxis?: PlotlyAxis
  yaxis?: PlotlyAxis
  data?: { name?: string }
  fullData?: { name?: string }
  customdata?: Array<string | number | null>
}

type PlotlyAxis = {
  d2l?: (value: string | number) => number
  d2p?: (value: string | number) => number
  l2p?: (value: number) => number
}

type PlotlyHoverEvent = {
  points?: PlotlyHoverPoint[]
}

type PlotlyChartElement = HTMLDivElement & {
  on?: (eventName: 'plotly_hover' | 'plotly_unhover', callback: (event: PlotlyHoverEvent) => void) => void
  removeListener?: (eventName: 'plotly_hover' | 'plotly_unhover', callback: (event: PlotlyHoverEvent) => void) => void
}

type ChartThemeMode = 'dark' | 'light'

function getChartThemeMode(): ChartThemeMode {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function useChartThemeMode() {
  const [themeMode, setThemeMode] = useState<ChartThemeMode>(() => getChartThemeMode())

  useEffect(() => {
    const updateThemeMode = () => setThemeMode(getChartThemeMode())
    updateThemeMode()

    const observer = new MutationObserver(updateThemeMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => observer.disconnect()
  }, [])

  return themeMode
}

export function HistoricoPasteurizacao({
  coletas,
  amostras,
  coletaSelecionada,
  inicio,
  fim,
  horaInicio,
  horaFim,
  canal,
  canaisDisponiveis,
  onInicioChange,
  onFimChange,
  onHoraInicioChange,
  onHoraFimChange,
  onCanalChange,
  onFiltrar,
  onSelecionarColeta,
  onRecarregar,
  exportPdfUrl,
}: {
  coletas: Coleta[]
  amostras: Amostra[]
  coletaSelecionada: Coleta | null
  inicio: string
  fim: string
  horaInicio: string
  horaFim: string
  canal: string
  canaisDisponiveis: string[]
  onInicioChange: (value: string) => void
  onFimChange: (value: string) => void
  onHoraInicioChange: (value: string) => void
  onHoraFimChange: (value: string) => void
  onCanalChange: (value: string) => void
  onFiltrar: () => void
  onSelecionarColeta: (id: number) => void
  onRecarregar: () => void
  exportPdfUrl: string | null
}) {
  const valores = amostras.map((item) => item.valor)
  const valoresCanalSelecionado = canal !== 'Todos' ? amostras.filter((item) => item.canal === canal).map((item) => item.valor) : []
  const valoresTemperatura = amostras.filter((item) => item.canal === 'Temp.Pasteuriza').map((item) => item.valor)
  const valoresEstatisticas = valoresCanalSelecionado.length
    ? valoresCanalSelecionado
    : (valoresTemperatura.length ? valoresTemperatura : valores)
  const minimo = valoresEstatisticas.length ? Math.min(...valoresEstatisticas) : null
  const maximo = valoresEstatisticas.length ? Math.max(...valoresEstatisticas) : null
  const media = valoresEstatisticas.length ? valoresEstatisticas.reduce((total, valor) => total + valor, 0) / valoresEstatisticas.length : null
  const canais = useMemo(() => Array.from(new Set([...canaisDisponiveis, ...amostras.map((item) => item.canal)])), [amostras, canaisDisponiveis])
  const chartRef = useRef<HTMLDivElement | null>(null)
  const imageFileName = `pasteurizador_grafico_${inicio || 'sem_inicio'}_${fim || 'sem_fim'}_${canal}`

  function exportarPng() {
    if (!chartRef.current) return

    void Plotly.downloadImage(chartRef.current, {
      format: 'png',
      filename: imageFileName,
      height: 900,
      width: 1600,
      scale: 1,
    })
  }

  return (
    <div className="stack">
      <section className="panel filters-panel">
        <div className="filter-group">
          <label>
            <span>Dia inicial</span>
            <input className="control" type="date" value={inicio} onChange={(event) => onInicioChange(event.target.value)} />
          </label>
          <label>
            <span>Hora inicial</span>
            <input className="control control-time" type="time" step={1} value={horaInicio} onChange={(event) => onHoraInicioChange(event.target.value)} />
          </label>
          <label>
            <span>Dia final</span>
            <input className="control" type="date" value={fim} onChange={(event) => onFimChange(event.target.value)} />
          </label>
          <label>
            <span>Hora final</span>
            <input className="control control-time" type="time" step={1} value={horaFim} onChange={(event) => onHoraFimChange(event.target.value)} />
          </label>
          <label>
            <span>Canal</span>
            <select className="control" value={canal} onChange={(event) => onCanalChange(event.target.value)}>
              {canais.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button className="btn filter-inline-btn" type="button" onClick={onFiltrar}><Search size={16} />Filtrar</button>
        </div>
        <div className="actions">
          <button className="icon-btn" type="button" onClick={onRecarregar} title="Recarregar"><RefreshCcw size={16} /></button>
        </div>
      </section>

      <section className="panel chart-panel">
        <div className="section-head">
          <div>
            <span className="section-kicker">Gráfico</span>
            <h3>{coletaSelecionada ? `Coleta #${coletaSelecionada.id}` : 'Nenhuma coleta selecionada'}</h3>
          </div>
          <ExportMenu pdfUrl={exportPdfUrl} onExportPng={exportarPng} />
        </div>

        <div className="chart-stats">
          <div><span>Média temp.</span><strong>{media === null ? '-' : `${media.toFixed(2)} C`}</strong></div>
          <div><span>Mínima</span><strong>{minimo === null ? '-' : minimo.toFixed(2)}</strong></div>
          <div><span>Máxima</span><strong>{maximo === null ? '-' : maximo.toFixed(2)}</strong></div>
        </div>

        <PlotlyTemperatureChart
          samples={amostras}
          selectedChannel={canal}
          coleta={coletaSelecionada}
          chartRef={chartRef}
          imageFileName={imageFileName}
        />
      </section>

    </div>
  )
}

function ExportMenu({ pdfUrl, onExportPng }: { pdfUrl: string | null; onExportPng: () => void }) {
  const [open, setOpen] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  async function exportarPdf() {
    if (!pdfUrl || exportingPdf) return

    setOpen(false)
    setExportingPdf(true)

    try {
      const response = await fetch(pdfUrl, {
        credentials: 'same-origin',
        headers: {
          Accept: 'application/pdf',
        },
      })

      if (!response.ok) {
        const json = await response.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(json?.error?.message ?? 'Não foi possível gerar o PDF.')
      }

      const blob = await response.blob()
      const arquivo = filenameFromDisposition(response.headers.get('Content-Disposition'), 'pasteurizador_grafico.pdf')
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = arquivo
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <>
      {exportingPdf ? <ExportLoadingOverlay /> : null}
      <div className="export-menu-wrap pasteurizador-export-menu">
        <button className="btn primary export-trigger" type="button" onClick={() => setOpen((current) => !current)}>
          <Download size={16} />
          Exportar
          <ChevronDown size={15} />
        </button>
        {open ? (
          <div className="export-menu">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onExportPng()
              }}
            >
              <FileImage size={16} />PNG gráfico
            </button>
            {pdfUrl ? (
              <button type="button" onClick={exportarPdf} disabled={exportingPdf}>
                <FileText size={16} />PDF gráfico
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}

function ExportLoadingOverlay() {
  return (
    <div className="pasteurizador-loading-overlay" role="status" aria-live="polite" aria-label="Gerando PDF do gráfico">
      <div className="pasteurizador-loading-card">
        <span className="pasteurizador-loading-spinner" />
        <strong>Gerando PDF</strong>
        <span>Preparando o gráfico para download...</span>
      </div>
    </div>
  )
}

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1].replace(/"/g, ''))
  }

  const match = disposition.match(/filename="?([^"]+)"?/i)
  return match?.[1] ?? fallback
}

function PlotlyTemperatureChart({
  samples,
  selectedChannel,
  coleta,
  chartRef,
  imageFileName,
}: {
  samples: Amostra[]
  selectedChannel: string
  coleta: Coleta | null
  chartRef: { current: HTMLDivElement | null }
  imageFileName: string
}) {
  const hoverMarkerRef = useRef<HTMLDivElement | null>(null)
  const hoverTooltipRef = useRef<HTMLDivElement | null>(null)
  const themeMode = useChartThemeMode()

  useEffect(() => {
    if (!chartRef.current) return

    if (!samples.length) {
      Plotly.purge(chartRef.current)
      return
    }

    const channels = Array.from(new Set(samples.map((sample) => sample.canal)))
    const collectionLabel = coleta?.coletado_em ?? 'sem data da coleta'
    const traces = channels.map((channel) => {
      const channelSamples = samples.filter((sample) => sample.canal === channel)
      const x = channelSamples.map((sample) => sample.timestamp_registro ?? sample.sample_index)
      const y = channelSamples.map((sample) => sample.valor)
      const customdata = channelSamples.map((sample) => [
        sample.timestamp_registro ?? `Pendente decodificar | coleta ${collectionLabel}`,
        sample.sample_index,
        sample.raw_offset ?? '-',
        sample.unidade ?? '',
      ])
      const isSelected = selectedChannel === 'Todos' ? channel === 'Temp.Pasteuriza' : channel === selectedChannel

      return {
        type: 'scattergl',
        mode: 'lines',
        name: channel,
        x,
        y,
        customdata,
        line: {
          color: CHANNEL_COLORS[channel] ?? '#ffffff',
          width: isSelected && selectedChannel !== 'Todos' ? 2.8 : 1.8,
        },
        hoverinfo: 'none',
        visible: isSelected ? true : 'legendonly',
      }
    })
    const chart = chartRef.current as PlotlyChartElement
    const isLight = themeMode === 'light'
    const chartTheme = {
      paper: isLight ? '#f8fbff' : '#08090a',
      plot: isLight ? '#f8fbff' : '#08090a',
      text: isLight ? '#516173' : '#adafb5',
      axis: isLight ? 'rgba(42,63,92,0.22)' : 'rgba(255,255,255,0.12)',
      grid: isLight ? 'rgba(42,63,92,0.12)' : 'rgba(255,255,255,0.08)',
      range: isLight ? '#eef4fb' : '#111316',
      selector: isLight ? '#eaf1fa' : '#15171a',
      selectorActive: isLight ? '#162438' : '#ffffff',
      markerHalo: isLight ? '#f8fbff' : '#08090a',
    }

    Plotly.react(chart, traces, {
      autosize: true,
      paper_bgcolor: chartTheme.paper,
      plot_bgcolor: chartTheme.plot,
      font: { color: chartTheme.text, family: 'Inter, Segoe UI, Arial, sans-serif' },
      margin: { l: 64, r: 28, t: 18, b: 52 },
      hovermode: 'x unified',
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.08,
        bgcolor: 'rgba(0,0,0,0)',
      },
      xaxis: {
        title: { text: samples.some((sample) => sample.timestamp_registro) ? 'Data/hora' : 'Amostra do arquivo interno' },
        gridcolor: chartTheme.grid,
        zerolinecolor: chartTheme.axis,
        linecolor: chartTheme.axis,
        rangeslider: { visible: true, thickness: 0.08, bgcolor: chartTheme.range, bordercolor: chartTheme.axis },
        rangeselector: {
          bgcolor: chartTheme.selector,
          activecolor: chartTheme.selectorActive,
          bordercolor: chartTheme.axis,
          font: { color: chartTheme.text },
          buttons: [
            { step: 'all', label: 'Tudo' },
          ],
        },
      },
      yaxis: {
        title: { text: selectedChannel === 'Todos' ? 'Valor' : selectedChannel },
        gridcolor: chartTheme.grid,
        zerolinecolor: chartTheme.axis,
        linecolor: chartTheme.axis,
      },
    }, {
      responsive: true,
      displaylogo: false,
      scrollZoom: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: imageFileName,
        height: 900,
        width: 1600,
        scale: 1,
      },
    })

    const toPixel = (axis: PlotlyAxis | undefined, value: string | number) => {
      if (!axis) return null
      if (axis.d2p) return axis.d2p(value)
      if (!axis.l2p) return null
      const linearValue = axis.d2l ? axis.d2l(value) : Number(value)
      return Number.isFinite(linearValue) ? axis.l2p(linearValue) : null
    }

    const updateHoverMarker = (event: PlotlyHoverEvent) => {
      const marker = hoverMarkerRef.current
      const tooltip = hoverTooltipRef.current
      const point = event.points?.[0]
      if (!marker || !tooltip || !point) return

      const fullLayout = (chart as { _fullLayout?: { _size?: { l: number; t: number }; xaxis?: PlotlyAxis; yaxis?: PlotlyAxis } })._fullLayout
      const xPixel = toPixel(point.xaxis ?? fullLayout?.xaxis, point.x)
      const yPixel = toPixel(point.yaxis ?? fullLayout?.yaxis, point.y)
      if (xPixel === null || yPixel === null || !fullLayout?._size) return

      const color = CHANNEL_COLORS[point.fullData?.name ?? point.data?.name ?? ''] ?? '#ffffff'
      const markerLeft = fullLayout._size.l + xPixel
      const markerTop = fullLayout._size.t + yPixel
      const customdata = point.customdata ?? []
      const channel = point.fullData?.name ?? point.data?.name ?? 'Canal'
      const unidade = customdata[3] ?? ''

      tooltip.replaceChildren()

      const dateRow = document.createElement('div')
      dateRow.className = 'plotly-hover-tooltip-date'
      dateRow.textContent = String(customdata[0] ?? point.x ?? '-')

      const titleRow = document.createElement('strong')
      titleRow.textContent = channel

      const sampleRow = document.createElement('span')
      sampleRow.textContent = `Amostra: ${customdata[1] ?? '-'}`

      const offsetRow = document.createElement('span')
      offsetRow.textContent = `Offset: ${customdata[2] ?? '-'}`

      const valueRow = document.createElement('span')
      valueRow.textContent = `Valor: ${Number(point.y).toFixed(2)} ${unidade}`

      tooltip.append(dateRow, titleRow, sampleRow, offsetRow, valueRow)

      marker.style.left = `${markerLeft}px`
      marker.style.top = `${markerTop}px`
      marker.style.borderColor = color
      marker.style.boxShadow = `0 0 0 2px ${chartTheme.markerHalo}, 0 0 0 4px ${color}66`
      marker.style.opacity = '1'

      tooltip.style.borderColor = color
      tooltip.style.opacity = '1'
      tooltip.style.left = '0px'
      tooltip.style.top = '0px'

      const frame = chart.parentElement
      const frameRect = frame?.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const frameWidth = frameRect?.width ?? chart.clientWidth
      const frameHeight = frameRect?.height ?? chart.clientHeight
      const padding = HOVER_TOOLTIP_EDGE_PADDING

      let left = markerLeft + HOVER_TOOLTIP_OFFSET_X
      if (left + tooltipRect.width > frameWidth - padding) {
        left = markerLeft - HOVER_TOOLTIP_OFFSET_X - tooltipRect.width
      }
      left = Math.max(padding, Math.min(left, frameWidth - tooltipRect.width - padding))

      const top = Math.max(
        padding,
        Math.min(markerTop - tooltipRect.height / 2, frameHeight - tooltipRect.height - padding),
      )

      tooltip.style.left = `${left}px`
      tooltip.style.top = `${top}px`
    }

    const clearHoverMarker = () => {
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.style.opacity = '0'
      }
      if (hoverTooltipRef.current) {
        hoverTooltipRef.current.style.opacity = '0'
      }
    }

    chart.on?.('plotly_hover', updateHoverMarker)
    chart.on?.('plotly_unhover', clearHoverMarker)

    return () => {
      chart.removeListener?.('plotly_hover', updateHoverMarker)
      chart.removeListener?.('plotly_unhover', clearHoverMarker)
      Plotly.purge(chart)
    }
  }, [samples, selectedChannel, coleta?.coletado_em, imageFileName, themeMode])

  if (!samples.length) {
    return <div className="temperature-chart-empty">Sem amostras para exibir.</div>
  }

  return (
    <div className="plotly-chart-shell">
      <div className="plotly-chart-frame">
        <div className="plotly-chart" ref={chartRef} />
        <div className="plotly-hover-marker" ref={hoverMarkerRef} />
        <div className="plotly-hover-tooltip" ref={hoverTooltipRef} />
      </div>
    </div>
  )
}
