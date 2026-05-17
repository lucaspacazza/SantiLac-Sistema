import {
  BarChart3,
  Boxes,
  ClipboardList,
  Home,
  Milk,
  RefreshCcw,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { EstoqueTeoricoPage } from './pages/EstoqueTeoricoPage'
import { LoteProducaoPage } from './pages/LoteProducaoPage'
import { ProducaoDiariaPage } from './pages/ProducaoDiariaPage'
import { RelatorioDiarioPage } from './pages/RelatorioDiarioPage'
import { RecebimentoLeitePage } from './pages/RecebimentoLeitePage'

type View =
  | 'inicio'
  | 'recebimento-leite'
  | 'producao-diaria'
  | 'lote-detalhe'
  | 'estoque'
  | 'relatorio'

type LoadStatus = 'loading' | 'live' | 'error'

type RouteState = {
  view: View
  batchId?: number
}

function routeFromHash(): RouteState {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [path, id] = hash.split('/')

  if (path === 'leite') return { view: 'recebimento-leite' }
  if (path === 'producao') return { view: 'producao-diaria' }
  if (path === 'lote' && Number(id) > 0) return { view: 'lote-detalhe', batchId: Number(id) }
  if (path === 'estoque') return { view: 'estoque' }
  if (path === 'relatorio') return { view: 'relatorio' }
  return { view: 'inicio' }
}

function hashForRoute(route: RouteState): string {
  if (route.view === 'recebimento-leite') return '#/leite'
  if (route.view === 'producao-diaria') return '#/producao'
  if (route.view === 'lote-detalhe' && route.batchId) return `#/lote/${route.batchId}`
  if (route.view === 'estoque') return '#/estoque'
  if (route.view === 'relatorio') return '#/relatorio'
  return '#/inicio'
}

const PAGE_META: Record<View, { title: string; copy: string }> = {
  inicio: {
    title: 'Produção Industrial',
    copy: 'Módulo de produção do SantiLac. Substitui o preenchimento manual da planilha.',
  },
  'recebimento-leite': {
    title: 'Recebimento de leite',
    copy: 'Registro diário de litros recebidos, processados e saldo.',
  },
  'producao-diaria': {
    title: 'Produção diária',
    copy: 'Lotes de produção por data com status e litragem.',
  },
  'lote-detalhe': {
    title: 'Detalhe do lote',
    copy: 'Itens produzidos, cálculo de rendimento e fechamento.',
  },
  estoque: {
    title: 'Estoque teórico',
    copy: 'Saldo calculado a partir de produção, vendas e ajustes.',
  },
  relatorio: {
    title: 'Relatório diário',
    copy: 'Consolidado de produção por período com rendimentos.',
  },
}

export function App() {
  const [route, setRoute] = useState<RouteState>(() => routeFromHash())
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Iniciando...')
  const [reloadKey, setReloadKey] = useState(0)

  function navigate(next: RouteState) {
    const nextHash = hashForRoute(next)
    if (window.location.hash !== nextHash) {
      window.history.pushState(next, '', nextHash)
    }
    setRoute(next)
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/inicio')
    }

    const handlePopState = () => {
      setRoute(routeFromHash())
      setReloadKey((k) => k + 1)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function onStatus(s: LoadStatus, text: string) {
    setStatus(s)
    setStatusText(text)
  }

  const meta = PAGE_META[route.view]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="avatar">S</span>
          <strong>SantiLac Core</strong>
        </div>

        <nav className="nav" aria-label="Módulo produção">
          <span className="nav-section-title">Produção</span>
          <button
            className={`nav-item ${route.view === 'inicio' ? 'is-active' : ''}`}
            type="button"
            onClick={() => navigate({ view: 'inicio' })}
          >
            <Home size={16} />
            Início
          </button>
          <button
            className={`nav-item ${route.view === 'recebimento-leite' ? 'is-active' : ''}`}
            type="button"
            onClick={() => navigate({ view: 'recebimento-leite' })}
          >
            <Milk size={16} />
            Leite
          </button>
          <button
            className={`nav-item ${route.view === 'producao-diaria' || route.view === 'lote-detalhe' ? 'is-active' : ''}`}
            type="button"
            onClick={() => navigate({ view: 'producao-diaria' })}
          >
            <ClipboardList size={16} />
            Produção
          </button>
          <button
            className={`nav-item ${route.view === 'estoque' ? 'is-active' : ''}`}
            type="button"
            onClick={() => navigate({ view: 'estoque' })}
          >
            <Boxes size={16} />
            Estoque
          </button>
          <button
            className={`nav-item ${route.view === 'relatorio' ? 'is-active' : ''}`}
            type="button"
            onClick={() => navigate({ view: 'relatorio' })}
          >
            <BarChart3 size={16} />
            Relatório
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="avatar small">P</span>
          <span>Produção</span>
        </div>
      </aside>

      <main className="content">
        <header className="global-topbar">
          <span />
          <nav>
            <span>Laboratório</span>
          </nav>
        </header>

        <section className="page">
          <header className="page-head">
            <div>
              <h1>{meta.title}</h1>
              <p>{meta.copy}</p>
            </div>
            <div className="actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                <RefreshCcw size={16} />
                Atualizar
              </button>
            </div>
          </header>

          <section className={`status-line is-${status}`}>
            <span className="status-dot" />
            <span>{statusText}</span>
          </section>

          {route.view === 'inicio' && <InicioView onNavigate={navigate} />}

          {route.view === 'recebimento-leite' && (
            <RecebimentoLeitePage key={reloadKey} onStatus={onStatus} />
          )}

          {route.view === 'producao-diaria' && (
            <ProducaoDiariaPage
              key={reloadKey}
              onStatus={onStatus}
              onOpenBatch={(id) => navigate({ view: 'lote-detalhe', batchId: id })}
            />
          )}

          {route.view === 'lote-detalhe' && route.batchId && (
            <LoteProducaoPage
              key={`lote-${route.batchId}-${reloadKey}`}
              batchId={route.batchId}
              onStatus={onStatus}
              onBack={() => navigate({ view: 'producao-diaria' })}
            />
          )}

          {route.view === 'estoque' && (
            <EstoqueTeoricoPage key={reloadKey} onStatus={onStatus} />
          )}

          {route.view === 'relatorio' && (
            <RelatorioDiarioPage key={reloadKey} onStatus={onStatus} />
          )}
        </section>
      </main>
    </div>
  )
}

function InicioView({ onNavigate }: { onNavigate: (r: RouteState) => void }) {
  return (
    <section className="dashboard">
      <div className="split-grid">
        <section className="panel">
          <div className="panel-title">
            <Milk size={16} />
            <h2>Recebimento de leite</h2>
          </div>
          <p style={{ color: 'var(--body)', fontSize: 13, margin: 0 }}>
            Registre litros recebidos, processados, direcionados para creme e saldo diário.
          </p>
          <button
            className="btn secondary"
            type="button"
            onClick={() => onNavigate({ view: 'recebimento-leite' })}
          >
            Acessar
          </button>
        </section>

        <section className="panel">
          <div className="panel-title">
            <ClipboardList size={16} />
            <h2>Produção diária</h2>
          </div>
          <p style={{ color: 'var(--body)', fontSize: 13, margin: 0 }}>
            Crie lotes de produção, aponte produtos, recalcule e feche o dia para gerar estoque.
          </p>
          <button
            className="btn secondary"
            type="button"
            onClick={() => onNavigate({ view: 'producao-diaria' })}
          >
            Acessar
          </button>
        </section>

        <section className="panel">
          <div className="panel-title">
            <Boxes size={16} />
            <h2>Estoque teórico</h2>
          </div>
          <p style={{ color: 'var(--body)', fontSize: 13, margin: 0 }}>
            Saldo por produto calculado a partir dos lotes fechados e movimentações de estoque.
          </p>
          <button
            className="btn secondary"
            type="button"
            onClick={() => onNavigate({ view: 'estoque' })}
          >
            Acessar
          </button>
        </section>

        <section className="panel">
          <div className="panel-title">
            <BarChart3 size={16} />
            <h2>Relatório diário</h2>
          </div>
          <p style={{ color: 'var(--body)', fontSize: 13, margin: 0 }}>
            Consolidado de produção com totais, rendimento e itens por lote no período.
          </p>
          <button
            className="btn secondary"
            type="button"
            onClick={() => onNavigate({ view: 'relatorio' })}
          >
            Acessar
          </button>
        </section>
      </div>
    </section>
  )
}
