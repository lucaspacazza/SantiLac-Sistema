import {
  BarChart3,
  Download,
  FileText,
  FlaskConical,
  Home,
  RefreshCcw,
  Settings,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { qualidadeApi, type Produtor } from './api/qualidadeApi'
import { Analises } from './views/Analises/Analises'
import { DetalheProdutor } from './views/DetalheProdutor/DetalheProdutor'
import { GestaoProdutores } from './views/GestaoProdutores/GestaoProdutores'
import { Inicio } from './views/Inicio/Inicio'

type LoadStatus = 'loading' | 'live' | 'error'
type View = 'inicio' | 'produtores' | 'analises'

type RouteState = {
  view: View
  producerCode: string | null
}

function parseRoute(): RouteState {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const parts = hash.split('/').filter(Boolean)

  if (parts[0] === 'produtores' && parts[1]) {
    return {
      view: 'produtores',
      producerCode: decodeURIComponent(parts[1]),
    }
  }

  if (parts[0] === 'produtores') {
    return {
      view: 'produtores',
      producerCode: null,
    }
  }

  if (parts[0] === 'analises') {
    return {
      view: 'analises',
      producerCode: null,
    }
  }

  return {
    view: 'inicio',
    producerCode: null,
  }
}

function pushRoute(route: RouteState): void {
  const nextHash = route.producerCode
    ? `#/produtores/${encodeURIComponent(route.producerCode)}`
    : route.view === 'produtores'
      ? '#/produtores'
      : route.view === 'analises'
        ? '#/analises'
        : '#/inicio'

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

export function App() {
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando produtores...')
  const [route, setRoute] = useState<RouteState>(() => parseRoute())
  const [analisesReloadKey, setAnalisesReloadKey] = useState(0)

  async function loadData() {
    setStatus('loading')
    setStatusText('Carregando produtores...')

    try {
      const response = await qualidadeApi.produtores()
      setProdutores(response.items)
      setStatus('live')
      setStatusText(`${response.pagination.total} produtor(es) carregado(s) da API.`)
    } catch {
      setProdutores([])
      setStatus('error')
      setStatusText('Não foi possível carregar os produtores da API.')
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
      const matchesSearch = needle === '' || text.includes(needle)
      const matchesActive = activeFilter === '' || String(Number(produtor.ativo)) === activeFilter
      return matchesSearch && matchesActive
    })
  }, [activeFilter, produtores, search])

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

  const pageTitle = route.producerCode
    ? 'Detalhe do produtor'
    : route.view === 'inicio'
      ? 'Início'
      : route.view === 'analises'
        ? 'Análises'
        : 'Gestão de produtores'

  const pageCopy = route.producerCode
    ? 'Consulta individual do produtor dentro do módulo de qualidade.'
    : route.view === 'inicio'
      ? 'Resumo real do módulo com base nos produtores carregados.'
      : route.view === 'analises'
        ? 'Importação e conferência dos arquivos laboratoriais.'
        : 'Visão de qualidade com a última análise laboratorial de cada produtor.'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="workspace-switcher">
          <span className="avatar">S</span>
          <strong>SantiLac Core</strong>
        </div>

        <nav className="nav" aria-label="Módulo qualidade">
          <button className={`nav-item ${route.view === 'inicio' && !route.producerCode ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'inicio', producerCode: null })}><Home size={16} />Início</button>
          <button className={`nav-item ${route.view === 'produtores' || route.producerCode ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'produtores', producerCode: null })}><Users size={16} />Produtores</button>
          <button className={`nav-item ${route.view === 'analises' ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'analises', producerCode: null })}><FlaskConical size={16} />Análises</button>
          <button className="nav-item" type="button"><BarChart3 size={16} />Relatórios</button>
          <button className="nav-item" type="button"><FileText size={16} />Notas fiscais</button>
          <button className="nav-item" type="button"><Settings size={16} />Configurações</button>
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
                onClick={() => route.view === 'analises' ? setAnalisesReloadKey((current) => current + 1) : void loadData()}
              >
                <RefreshCcw size={16} />
                Atualizar
              </button>
              {route.view !== 'analises' && (
                <button className="btn primary" type="button">
                  <Download size={16} />
                  Exportar
                </button>
              )}
            </div>
          </header>

          {route.view !== 'analises' && (
            <section className={`status-line is-${status}`}>
              <span className="status-dot" />
              <span>{statusText}</span>
            </section>
          )}

          {route.producerCode ? (
            <DetalheProdutor produtor={selectedProducer} onBack={() => pushRoute({ view: 'produtores', producerCode: null })} />
          ) : route.view === 'inicio' ? (
            <Inicio overview={overview} onOpenProdutores={() => pushRoute({ view: 'produtores', producerCode: null })} />
          ) : route.view === 'analises' ? (
            <Analises reloadKey={analisesReloadKey} />
          ) : (
            <GestaoProdutores
              produtores={filteredProducers}
              search={search}
              activeFilter={activeFilter}
              onSearchChange={setSearch}
              onActiveFilterChange={setActiveFilter}
              onOpenProdutor={(codigo) => pushRoute({ view: 'produtores', producerCode: codigo })}
            />
          )}
        </section>
      </main>
    </div>
  )
}
