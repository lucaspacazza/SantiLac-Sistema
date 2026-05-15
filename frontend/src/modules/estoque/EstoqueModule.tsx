import {
  ArrowDownToLine,
  ArrowRightLeft,
  BarChart3,
  FlaskConical,
  Home,
  LogOut,
  Package,
  Plus,
  RefreshCcw,
  Settings,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { AuthUser } from '../../api/authApi'
import { ThemeToggle, type ThemeMode } from '../../shared/ThemeToggle'
import { estoqueApi, type EstoqueItem, type EstoqueItemDetalhe, type Movimento, type Overview } from './api/estoqueApi'
import { today } from './shared/formatters'
import { DetalheItem } from './views/DetalheItem/DetalheItem'
import { EditarItem } from './views/EditarItem/EditarItem'
import { Inicio } from './views/Inicio/Inicio'
import { ItensView } from './views/Itens/Itens'
import { MovimentosView } from './views/Movimentos/Movimentos'

type View = 'inicio' | 'itens' | 'detalhe-item' | 'editar-item' | 'movimentos'
type LoadStatus = 'loading' | 'live' | 'error'

type RouteState = {
  view: View
  itemId?: number
}

const emptyOverview: Overview = {
  totais: {
    itens: 0,
    itens_ativos: 0,
    movimentos_mes: 0,
    abaixo_minimo: 0,
  },
  alertas: {
    baixo_estoque: [],
  },
}

function parseRoute(): RouteState {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)

  if (parts[0] !== 'estoque') {
    return { view: 'inicio' }
  }

  if (parts[1] === 'itens') {
    return { view: 'itens' }
  }

  if (parts[1] === 'item' && Number(parts[2]) > 0) {
    return { view: 'detalhe-item', itemId: Number(parts[2]) }
  }

  if (parts[1] === 'editar-item' && Number(parts[2]) > 0) {
    return { view: 'editar-item', itemId: Number(parts[2]) }
  }

  if (parts[1] === 'movimentos') {
    return { view: 'movimentos' }
  }

  return { view: 'inicio' }
}

