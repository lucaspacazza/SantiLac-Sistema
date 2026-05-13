import {
  BarChart3,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Home,
  RefreshCcw,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { qualidadeApi, type Produtor } from './api/qualidadeApi'
import { relatoriosApi } from './api/relatoriosApi'
import { Analises } from './views/Analises/Analises'
import { DetalheProdutor } from './views/DetalheProdutor/DetalheProdutor'
import { GestaoProdutores } from './views/GestaoProdutores/GestaoProdutores'
import { Inicio } from './views/Inicio/Inicio'
import { PendenciasProdutor } from './views/PendenciasProdutor/PendenciasProdutor'
import { Relatorios } from './views/Relatorios/Relatorios'

type LoadStatus = 'loading' | 'live' | 'error'
type View = 'inicio' | 'produtores' | 'analises' | 'relatorios'
type ExportFormat = 'excel' | 'pdf'

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

export function App() {
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando produtores...')
  const [route, setRoute] = useState<RouteState>(() => parseRoute())
  const [analisesReloadKey, setAnalisesReloadKey] = useState(0)
  const [relatoriosReloadKey, setRelatoriosReloadKey] = useState(0)
  const [exportingProducersFormat, setExportingProducersFormat] = useState<ExportFormat | null>(null)
  const [isProducersExportMenuOpen, setIsProducersExportMenuOpen] = useState(false)

  async function loadData() {
    setStatus('loading')
    setStatusText('Carregando produtores...')

    try {
      const response = await qualidadeApi.produtores()
      setProdutores(response.items)
      setStatus('live')
      setStatusText(`${response.pagination.total} produtor(es) carregado(s).`)
    } catch {
      setProdutores([])
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

    setIsProducersExportMenuOpen(false)
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

  const overview = useMemo(() => {
    const ativos = produtores.filter((produtor) => produtor.ativo).length
    const novos = produtores.filter((produtor) => produtor.novo).length
    const inativos = produtores.filter((produtor) => !produtor.ativo).length
    const comAnalise = produtores.filter((produtor) => produtor.ultima_analise).length
    const semAnalise = produtores.length - comAnalise
    const cidades = new Map<string, number>()

    produtores.forEach((produtor) => {
      const cidade = produtor.cidade || 'Não informada'
      cidades.set(cidade, (cidades.get(cidade) ?? 0) + 1)
    })

    return {
      total: produtores.length,
      ativos,
      novos,
      inativos,
      comAnalise,
      semAnalise,
      cidades: [...cidades.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6),
    }
  }, [produtores])

  const selectedProducer = useMemo(
    () => produtores.find((produtor) => produtor.codigo === route.producerCode) ?? null,
    [produtores, route.producerCode],
  )

  const pageTitle = route.issuesCode
    ? 'Pendências do produtor'
    : route.producerCode
    ? 'Detalhe do produtor'
    : route.view === 'inicio'
      ? 'Início'
      : route.view === 'analises'
        ? 'Análises'
        : route.view === 'relatorios'
          ? 'Relatórios'
          : 'Gestão de produtores'

  const pageCopy = route.issuesCode
    ? 'Conferência dos indicadores fora do padrão.'
    : route.producerCode
    ? 'Consulta individual do produtor dentro do módulo de qualidade.'
    : route.view === 'inicio'
      ? 'Resumo real do módulo com base nos produtores carregados.'
      : route.view === 'analises'
        ? 'Importação de arquivos laboratoriais.'
        : route.view === 'relatorios'
          ? 'Indicadores completos.'
          : 'Visão de qualidade.'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="workspace-switcher">
          <span className="avatar">S</span>
          <strong>SantiLac Core</strong>
        </div>

        <nav className="nav" aria-label="Módulo qualidade">
          <button className={`nav-item ${route.view === 'inicio' && !route.producerCode ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'inicio', producerCode: null, issuesCode: null })}><Home size={16} />Início</button>
          <button className={`nav-item ${route.view === 'produtores' || route.producerCode ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'produtores', producerCode: null, issuesCode: null })}><Users size={16} />Produtores</button>
          <button className={`nav-item ${route.view === 'analises' ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'analises', producerCode: null, issuesCode: null })}><FlaskConical size={16} />Análises</button>
          <button className={`nav-item ${route.view === 'relatorios' ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'relatorios', producerCode: null, issuesCode: null })}><BarChart3 size={16} />Relatórios</button>
        </nav>

        <div className="sidebar-footer">
          <span className="avatar small">L</span>
          <span>lucaspacazza6</span>
        </div>
      </aside>

      <main className="content">
        <header className="global-topbar">
          <span />
          <nav>
            <button type="button">Feedback</button>
            <button type="button">Ajuda</button>
            <button type="button">Docs</button>
          </nav>
        </header>

        <section className="page">
          <header className="page-head">
            <div>
              <h1>{pageTitle}</h1>
              <p>{pageCopy}</p>
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
                <div className="export-menu-wrap">
                  <button
                    className="btn primary"
                    type="button"
                    aria-expanded={isProducersExportMenuOpen}
                    disabled={exportingProducersFormat !== null}
                    onClick={() => setIsProducersExportMenuOpen((current) => !current)}
                  >
                    <Download size={16} />
                    {exportingProducersFormat ? 'Gerando...' : 'Exportar'}
                    <ChevronDown size={15} />
                  </button>
                  {isProducersExportMenuOpen && (
                    <div className="export-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => handleExportProducers('excel')}>
                        <FileSpreadsheet size={16} />
                        Excel
                      </button>
                      <button type="button" role="menuitem" onClick={() => handleExportProducers('pdf')}>
                        <FileText size={16} />
                        PDF
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>

          {route.view !== 'analises' && route.view !== 'relatorios' && (
            <section className={`status-line is-${status}`}>
              <span className="status-dot" />
              <span>{statusText}</span>
            </section>
          )}

          {route.producerCode ? (
            <DetalheProdutor produtor={selectedProducer} onBack={() => pushRoute({ view: 'produtores', producerCode: null, issuesCode: null })} />
          ) : route.issuesCode ? (
            <PendenciasProdutor codigo={route.issuesCode} onBack={() => pushRoute({ view: 'relatorios', producerCode: null, issuesCode: null })} />
          ) : route.view === 'inicio' ? (
            <Inicio overview={overview} onOpenProdutores={() => pushRoute({ view: 'produtores', producerCode: null, issuesCode: null })} />
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
      </main>
    </div>
  )
}
