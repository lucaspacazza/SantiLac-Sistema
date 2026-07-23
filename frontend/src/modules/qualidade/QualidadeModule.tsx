import { RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { qualidadeApi, type Overview, type Produtor } from './api/qualidadeApi'
import { relatoriosApi } from './api/relatoriosApi'
import { ExportFormatMenu, type ExportFormat } from './shared/ExportFormatMenu'
import { Analises } from './views/Analises/Analises'
import { DetalheProdutor } from './views/DetalheProdutor/DetalheProdutor'
import { GestaoProdutores } from './views/GestaoProdutores/GestaoProdutores'
import { Inicio } from './views/Inicio/Inicio'
import { PendenciasProdutor } from './views/PendenciasProdutor/PendenciasProdutor'
import { Relatorios } from './views/Relatorios/Relatorios'
import './qualidade.css'

type LoadStatus = 'loading' | 'live' | 'error'
type View = 'inicio' | 'produtores' | 'analises' | 'relatorios'

type RouteState = {
  view: View
  producerCode: string | null
  issuesCode: string | null
}

function parseRoute(): RouteState {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const parts = hash.split('/').filter(Boolean)

  if (parts[0] === 'produtores' && parts[1]) {
    return {
      view: 'produtores',
      producerCode: decodeURIComponent(parts[1]),
      issuesCode: null,
    }
  }

  if (parts[0] === 'pendencias' && parts[1]) {
    return {
      view: 'relatorios',
      producerCode: null,
      issuesCode: decodeURIComponent(parts[1]),
    }
  }

  if (parts[0] === 'produtores') {
    return {
      view: 'produtores',
      producerCode: null,
      issuesCode: null,
    }
  }

  if (parts[0] === 'analises') {
    return {
      view: 'analises',
      producerCode: null,
      issuesCode: null,
    }
  }

  if (parts[0] === 'relatorios') {
    return {
      view: 'relatorios',
      producerCode: null,
      issuesCode: null,
    }
  }

  return {
    view: 'inicio',
    producerCode: null,
    issuesCode: null,
  }
}

function pushRoute(route: RouteState): void {
  const nextHash = route.issuesCode
    ? `#/pendencias/${encodeURIComponent(route.issuesCode)}`
    : route.producerCode
    ? `#/produtores/${encodeURIComponent(route.producerCode)}`
    : route.view === 'produtores'
      ? '#/produtores'
      : route.view === 'analises'
        ? '#/analises'
        : route.view === 'relatorios'
          ? '#/relatorios'
          : '#/inicio'

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

function toMonthYear(value: string): string {
  const [year, month] = value.split('-')
  return year && month ? `${month}/${year}` : value
}

function monthYearToApi(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{4})$/)
  if (!match) return null

  const month = Number(match[1])
  if (month < 1 || month > 12) return null

  return `${match[2]}-${match[1]}`
}

