import { RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  producaoApi,
  type EstoqueSoroResumo,
  type FormulacaoCreme,
  type FormulacaoCremePayload,
  type FormulacaoQueijo,
  type FormulacaoQueijoPayload,
  type ExportFormat,
  type Overview,
  type ProducaoCreme,
  type ProducaoCremePayload,
  type SoroRefrigerado,
  type SoroRefrigeradoPayload,
} from './api/producaoApi'
import { ProducaoSidebar } from './components/Sidebar/ProducaoSidebar'
import { EdicaoFormulacaoCreme } from './views/FormulacaoCreme/EdicaoFormulacaoCreme'
import { ListagemFormulacoesCreme } from './views/FormulacaoCreme/ListagemFormulacoesCreme'
import { PreenchimentoFormulacaoCreme } from './views/FormulacaoCreme/PreenchimentoFormulacaoCreme'
import { VisualizacaoFormulacaoCreme } from './views/FormulacaoCreme/VisualizacaoFormulacaoCreme'
import { EdicaoFormulacaoQueijo } from './views/FormulacaoQueijo/EdicaoFormulacaoQueijo'
import { ListagemFormulacoesQueijo } from './views/FormulacaoQueijo/ListagemFormulacoesQueijo'
import { PreenchimentoFormulacaoQueijo } from './views/FormulacaoQueijo/PreenchimentoFormulacaoQueijo'
import { VisualizacaoFormulacaoQueijo } from './views/FormulacaoQueijo/VisualizacaoFormulacaoQueijo'
import { Inicio } from './views/Inicio/Inicio'
import { EdicaoProducaoCreme } from './views/ProducaoCreme/EdicaoProducaoCreme'
import { ListagemProducoesCreme } from './views/ProducaoCreme/ListagemProducoesCreme'
import { PreenchimentoProducaoCreme } from './views/ProducaoCreme/PreenchimentoProducaoCreme'
import { VisualizacaoProducaoCreme } from './views/ProducaoCreme/VisualizacaoProducaoCreme'
import { EdicaoSoroRefrigerado } from './views/SoroRefrigerado/EdicaoSoroRefrigerado'
import { EstoqueSoroRefrigerado } from './views/SoroRefrigerado/EstoqueSoroRefrigerado'
import { ListagemSoroRefrigerado } from './views/SoroRefrigerado/ListagemSoroRefrigerado'
import { PreenchimentoSoroRefrigerado } from './views/SoroRefrigerado/PreenchimentoSoroRefrigerado'
import { VisualizacaoSoroRefrigerado } from './views/SoroRefrigerado/VisualizacaoSoroRefrigerado'

type View =
  | 'inicio'
  | 'preenchimento-formulacao-queijo'
  | 'listagem-formulacoes-queijo'
  | 'visualizacao-formulacao-queijo'
  | 'edicao-formulacao-queijo'
  | 'preenchimento-soro-refrigerado'
  | 'listagem-soro-refrigerado'
  | 'estoque-soro-refrigerado'
  | 'visualizacao-soro-refrigerado'
  | 'edicao-soro-refrigerado'
  | 'preenchimento-formulacao-creme'
  | 'listagem-formulacoes-creme'
  | 'visualizacao-formulacao-creme'
  | 'edicao-formulacao-creme'
  | 'preenchimento-producao-creme'
  | 'listagem-producoes-creme'
  | 'visualizacao-producao-creme'
  | 'edicao-producao-creme'

type LoadStatus = 'loading' | 'live' | 'error'
type Pagination = { current_page: number; per_page: number; total: number }

