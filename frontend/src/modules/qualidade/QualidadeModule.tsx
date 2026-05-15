import {
  BarChart3,
  FlaskConical,
  Home,
  LogOut,
  Package,
  RefreshCcw,
  Settings,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AuthUser } from '../../api/authApi'
import { ThemeToggle, type ThemeMode } from '../../shared/ThemeToggle'
import { qualidadeApi, type Produtor } from './api/qualidadeApi'
import { relatoriosApi } from './api/relatoriosApi'
import { ExportFormatMenu, type ExportFormat } from './shared/ExportFormatMenu'
import { Analises } from './views/Analises/Analises'
import { DetalheProdutor } from './views/DetalheProdutor/DetalheProdutor'
import { GestaoProdutores } from './views/GestaoProdutores/GestaoProdutores'
import { Inicio } from './views/Inicio/Inicio'
import { PendenciasProdutor } from './views/PendenciasProdutor/PendenciasProdutor'
import { Relatorios } from './views/Relatorios/Relatorios'

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

export function QualidadeModule({
  user,
  theme,
  onToggleTheme,
  onBackToSystem,
  onOpenModule,
  onLogout,
}: {
  user: AuthUser
  theme: ThemeMode
  onToggleTheme: () => void
  onBackToSystem: () => void
  onOpenModule: (module: 'qualidade' | 'estoque') => void
  onLogout: () => void
}) {
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando produtores...')
  const [route, setRoute] = useState<RouteState>(() => parseRoute())
  const [analisesReloadKey, setAnalisesReloadKey] = useState(0)
  const [relatoriosReloadKey, setRelatoriosReloadKey] = useState(0)
  const [exportingProducersFormat, setExportingProducersFormat] = useState<ExportFormat | null>(null)

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
        <img className="sidebar-logo" src="/assets/img/logo.png" alt="Santi'Lac" />

        <nav className="nav" aria-label="Navegação principal">
          <span className="nav-section-title">Sistema</span>
          <button className="nav-item nav-motion-home" type="button" onClick={onBackToSystem}>
            <Home size={16} />
            Início do sistema
          </button>
          <button className="nav-item nav-motion-quality is-active" type="button" onClick={() => pushRoute({ view: 'inicio', producerCode: null, issuesCode: null })}>
            <FlaskConical size={16} />
            Qualidade
          </button>
          <div className="nav-subtree" aria-label="Submódulos de qualidade">
            <button className={`nav-subitem nav-motion-start ${route.view === 'inicio' && !route.producerCode ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'inicio', producerCode: null, issuesCode: null })}><Home size={15} />Início</button>
            <button className={`nav-subitem nav-motion-producers ${route.view === 'produtores' || route.producerCode ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'produtores', producerCode: null, issuesCode: null })}><Users size={15} />Produtores</button>
            <button className={`nav-subitem nav-motion-analyses ${route.view === 'analises' ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'analises', producerCode: null, issuesCode: null })}><FlaskConical size={15} />Análises</button>
            <button className={`nav-subitem nav-motion-reports ${route.view === 'relatorios' ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'relatorios', producerCode: null, issuesCode: null })}><BarChart3 size={15} />Relatórios</button>
          </div>
          <button className="nav-item nav-motion-stock" type="button" onClick={() => onOpenModule('estoque')}>
            <Package size={16} />
            Estoque
          </button>
          <button className="nav-item nav-motion-dashboard is-disabled" type="button" disabled>
            <BarChart3 size={16} />
            Dashboard
          </button>
          <button className="nav-item nav-motion-admin is-disabled" type="button" disabled>
            <Settings size={16} />
            Administração
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar small">{user.nome.slice(0, 1).toUpperCase()}</span>
            <span>{user.nome}</span>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </aside>

      <main className="content">
        <header className="global-topbar">
          <span />
          <nav>
            <button type="button" onClick={onLogout}>
              <LogOut size={15} />
              Sair
            </button>
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
                <ExportFormatMenu
                  isExporting={exportingProducersFormat !== null}
                  onExport={handleExportProducers}
                />
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