export function QualidadeModule() {
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando produtores...')
  const [route, setRoute] = useState<RouteState>(() => parseRoute())
  const [analisesReloadKey, setAnalisesReloadKey] = useState(0)
  const [relatoriosReloadKey, setRelatoriosReloadKey] = useState(0)
  const [producerDetailReloadKey, setProducerDetailReloadKey] = useState(0)
  const [exportingProducersFormat, setExportingProducersFormat] = useState<ExportFormat | null>(null)

  async function loadData() {
    setStatus('loading')
    setStatusText('Carregando produtores...')

    try {
      const [response, overviewResponse] = await Promise.all([qualidadeApi.produtores(), qualidadeApi.overview()])
      setProdutores(response.items)
      setOverview(overviewResponse)
      setStatus('live')
      setStatusText(`${response.pagination.total} produtor(es) carregado(s).`)
    } catch {
      setProdutores([])
      setOverview(null)
      setStatus('error')
      setStatusText('Não foi possível carregar os produtores.')
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseRoute())
    }

    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/inicio')
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const filteredProducers = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return produtores.filter((produtor) => {
      const text = [produtor.codigo, produtor.nome, produtor.cidade, produtor.rota].join(' ').toLowerCase()
      return needle === '' || text.includes(needle)
    })
  }, [produtores, search])

  const defaultExportMonth = useMemo(() => {
    const latest = produtores
      .map((produtor) => produtor.ultima_analise?.data)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1)

    return latest ? latest.slice(0, 7) : new Date().toISOString().slice(0, 7)
  }, [produtores])

  async function handleExportProducers(format: ExportFormat) {
    const month = window.prompt('Mês de referência para exportação (MM/AAAA)', toMonthYear(defaultExportMonth))
    if (month === null) return

    const normalizedMonth = monthYearToApi(month)
    if (!normalizedMonth) {
      setStatus('error')
      setStatusText('Informe o mês no formato MM/AAAA.')
      return
    }

    setExportingProducersFormat(format)
    setStatus('loading')
    setStatusText(`Gerando ${format === 'pdf' ? 'PDF' : 'planilha'} de produtores para ${toMonthYear(normalizedMonth)}...`)

    try {
      const result = format === 'pdf'
        ? await relatoriosApi.exportarProdutoresAnalisesPdf(normalizedMonth)
        : await relatoriosApi.exportarProdutoresAnalises(normalizedMonth)
      setStatus('live')
      setStatusText(`Download iniciado: ${result.arquivo}`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível gerar a exportação.')
    } finally {
      setExportingProducersFormat(null)
    }
  }

  const selectedProducer = useMemo(
    () => produtores.find((produtor) => produtor.codigo === route.producerCode) ?? null,
    [produtores, route.producerCode],
  )

  const pageTitle = route.issuesCode
    ? 'Pendências do produtor'
    : route.producerCode
    ? 'Detalhe do produtor'
    : route.view === 'inicio'
      ? 'Qualidade'
      : route.view === 'analises'
        ? 'Análises'
        : route.view === 'relatorios'
          ? 'Relatórios'
          : 'Gestão de produtores'

  const pageCopy = route.issuesCode
    ? 'Conferência dos indicadores fora do padrão.'
    : route.producerCode
    ? 'Produção, qualidade e evolução histórica do produtor.'
    : route.view === 'inicio'
      ? ''
      : route.view === 'analises'
        ? 'Importação de arquivos laboratoriais.'
        : route.view === 'relatorios'
          ? 'Indicadores completos.'
          : 'Visão de qualidade.'

  return (
    <>
      <section className="page">
          {!route.producerCode && (
          <header className="page-head">
            <div>
              <h1>{pageTitle}</h1>
              {pageCopy && <p>{pageCopy}</p>}
            </div>
            <div className="actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => route.view === 'analises'
                  ? setAnalisesReloadKey((current) => current + 1)
                  : route.view === 'relatorios'
                    ? setRelatoriosReloadKey((current) => current + 1)
                    : void loadData()}
              >
                <RefreshCcw size={16} />
                Atualizar
              </button>
              {route.view === 'produtores' && !route.producerCode && !route.issuesCode && (
                <ExportFormatMenu
                  isExporting={exportingProducersFormat !== null}
                  onExport={handleExportProducers}
                />
              )}
            </div>
          </header>
          )}

          {route.view !== 'analises' && route.view !== 'relatorios' && !route.producerCode && (route.view !== 'inicio' || status !== 'live') && (
            <section className={`status-line is-${status}`}>
              <span className="status-dot" />
              <span>{statusText}</span>
            </section>
          )}

          {route.producerCode ? (
            <DetalheProdutor
              codigo={route.producerCode}
              produtorInicial={selectedProducer}
              reloadKey={producerDetailReloadKey}
              onRefresh={() => setProducerDetailReloadKey((current) => current + 1)}
              onBack={() => pushRoute({ view: 'produtores', producerCode: null, issuesCode: null })}
            />
          ) : route.issuesCode ? (
            <PendenciasProdutor codigo={route.issuesCode} onBack={() => pushRoute({ view: 'relatorios', producerCode: null, issuesCode: null })} />
          ) : route.view === 'inicio' ? (
            overview ? <Inicio
              overview={overview}
            /> : null
          ) : route.view === 'analises' ? (
            <Analises reloadKey={analisesReloadKey} />
          ) : route.view === 'relatorios' ? (
            <Relatorios
              reloadKey={relatoriosReloadKey}
              onOpenProdutor={(codigo) => pushRoute({ view: 'produtores', producerCode: codigo, issuesCode: null })}
              onOpenPendencias={(codigo) => pushRoute({ view: 'relatorios', producerCode: null, issuesCode: codigo })}
            />
          ) : (
            <GestaoProdutores
              produtores={filteredProducers}
              search={search}
              onSearchChange={setSearch}
              onOpenProdutor={(codigo) => pushRoute({ view: 'produtores', producerCode: codigo, issuesCode: null })}
            />
          )}
        </section>
    </>
  )
}