function routeFromHash(): View {
  const path = window.location.hash.replace(/^#\/?/, '')
  const view = path.replace(/\/\d+$/, '')

  if (isView(view)) return view

  return 'inicio'
}

function isView(value: string): value is View {
  return [
    'inicio',
    'preenchimento-formulacao-queijo',
    'listagem-formulacoes-queijo',
    'visualizacao-formulacao-queijo',
    'edicao-formulacao-queijo',
    'preenchimento-soro-refrigerado',
    'listagem-soro-refrigerado',
    'estoque-soro-refrigerado',
    'visualizacao-soro-refrigerado',
    'edicao-soro-refrigerado',
    'preenchimento-formulacao-creme',
    'listagem-formulacoes-creme',
    'visualizacao-formulacao-creme',
    'edicao-formulacao-creme',
    'preenchimento-producao-creme',
    'listagem-producoes-creme',
    'visualizacao-producao-creme',
    'edicao-producao-creme',
  ].includes(value)
}

function editIdFromHash(): number | null {
  const match = window.location.hash.replace(/^#\/?/, '').match(/^(edicao|visualizacao)-[^/]+\/(\d+)$/)

  return match ? Number(match[2]) : null
}

function hashForView(view: View, id?: number): string {
  if ((view.startsWith('edicao-') || view.startsWith('visualizacao-')) && id !== undefined) return `#/${view}/${id}`

  return `#/${view}`
}

function optionalString(form: FormData, name: string): string | null {
  const value = String(form.get(name) ?? '').trim()

  return value === '' ? null : value
}

function optionalNumber(form: FormData, name: string): number | null {
  const value = String(form.get(name) ?? '').trim()

  return value === '' ? null : Number(value)
}

export function App() {
  const [view, setView] = useState<View>(() => routeFromHash())
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando produção...')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [formulacoes, setFormulacoes] = useState<FormulacaoQueijo[]>([])
  const [soros, setSoros] = useState<SoroRefrigerado[]>([])
  const [estoqueSoro, setEstoqueSoro] = useState<EstoqueSoroResumo | null>(null)
  const [formulacoesCreme, setFormulacoesCreme] = useState<FormulacaoCreme[]>([])
  const [producoesCreme, setProducoesCreme] = useState<ProducaoCreme[]>([])
  const [pagination, setPagination] = useState<Pagination>({ current_page: 1, per_page: 10, total: 0 })
  const [formulacaoEmEdicao, setFormulacaoEmEdicao] = useState<FormulacaoQueijo | null>(null)
  const [soroEmEdicao, setSoroEmEdicao] = useState<SoroRefrigerado | null>(null)
  const [formulacaoCremeEmEdicao, setFormulacaoCremeEmEdicao] = useState<FormulacaoCreme | null>(null)
  const [producaoCremeEmEdicao, setProducaoCremeEmEdicao] = useState<ProducaoCreme | null>(null)
  const [editId, setEditId] = useState<number | null>(() => editIdFromHash())
  const [search, setSearch] = useState('')

  function navigate(nextView: View, id?: number) {
    window.location.hash = hashForView(nextView, id)
    setEditId(nextView.startsWith('edicao-') || nextView.startsWith('visualizacao-') ? id ?? null : null)
    setView(nextView)
  }

  async function loadOverview() {
    setStatus('loading')
    setStatusText('Carregando produção...')

    try {
      setOverview(await producaoApi.overview())
      setStatus('live')
      setStatusText('Dados carregados.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o módulo.')
    }
  }

  async function loadFormulacoes(page = pagination.current_page) {
    await loadList(() => producaoApi.formulacoesQueijo(search, page, 10), setFormulacoes)
  }

  async function loadSoros(page = pagination.current_page) {
    await loadList(() => producaoApi.soroRefrigerado(search, page, 10), setSoros)
  }

  async function loadEstoqueSoro() {
    setStatus('loading')
    setStatusText('Carregando estoque do soro refrigerado...')

    try {
      setEstoqueSoro(await producaoApi.estoqueSoroRefrigerado())
      setStatus('live')
      setStatusText('Estoque do soro carregado.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o estoque do soro.')
    }
  }

  async function loadFormulacoesCreme(page = pagination.current_page) {
    await loadList(() => producaoApi.formulacoesCreme(search, page, 10), setFormulacoesCreme)
  }

  async function loadProducoesCreme(page = pagination.current_page) {
    await loadList(() => producaoApi.producoesCreme(search, page, 10), setProducoesCreme)
  }

  async function loadList<T>(loader: () => Promise<{ items: T[]; pagination: Pagination }>, setter: (items: T[]) => void) {
    setStatus('loading')
    setStatusText('Carregando fichas...')

    try {
      const result = await loader()
      setter(result.items)
      setPagination(result.pagination)
      setStatus('live')
      setStatusText(`${result.pagination.total} ficha(s) carregada(s).`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar as fichas.')
    }
  }

  async function loadEditRecord(id: number) {
    setStatus('loading')
    setStatusText('Carregando ficha...')

    try {
      if (view === 'edicao-formulacao-queijo' || view === 'visualizacao-formulacao-queijo') setFormulacaoEmEdicao(await producaoApi.formulacaoQueijo(id))
      if (view === 'edicao-soro-refrigerado' || view === 'visualizacao-soro-refrigerado') setSoroEmEdicao(await producaoApi.soroRefrigeradoItem(id))
      if (view === 'edicao-formulacao-creme' || view === 'visualizacao-formulacao-creme') setFormulacaoCremeEmEdicao(await producaoApi.formulacaoCreme(id))
      if (view === 'edicao-producao-creme' || view === 'visualizacao-producao-creme') setProducaoCremeEmEdicao(await producaoApi.producaoCreme(id))
      setStatus('live')
      setStatusText('Ficha carregada.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar a ficha.')
    }
  }

  useEffect(() => {
    const handleHashChange = () => {
      setView(routeFromHash())
      setEditId(editIdFromHash())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (view === 'inicio') void loadOverview()
    else if (view === 'listagem-formulacoes-queijo') void loadFormulacoes()
    else if (view === 'listagem-soro-refrigerado') void loadSoros()
    else if (view === 'estoque-soro-refrigerado') void loadEstoqueSoro()
    else if (view === 'listagem-formulacoes-creme') void loadFormulacoesCreme()
    else if (view === 'listagem-producoes-creme') void loadProducoesCreme()
    else if ((view.startsWith('edicao-') || view.startsWith('visualizacao-')) && editId !== null) void loadEditRecord(editId)
    else {
      setStatus('live')
      setStatusText('Tela de preenchimento pronta.')
    }
  }, [view, editId])

  function payloadFromFormulacaoQueijo(form: FormData): FormulacaoQueijoPayload {
    const insumoTipos = form.getAll('insumo_tipo')
    const insumoQuantidades = form.getAll('insumo_quantidade')
    const insumoUnidades = form.getAll('insumo_unidade')
    const insumoLotes = form.getAll('insumo_lote')

    return {
      tipo_queijo: String(form.get('tipo_queijo') ?? '').trim(),
      data_formulacao: String(form.get('data_formulacao')),
      lote_queijo: String(form.get('lote_queijo') ?? '').trim(),
      lote_leite: optionalString(form, 'lote_leite'),
      silo: optionalString(form, 'silo'),
      numero_queijomatic: optionalString(form, 'numero_queijomatic'),
      inicio_enchimento: String(form.get('inicio_enchimento') ?? '') || null,
      quantidade_leite: optionalNumber(form, 'quantidade_leite'),
      temperatura_pasteurizacao: optionalNumber(form, 'temperatura_pasteurizacao'),
      fosfatase: String(form.get('fosfatase') ?? '') as FormulacaoQueijo['fosfatase'] || null,
      peroxidase: String(form.get('peroxidase') ?? '') as FormulacaoQueijo['peroxidase'] || null,
      gordura_inicial: optionalNumber(form, 'gordura_inicial'),
      gordura_final: optionalNumber(form, 'gordura_final'),
      acidez: optionalNumber(form, 'acidez'),
      temperatura_coagulacao: optionalNumber(form, 'temperatura_coagulacao'),
      hora_coagulacao: String(form.get('hora_coagulacao') ?? '') || null,
      hora_corte: String(form.get('hora_corte') ?? '') || null,
      temperatura_cozimento: optionalNumber(form, 'temperatura_cozimento'),
      insumos: insumoQuantidades
        .map((value, index) => ({
          tipo_insumo: String(insumoTipos[index] ?? 'outro') as FormulacaoQueijo['insumos'][number]['tipo_insumo'],
          quantidade: Number(value || 0),
          unidade: String(insumoUnidades[index] ?? '').trim(),
          lote_insumo: String(insumoLotes[index] ?? '').trim() || null,
        }))
        .filter((insumo) => insumo.quantidade > 0 && insumo.unidade !== ''),
    }
  }

  function payloadFromSoro(form: FormData): SoroRefrigeradoPayload {
    return {
      data_registro: String(form.get('data_registro')),
      entrada_diaria_estoque: optionalNumber(form, 'entrada_diaria_estoque'),
      litragem_vendida: optionalNumber(form, 'litragem_vendida'),
      silo_armazenado: optionalString(form, 'silo_armazenado'),
      responsavel: optionalString(form, 'responsavel'),
    }
  }

  function payloadFromFormulacaoCreme(form: FormData): FormulacaoCremePayload {
    return {
      responsavel_monitoramento: optionalString(form, 'responsavel_monitoramento'),
      mes: optionalNumber(form, 'mes'),
      ano: optionalNumber(form, 'ano'),
      tipo_creme: optionalString(form, 'tipo_creme'),
      data_fabricacao: String(form.get('data_fabricacao')),
      lote_creme_produzido: String(form.get('lote_creme_produzido') ?? '').trim(),
      gordura_inicial: optionalNumber(form, 'gordura_inicial'),
      gordura_final: optionalNumber(form, 'gordura_final'),
      acidez: optionalNumber(form, 'acidez'),
      responsavel: optionalString(form, 'responsavel'),
    }
  }

  function payloadFromProducaoCreme(form: FormData): ProducaoCremePayload {
    return {
      responsavel_monitoramento: optionalString(form, 'responsavel_monitoramento'),
      mes: optionalNumber(form, 'mes'),
      ano: optionalNumber(form, 'ano'),
      tipo_creme: optionalString(form, 'tipo_creme'),
      data_fabricacao: String(form.get('data_fabricacao')),
      lote_creme_produzido: String(form.get('lote_creme_produzido') ?? '').trim(),
      quantidade_produzida_kg: optionalNumber(form, 'quantidade_produzida_kg'),
      responsavel: optionalString(form, 'responsavel'),
    }
  }

  async function saveAndClose<T>(event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<T>, nextView: View) {
    event.preventDefault()
    const formElement = event.currentTarget
    const formData = new FormData(formElement)
    setStatus('loading')
    setStatusText('Salvando ficha...')

    try {
      await action(formData)
      formElement.reset()
      navigate(nextView)
      setStatus('live')
      setStatusText('Ficha salva.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível salvar a ficha.')
    }
  }

  async function updateAndClose<T>(event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<T>, nextView: View) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setStatus('loading')
    setStatusText('Salvando alterações...')

    try {
      await action(formData)
      navigate(nextView)
      setStatus('live')
      setStatusText('Alterações salvas.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível salvar as alterações.')
    }
  }

  async function finalizeCurrent(id: number, action: (id: number) => Promise<unknown>, reload: () => Promise<void>) {
    setStatus('loading')
    setStatusText('Finalizando ficha...')

    try {
      await action(id)
      await reload()
      setStatus('live')
      setStatusText('Ficha finalizada e bloqueada para alterações.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível finalizar a ficha.')
    }
  }

  async function exportCurrent(action: (id: number, formato: ExportFormat) => Promise<{ arquivo: string }>, id: number, formato: ExportFormat) {
    setStatus('loading')
    setStatusText('Gerando documento...')

    try {
      const result = await action(id, formato)
      setStatus('live')
      setStatusText(`Download iniciado: ${result.arquivo}`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível exportar o documento.')
    }
  }

  async function cancelCurrent(id: number, action: (id: number) => Promise<unknown>, reload: () => Promise<void>, nextView?: View) {
    setStatus('loading')
    setStatusText('Cancelando ficha...')

    try {
      await action(id)
      await reload()
      if (nextView) navigate(nextView)
      setStatus('live')
      setStatusText('Ficha cancelada.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível cancelar a ficha.')
    }
  }

  function reloadCurrentView() {
    if (view === 'inicio') void loadOverview()
    if (view === 'listagem-formulacoes-queijo') void loadFormulacoes()
    if (view === 'listagem-soro-refrigerado') void loadSoros()
    if (view === 'estoque-soro-refrigerado') void loadEstoqueSoro()
    if (view === 'listagem-formulacoes-creme') void loadFormulacoesCreme()
    if (view === 'listagem-producoes-creme') void loadProducoesCreme()
    if ((view.startsWith('edicao-') || view.startsWith('visualizacao-')) && editId !== null) void loadEditRecord(editId)
  }

  function searchCurrentList() {
    if (view === 'listagem-formulacoes-queijo') void loadFormulacoes(1)
    if (view === 'listagem-soro-refrigerado') void loadSoros(1)
    if (view === 'listagem-formulacoes-creme') void loadFormulacoesCreme(1)
    if (view === 'listagem-producoes-creme') void loadProducoesCreme(1)
  }

  function changeCurrentPage(page: number) {
    if (view === 'listagem-formulacoes-queijo') void loadFormulacoes(page)
    if (view === 'listagem-soro-refrigerado') void loadSoros(page)
    if (view === 'listagem-formulacoes-creme') void loadFormulacoesCreme(page)
    if (view === 'listagem-producoes-creme') void loadProducoesCreme(page)
  }

  function openFormulacaoQueijo(item: FormulacaoQueijo) {
    navigate(item.status === 'rascunho' ? 'edicao-formulacao-queijo' : 'visualizacao-formulacao-queijo', item.id)
  }

  function openSoroRefrigerado(item: SoroRefrigerado) {
    navigate(item.status === 'rascunho' ? 'edicao-soro-refrigerado' : 'visualizacao-soro-refrigerado', item.id)
  }

  function openFormulacaoCreme(item: FormulacaoCreme) {
    navigate(item.status === 'rascunho' ? 'edicao-formulacao-creme' : 'visualizacao-formulacao-creme', item.id)
  }

  function openProducaoCreme(item: ProducaoCreme) {
    navigate(item.status === 'rascunho' ? 'edicao-producao-creme' : 'visualizacao-producao-creme', item.id)
  }

  const pageTitle = titleForView(view)
  const pageCopy = copyForView(view)

  return (
    <main className="app-shell">
      <ProducaoSidebar view={view} onNavigate={navigate} />

      <section className="content">
        <header className="global-topbar">
          <button className="icon-btn" title="Recarregar" onClick={reloadCurrentView}><RefreshCcw size={16} /></button>
        </header>

        <div className="page">
          <div className="page-head">
            <div><h1>{pageTitle}</h1><p>{pageCopy}</p></div>
          </div>
          <div className={`status-line is-${status}`}><span className="status-dot" />{statusText}</div>

          {view === 'inicio' && overview !== null && <Inicio overview={overview} />}
          {view === 'preenchimento-formulacao-queijo' && <PreenchimentoFormulacaoQueijo onCreate={(event) => saveAndClose(event, (form) => producaoApi.criarFormulacaoQueijo(payloadFromFormulacaoQueijo(form)), 'listagem-formulacoes-queijo')} />}
          {view === 'listagem-formulacoes-queijo' && <ListagemFormulacoesQueijo items={formulacoes} pagination={pagination} search={search} onSearchChange={setSearch} onSearch={searchCurrentList} onPageChange={changeCurrentPage} onOpenItem={openFormulacaoQueijo} onCreateNew={() => navigate('preenchimento-formulacao-queijo')} onFinalize={(id) => void finalizeCurrent(id, producaoApi.finalizarFormulacaoQueijo, loadFormulacoes)} onCancel={(id) => void cancelCurrent(id, producaoApi.cancelarFormulacaoQueijo, loadFormulacoes)} />}
          {view === 'visualizacao-formulacao-queijo' && formulacaoEmEdicao !== null && <VisualizacaoFormulacaoQueijo item={formulacaoEmEdicao} onExport={(formato) => void exportCurrent(producaoApi.exportarFormulacaoQueijo, formulacaoEmEdicao.id, formato)} />}
          {view === 'edicao-formulacao-queijo' && formulacaoEmEdicao !== null && <EdicaoFormulacaoQueijo key={formulacaoEmEdicao.id} item={formulacaoEmEdicao} onSave={(event) => updateAndClose(event, (form) => producaoApi.atualizarFormulacaoQueijo(formulacaoEmEdicao.id, payloadFromFormulacaoQueijo(form)), 'listagem-formulacoes-queijo')} onCancel={() => void cancelCurrent(formulacaoEmEdicao.id, producaoApi.cancelarFormulacaoQueijo, loadFormulacoes, 'listagem-formulacoes-queijo')} />}

          {view === 'preenchimento-soro-refrigerado' && <PreenchimentoSoroRefrigerado onCreate={(event) => saveAndClose(event, (form) => producaoApi.criarSoroRefrigerado(payloadFromSoro(form)), 'listagem-soro-refrigerado')} />}
          {view === 'listagem-soro-refrigerado' && <ListagemSoroRefrigerado items={soros} pagination={pagination} search={search} onSearchChange={setSearch} onSearch={searchCurrentList} onPageChange={changeCurrentPage} onOpenItem={openSoroRefrigerado} onCreateNew={() => navigate('preenchimento-soro-refrigerado')} onOpenEstoque={() => navigate('estoque-soro-refrigerado')} onFinalize={(id) => void finalizeCurrent(id, producaoApi.finalizarSoroRefrigerado, loadSoros)} onCancel={(id) => void cancelCurrent(id, producaoApi.cancelarSoroRefrigerado, loadSoros)} />}
          {view === 'estoque-soro-refrigerado' && <EstoqueSoroRefrigerado resumo={estoqueSoro} />}
          {view === 'visualizacao-soro-refrigerado' && soroEmEdicao !== null && <VisualizacaoSoroRefrigerado item={soroEmEdicao} onExport={(formato) => void exportCurrent(producaoApi.exportarSoroRefrigerado, soroEmEdicao.id, formato)} />}
          {view === 'edicao-soro-refrigerado' && soroEmEdicao !== null && <EdicaoSoroRefrigerado key={soroEmEdicao.id} item={soroEmEdicao} onSave={(event) => updateAndClose(event, (form) => producaoApi.atualizarSoroRefrigerado(soroEmEdicao.id, payloadFromSoro(form)), 'listagem-soro-refrigerado')} onCancel={() => void cancelCurrent(soroEmEdicao.id, producaoApi.cancelarSoroRefrigerado, loadSoros, 'listagem-soro-refrigerado')} />}

          {view === 'preenchimento-formulacao-creme' && <PreenchimentoFormulacaoCreme onCreate={(event) => saveAndClose(event, (form) => producaoApi.criarFormulacaoCreme(payloadFromFormulacaoCreme(form)), 'listagem-formulacoes-creme')} />}
          {view === 'listagem-formulacoes-creme' && <ListagemFormulacoesCreme items={formulacoesCreme} pagination={pagination} search={search} onSearchChange={setSearch} onSearch={searchCurrentList} onPageChange={changeCurrentPage} onOpenItem={openFormulacaoCreme} onCreateNew={() => navigate('preenchimento-formulacao-creme')} onFinalize={(id) => void finalizeCurrent(id, producaoApi.finalizarFormulacaoCreme, loadFormulacoesCreme)} onCancel={(id) => void cancelCurrent(id, producaoApi.cancelarFormulacaoCreme, loadFormulacoesCreme)} />}
          {view === 'visualizacao-formulacao-creme' && formulacaoCremeEmEdicao !== null && <VisualizacaoFormulacaoCreme item={formulacaoCremeEmEdicao} onExport={(formato) => void exportCurrent(producaoApi.exportarFormulacaoCreme, formulacaoCremeEmEdicao.id, formato)} />}
          {view === 'edicao-formulacao-creme' && formulacaoCremeEmEdicao !== null && <EdicaoFormulacaoCreme key={formulacaoCremeEmEdicao.id} item={formulacaoCremeEmEdicao} onSave={(event) => updateAndClose(event, (form) => producaoApi.atualizarFormulacaoCreme(formulacaoCremeEmEdicao.id, payloadFromFormulacaoCreme(form)), 'listagem-formulacoes-creme')} onCancel={() => void cancelCurrent(formulacaoCremeEmEdicao.id, producaoApi.cancelarFormulacaoCreme, loadFormulacoesCreme, 'listagem-formulacoes-creme')} />}

          {view === 'preenchimento-producao-creme' && <PreenchimentoProducaoCreme onCreate={(event) => saveAndClose(event, (form) => producaoApi.criarProducaoCreme(payloadFromProducaoCreme(form)), 'listagem-producoes-creme')} />}
          {view === 'listagem-producoes-creme' && <ListagemProducoesCreme items={producoesCreme} pagination={pagination} search={search} onSearchChange={setSearch} onSearch={searchCurrentList} onPageChange={changeCurrentPage} onOpenItem={openProducaoCreme} onCreateNew={() => navigate('preenchimento-producao-creme')} onFinalize={(id) => void finalizeCurrent(id, producaoApi.finalizarProducaoCreme, loadProducoesCreme)} onCancel={(id) => void cancelCurrent(id, producaoApi.cancelarProducaoCreme, loadProducoesCreme)} />}
          {view === 'visualizacao-producao-creme' && producaoCremeEmEdicao !== null && <VisualizacaoProducaoCreme item={producaoCremeEmEdicao} onExport={(formato) => void exportCurrent(producaoApi.exportarProducaoCreme, producaoCremeEmEdicao.id, formato)} />}
          {view === 'edicao-producao-creme' && producaoCremeEmEdicao !== null && <EdicaoProducaoCreme key={producaoCremeEmEdicao.id} item={producaoCremeEmEdicao} onSave={(event) => updateAndClose(event, (form) => producaoApi.atualizarProducaoCreme(producaoCremeEmEdicao.id, payloadFromProducaoCreme(form)), 'listagem-producoes-creme')} onCancel={() => void cancelCurrent(producaoCremeEmEdicao.id, producaoApi.cancelarProducaoCreme, loadProducoesCreme, 'listagem-producoes-creme')} />}
        </div>
      </section>
    </main>
  )
}

function titleForView(view: View): string {
  const titles: Record<View, string> = {
    inicio: 'Produção',
    'preenchimento-formulacao-queijo': 'Preenchimento da Formulação de Queijo',
    'listagem-formulacoes-queijo': 'Formulações de Queijo',
    'visualizacao-formulacao-queijo': 'Visualização da Formulação de Queijo',
    'edicao-formulacao-queijo': 'Edição da Formulação de Queijo',
    'preenchimento-soro-refrigerado': 'Preenchimento do Soro Refrigerado',
    'listagem-soro-refrigerado': 'Soro Refrigerado',
    'estoque-soro-refrigerado': 'Estoque do Soro Refrigerado',
    'visualizacao-soro-refrigerado': 'Visualização do Soro Refrigerado',
    'edicao-soro-refrigerado': 'Edição do Soro Refrigerado',
    'preenchimento-formulacao-creme': 'Preenchimento da Formulação de Creme',
    'listagem-formulacoes-creme': 'Formulações de Creme',
    'visualizacao-formulacao-creme': 'Visualização da Formulação de Creme',
    'edicao-formulacao-creme': 'Edição da Formulação de Creme',
    'preenchimento-producao-creme': 'Preenchimento da Produção de Creme de Leite e Soro',
    'listagem-producoes-creme': 'Produções de Creme de Leite e Soro',
    'visualizacao-producao-creme': 'Visualização da Produção de Creme de Leite e Soro',
    'edicao-producao-creme': 'Edição da Produção de Creme de Leite e Soro',
  }

  return titles[view]
}

function copyForView(view: View): string {
  if (view === 'inicio') return 'Módulo principal para fichas produtivas.'
  if (view === 'estoque-soro-refrigerado') return 'Saldo, última entrada e movimentações.'
  if (view.includes('preenchimento')) return 'Preenchimento operacional salvo como rascunho.'
  if (view.includes('visualizacao')) return 'Formulário preenchido.'
  if (view.includes('edicao')) return 'Ajuste de ficha em rascunho antes da finalização.'

  return 'Consulta das fichas gravadas.'
}