function pushRoute(route: RouteState): void {
  const nextHash = route.view === 'itens'
    ? '#/estoque/itens'
    : route.view === 'detalhe-item' && route.itemId
      ? `#/estoque/item/${route.itemId}`
      : route.view === 'editar-item' && route.itemId
        ? `#/estoque/editar-item/${route.itemId}`
        : route.view === 'movimentos'
          ? '#/estoque/movimentos'
          : '#/estoque/inicio'

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

export function EstoqueModule({
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
  const [route, setRoute] = useState<RouteState>(() => parseRoute())
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando estoque...')
  const [overview, setOverview] = useState<Overview>(emptyOverview)
  const [categorias, setCategorias] = useState<string[]>([])
  const [itens, setItens] = useState<EstoqueItem[]>([])
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [search, setSearch] = useState('')
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [movementFormOpen, setMovementFormOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<EstoqueItemDetalhe | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function loadData() {
    setStatus('loading')
    setStatusText('Carregando estoque...')

    try {
      const [overviewResult, categoriasResult, itensResult, movimentosResult] = await Promise.all([
        estoqueApi.overview(),
        estoqueApi.categorias(),
        estoqueApi.itens(search),
        estoqueApi.movimentos(),
      ])

      setOverview(overviewResult)
      setCategorias(categoriasResult)
      setItens(itensResult.items)
      setMovimentos(movimentosResult.items)
      setStatus('live')
      setStatusText(`${itensResult.pagination.total} item(ns) carregado(s).`)
    } catch (error) {
      setItens([])
      setMovimentos([])
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o estoque.')
    }
  }

  async function loadItem(id: number) {
    setDetailLoading(true)
    setSelectedItem(null)

    try {
      setSelectedItem(await estoqueApi.item(id))
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o item.')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = parseRoute()
      setRoute(nextRoute)

      if ((nextRoute.view === 'detalhe-item' || nextRoute.view === 'editar-item') && nextRoute.itemId !== undefined) {
        void loadItem(nextRoute.itemId)
      } else {
        setSelectedItem(null)
      }
    }

    if (!window.location.hash.startsWith('#/estoque')) {
      window.history.replaceState(null, '', '#/estoque/inicio')
    }

    const initial = parseRoute()
    setRoute(initial)
    if ((initial.view === 'detalhe-item' || initial.view === 'editar-item') && initial.itemId !== undefined) {
      void loadItem(initial.itemId)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  async function openItem(id: number, target: 'detalhe-item' | 'editar-item' = 'detalhe-item') {
    pushRoute({ view: target, itemId: id })
    await loadItem(id)
  }

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadData()
  }

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    const item = await estoqueApi.criarItem({
      codigo: String(form.get('codigo') ?? '').trim() || undefined,
      nome: String(form.get('nome') ?? '').trim(),
      categoria: String(form.get('categoria') ?? '').trim(),
      descricao: String(form.get('descricao') ?? '').trim() || undefined,
      unidade: String(form.get('unidade') ?? '').trim(),
      saldo_atual: Number(form.get('saldo_atual') || 0),
      estoque_minimo: Number(form.get('estoque_minimo') || 0),
    })

    setItemFormOpen(false)
    await loadData()
    await openItem(item.id)
  }

  async function handleUpdateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (selectedItem === null) {
      return
    }

    const form = new FormData(event.currentTarget)
    const updated = await estoqueApi.atualizarItem(selectedItem.id, {
      codigo: String(form.get('codigo') ?? '').trim() || undefined,
      nome: String(form.get('nome') ?? '').trim(),
      categoria: String(form.get('categoria') ?? '').trim(),
      descricao: String(form.get('descricao') ?? '').trim() || undefined,
      unidade: String(form.get('unidade') ?? '').trim(),
      estoque_minimo: Number(form.get('estoque_minimo') || 0),
      ativo: form.get('ativo') === 'on',
    })

    setSelectedItem(updated)
    pushRoute({ view: 'detalhe-item', itemId: updated.id })
    setStatus('live')
    setStatusText('Item atualizado.')
    await loadData()
  }

  async function handleCreateMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    await estoqueApi.registrarMovimento({
      tipo: String(form.get('tipo') ?? 'entrada') as Movimento['tipo'],
      item_id: Number(form.get('item_id')),
      quantidade: Number(form.get('quantidade') || 0),
      data_movimento: String(form.get('data_movimento') || today()),
      documento: String(form.get('documento') ?? '').trim() || undefined,
      motivo: String(form.get('motivo') ?? '').trim() || undefined,
      observacao: String(form.get('observacao') ?? '').trim() || undefined,
    })

    setMovementFormOpen(false)
    await loadData()
    if (selectedItem !== null && (route.view === 'detalhe-item' || route.view === 'editar-item')) {
      await openItem(selectedItem.id)
    }
  }

  const visibleMovements = useMemo(() => movimentos.slice(0, 18), [movimentos])
  const pageTitle = route.view === 'inicio'
    ? 'Controle de estoque'
    : route.view === 'itens'
      ? 'Itens de estoque'
      : route.view === 'editar-item'
        ? 'Editar item'
        : route.view === 'detalhe-item'
          ? 'Detalhe do item'
          : 'Movimentações'
  const pageCopy = route.view === 'inicio'
    ? 'Saldos, alertas e movimentações do estoque operacional.'
    : route.view === 'itens'
      ? 'Cadastro e consulta de itens com saldo atual.'
      : route.view === 'editar-item'
        ? 'Alteração do cadastro do item.'
        : route.view === 'detalhe-item'
          ? 'Cadastro, saldo e histórico do item.'
          : 'Entradas, saídas e ajustes.'

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
          <button className="nav-item nav-motion-quality" type="button" onClick={() => onOpenModule('qualidade')}>
            <FlaskConical size={16} />
            Qualidade
          </button>
          <button className="nav-item nav-motion-stock is-active" type="button" onClick={() => pushRoute({ view: 'inicio' })}>
            <Package size={16} />
            Estoque
          </button>
          <div className="nav-subtree" aria-label="Submódulos de estoque">
            <button className={`nav-subitem nav-motion-start ${route.view === 'inicio' ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'inicio' })}><Home size={15} />Início</button>
            <button className={`nav-subitem nav-motion-items ${route.view === 'itens' || route.view === 'detalhe-item' || route.view === 'editar-item' ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'itens' })}><Package size={15} />Itens</button>
            <button className={`nav-subitem nav-motion-movements ${route.view === 'movimentos' ? 'is-active' : ''}`} type="button" onClick={() => pushRoute({ view: 'movimentos' })}><ArrowRightLeft size={15} />Movimentações</button>
          </div>
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
              <button className="btn secondary" type="button" onClick={() => void loadData()}>
                <RefreshCcw size={16} />
                Atualizar
              </button>
              <button className="btn primary" type="button" onClick={() => setItemFormOpen(true)}>
                <Plus size={16} />
                Novo item
              </button>
              <button className="btn primary" type="button" onClick={() => setMovementFormOpen(true)} disabled={itens.length === 0}>
                <ArrowDownToLine size={16} />
                Movimento
              </button>
            </div>
          </header>

          <section className={`status-line is-${status}`}>
            <span className="status-dot" />
            <span>{statusText}</span>
          </section>

          {route.view === 'inicio' && (
            <Inicio overview={overview} movimentos={visibleMovements} onOpenItens={() => pushRoute({ view: 'itens' })} />
          )}

          {route.view === 'itens' && (
            <ItensView
              itens={itens}
              search={search}
              onSearchChange={setSearch}
              onSearchSubmit={handleSearchSubmit}
              onOpenItem={(id) => void openItem(id)}
            />
          )}

          {route.view === 'detalhe-item' && (
            <DetalheItem
              item={selectedItem}
              loading={detailLoading}
              onBack={() => pushRoute({ view: 'itens' })}
              onEdit={() => selectedItem !== null && pushRoute({ view: 'editar-item', itemId: selectedItem.id })}
            />
          )}

          {route.view === 'editar-item' && (
            <EditarItem
              item={selectedItem}
              categorias={categorias}
              loading={detailLoading}
              onBack={() => selectedItem !== null ? pushRoute({ view: 'detalhe-item', itemId: selectedItem.id }) : pushRoute({ view: 'itens' })}
              onSubmit={handleUpdateItem}
            />
          )}

          {route.view === 'movimentos' && <MovimentosView movimentos={movimentos} />}
        </section>
      </main>

      {itemFormOpen && (
        <Modal title="Novo item" onClose={() => setItemFormOpen(false)}>
          <form className="form-grid" onSubmit={(event) => void handleCreateItem(event)}>
            <input name="codigo" placeholder="Código" />
            <input name="nome" placeholder="Nome do item" required />
            <input name="categoria" placeholder="Categoria" list="categorias-estoque" required />
            <datalist id="categorias-estoque">
              {categorias.map((categoria) => <option key={categoria} value={categoria} />)}
            </datalist>
            <input name="unidade" placeholder="Unidade" required />
            <input name="saldo_atual" placeholder="Saldo atual" type="number" step="0.001" min="0" />
            <input name="estoque_minimo" placeholder="Estoque mínimo" type="number" step="0.001" min="0" />
            <textarea name="descricao" placeholder="Descrição" />
            <div className="modal-actions">
              <button className="btn secondary" type="button" onClick={() => setItemFormOpen(false)}>Cancelar</button>
              <button className="btn primary" type="submit">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {movementFormOpen && (
        <Modal title="Novo movimento" onClose={() => setMovementFormOpen(false)}>
          <form className="form-grid" onSubmit={(event) => void handleCreateMovement(event)}>
            <select name="tipo" required defaultValue="entrada">
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste</option>
            </select>
            <select name="item_id" required defaultValue={selectedItem?.id ?? ''}>
              <option value="" disabled>Item</option>
              {itens.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
            <input name="quantidade" placeholder="Quantidade" type="number" step="0.001" required />
            <input name="data_movimento" type="date" defaultValue={today()} required />
            <input name="documento" placeholder="Documento" />
            <input name="motivo" placeholder="Motivo" />
            <textarea name="observacao" placeholder="Observação" />
            <div className="modal-actions">
              <button className="btn secondary" type="button" onClick={() => setMovementFormOpen(false)}>Cancelar</button>
              <button className="btn primary" type="submit">Registrar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>Fechar</button>
        </header>
        {children}
      </section>
    </div>
  )
}
