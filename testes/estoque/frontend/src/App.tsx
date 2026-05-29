import {
  ArrowDownToLine,
  ArrowRightLeft,
  Home,
  Package,
  Plus,
  RefreshCcw,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
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

function routeFromHash(): RouteState {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [path, id] = hash.split('/')

  if (path === 'itens') {
    return { view: 'itens' }
  }

  if (path === 'item' && Number(id) > 0) {
    return { view: 'detalhe-item', itemId: Number(id) }
  }

  if (path === 'editar-item' && Number(id) > 0) {
    return { view: 'editar-item', itemId: Number(id) }
  }

  if (path === 'movimentos') {
    return { view: 'movimentos' }
  }

  return { view: 'inicio' }
}

function hashForRoute(route: RouteState): string {
  if (route.view === 'itens') {
    return '#/itens'
  }

  if (route.view === 'detalhe-item' && route.itemId) {
    return `#/item/${route.itemId}`
  }

  if (route.view === 'editar-item' && route.itemId) {
    return `#/editar-item/${route.itemId}`
  }

  if (route.view === 'movimentos') {
    return '#/movimentos'
  }

  return '#/inicio'
}

export function App() {
  const initialRoute = routeFromHash()
  const [view, setView] = useState<View>(initialRoute.view)
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

  function navigate(route: RouteState) {
    const nextHash = hashForRoute(route)
    if (window.location.hash !== nextHash) {
      window.history.pushState(route, '', nextHash)
    }
    setView(route.view)
  }

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
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o estoque.')
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (initialRoute.itemId !== undefined) {
      void loadItem(initialRoute.itemId)
    }

    const handlePopState = () => {
      const route = routeFromHash()
      setView(route.view)

      if ((route.view === 'detalhe-item' || route.view === 'editar-item') && route.itemId !== undefined) {
        void loadItem(route.itemId)
      } else {
        setSelectedItem(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

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

  async function openItem(id: number, target: 'detalhe-item' | 'editar-item' = 'detalhe-item') {
    navigate({ view: target, itemId: id })
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
    const foto = form.get('foto')
    const itemComFoto = foto instanceof File && foto.size > 0
      ? await estoqueApi.importarFotoItem(item.id, foto)
      : item

    setItemFormOpen(false)
    await loadData()
    await openItem(itemComFoto.id)
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
    const foto = form.get('foto')
    const itemAtualizado = foto instanceof File && foto.size > 0
      ? await estoqueApi.importarFotoItem(updated.id, foto)
      : updated

    setSelectedItem(itemAtualizado)
    navigate({ view: 'detalhe-item', itemId: itemAtualizado.id })
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
    if (selectedItem !== null && (view === 'detalhe-item' || view === 'editar-item')) {
      await openItem(selectedItem.id)
    }
  }

  const visibleMovements = useMemo(() => movimentos.slice(0, 18), [movimentos])
  const pageTitle = view === 'inicio'
    ? 'Controle de estoque'
    : view === 'itens'
      ? 'Itens de estoque'
      : view === 'editar-item'
        ? 'Editar item'
        : view === 'detalhe-item'
          ? 'Detalhe do item'
          : 'Movimentações'
  const pageCopy = view === 'inicio'
    ? 'Saldos, alertas e movimentações do estoque operacional.'
    : view === 'itens'
      ? 'Cadastro e consulta de itens com saldo atual.'
      : view === 'editar-item'
        ? 'Alteração do cadastro do item.'
        : view === 'detalhe-item'
          ? 'Cadastro, saldo e histórico do item.'
          : 'Entradas, saídas e ajustes.'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="avatar">S</span>
          <strong>SantiLac Core</strong>
        </div>

        <nav className="nav" aria-label="Navegação principal">
          <span className="nav-section-title">Módulo</span>
          <button className={`nav-item ${view === 'inicio' ? 'is-active' : ''}`} type="button" onClick={() => navigate({ view: 'inicio' })}>
            <Home size={16} />
            Início
          </button>
          <button className={`nav-item ${view === 'itens' || view === 'detalhe-item' || view === 'editar-item' ? 'is-active' : ''}`} type="button" onClick={() => navigate({ view: 'itens' })}>
            <Package size={16} />
            Itens
          </button>
          <button className={`nav-item ${view === 'movimentos' ? 'is-active' : ''}`} type="button" onClick={() => navigate({ view: 'movimentos' })}>
            <ArrowRightLeft size={16} />
            Movimentações
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="avatar small">E</span>
          <span>Estoque</span>
        </div>
      </aside>

      <main className="content">
        <header className="global-topbar">
          <span />
          <nav>
            <span>Estoque</span>
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

          {view === 'inicio' && (
            <Inicio overview={overview} movimentos={visibleMovements} onOpenItens={() => navigate({ view: 'itens' })} />
          )}

          {view === 'itens' && (
            <ItensView
              itens={itens}
              search={search}
              onSearchChange={setSearch}
              onSearchSubmit={handleSearchSubmit}
              onOpenItem={(id) => void openItem(id)}
            />
          )}

          {view === 'detalhe-item' && (
            <DetalheItem
              item={selectedItem}
              loading={detailLoading}
              onBack={() => navigate({ view: 'itens' })}
              onEdit={() => selectedItem !== null && navigate({ view: 'editar-item', itemId: selectedItem.id })}
            />
          )}

          {view === 'editar-item' && (
            <EditarItem
              item={selectedItem}
              categorias={categorias}
              loading={detailLoading}
              onBack={() => selectedItem !== null ? navigate({ view: 'detalhe-item', itemId: selectedItem.id }) : navigate({ view: 'itens' })}
              onSubmit={handleUpdateItem}
            />
          )}

          {view === 'movimentos' && <MovimentosView movimentos={movimentos} />}
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
            <label className="file-field">
              Foto do produto
              <input name="foto" type="file" accept="image/png,image/jpeg,image/webp" />
            </label>
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
