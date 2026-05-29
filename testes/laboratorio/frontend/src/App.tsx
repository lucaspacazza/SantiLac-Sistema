import { RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { laboratorioApi, type AguaFilagem, type AguaFilagemPayload, type Cronograma, type Overview } from './api/laboratorioApi'
import { LaboratorioSidebar } from './components/Sidebar/LaboratorioSidebar'
import { EdicaoAguaFilagem } from './views/AguaFilagem/EdicaoAguaFilagem'
import { ListagemAguaFilagem } from './views/AguaFilagem/ListagemAguaFilagem'
import { PreenchimentoAguaFilagem } from './views/AguaFilagem/PreenchimentoAguaFilagem'
import { ListagemCronogramasAnalises } from './views/CronogramaAnalises/ListagemCronogramasAnalises'
import { PreenchimentoCronogramaAnalises } from './views/CronogramaAnalises/PreenchimentoCronogramaAnalises'
import { Inicio } from './views/Inicio/Inicio'

type View =
  | 'inicio'
  | 'preenchimento-cronograma-analises'
  | 'listagem-cronogramas-analises'
  | 'preenchimento-agua-filagem'
  | 'listagem-agua-filagem'
  | 'edicao-agua-filagem'

type LoadStatus = 'loading' | 'live' | 'error'
type Pagination = { current_page: number; per_page: number; total: number }

function routeFromHash(): View {
  const path = window.location.hash.replace(/^#\/?/, '')
  const view = path.replace(/\/\d+$/, '')

  if (['preenchimento-cronograma-analises', 'listagem-cronogramas-analises', 'preenchimento-agua-filagem', 'listagem-agua-filagem', 'edicao-agua-filagem'].includes(view)) {
    return view as View
  }

  return 'inicio'
}

function hashForView(view: View, id?: number): string {
  if (view === 'edicao-agua-filagem' && id !== undefined) return `#/edicao-agua-filagem/${id}`

  return `#/${view}`
}

function editIdFromHash(): number | null {
  const match = window.location.hash.replace(/^#\/?/, '').match(/^edicao-agua-filagem\/(\d+)$/)

  return match ? Number(match[1]) : null
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
  const [statusText, setStatusText] = useState('Carregando laboratório...')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [cronogramas, setCronogramas] = useState<Cronograma[]>([])
  const [aguaFilagem, setAguaFilagem] = useState<AguaFilagem[]>([])
  const [aguaFilagemEmEdicao, setAguaFilagemEmEdicao] = useState<AguaFilagem | null>(null)
  const [pagination, setPagination] = useState<Pagination>({ current_page: 1, per_page: 10, total: 0 })
  const [year, setYear] = useState('')
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<number | null>(() => editIdFromHash())

  function navigate(nextView: View, id?: number) {
    window.location.hash = hashForView(nextView, id)
    setEditId(nextView === 'edicao-agua-filagem' ? id ?? null : null)
    setView(nextView)
  }

  async function loadOverview() {
    setStatus('loading')
    setStatusText('Carregando laboratório...')

    try {
      setOverview(await laboratorioApi.overview())
      setStatus('live')
      setStatusText('Dados carregados do banco.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o módulo.')
    }
  }

  async function loadCronogramas() {
    setStatus('loading')
    setStatusText('Carregando cronogramas do banco...')

    try {
      const result = await laboratorioApi.cronogramas(year)
      setCronogramas(result.items)
      setStatus('live')
      setStatusText(`${result.pagination.total} cronograma(s) carregado(s) do banco.`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar os cronogramas.')
    }
  }

  async function loadAguaFilagem(page = pagination.current_page) {
    setStatus('loading')
    setStatusText('Carregando fichas do banco...')

    try {
      const result = await laboratorioApi.aguaFilagem(search, page, 10)
      setAguaFilagem(result.items)
      setPagination(result.pagination)
      setStatus('live')
      setStatusText(`${result.pagination.total} ficha(s) carregada(s) do banco.`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar as fichas.')
    }
  }

  async function loadAguaFilagemItem(id: number) {
    setStatus('loading')
    setStatusText('Carregando ficha do banco...')

    try {
      setAguaFilagemEmEdicao(await laboratorioApi.aguaFilagemItem(id))
      setStatus('live')
      setStatusText('Ficha carregada do banco.')
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
    else if (view === 'listagem-cronogramas-analises') void loadCronogramas()
    else if (view === 'listagem-agua-filagem') void loadAguaFilagem()
    else if (view === 'edicao-agua-filagem' && editId !== null) void loadAguaFilagemItem(editId)
    else {
      setStatus('live')
      setStatusText('Tela de preenchimento pronta.')
    }
  }, [view, editId])

  async function handleCreateCronograma(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const produto = String(form.get('produto') ?? '').trim()

    await laboratorioApi.criarCronograma({
      ano: Number(form.get('ano')),
      titulo: 'Cronograma de análises de produtos mensais',
      documento_revisao: optionalString(form, 'documento_revisao'),
      observacoes: optionalString(form, 'observacoes'),
      itens: produto
        ? [{
            produto,
            matriz: String(form.get('matriz') ?? 'outro') as Cronograma['itens'][number]['matriz'],
            mes: Number(form.get('mes') || 1),
            tipo_analise: String(form.get('tipo_analise') ?? 'fisico_quimica') as Cronograma['itens'][number]['tipo_analise'],
            ate_dia: Number(form.get('ate_dia') || 15),
            status: 'prevista',
          }]
        : [],
    })

    event.currentTarget.reset()
    navigate('listagem-cronogramas-analises')
    setStatus('live')
    setStatusText('Cronograma salvo no banco.')
  }

  function payloadFromAguaFilagem(form: FormData): AguaFilagemPayload {
    return {
      data_monitoramento: String(form.get('data_monitoramento')),
      sequencia: optionalNumber(form, 'sequencia'),
      hora: String(form.get('hora') ?? '') || null,
      acidez: optionalNumber(form, 'acidez'),
      gordura: optionalNumber(form, 'gordura'),
      ph: optionalNumber(form, 'ph'),
      responsavel: optionalString(form, 'responsavel'),
      observacoes: optionalString(form, 'observacoes'),
    }
  }

  async function handleCreateAguaFilagem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('loading')
    setStatusText('Salvando ficha no banco...')

    try {
      await laboratorioApi.criarAguaFilagem(payloadFromAguaFilagem(new FormData(event.currentTarget)))
      event.currentTarget.reset()
      navigate('listagem-agua-filagem')
      setStatus('live')
      setStatusText('Ficha salva no banco.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível salvar a ficha.')
    }
  }

  async function handleUpdateAguaFilagem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (aguaFilagemEmEdicao === null) return

    setStatus('loading')
    setStatusText('Salvando alterações no banco...')

    try {
      await laboratorioApi.atualizarAguaFilagem(aguaFilagemEmEdicao.id, payloadFromAguaFilagem(new FormData(event.currentTarget)))
      navigate('listagem-agua-filagem')
      setStatus('live')
      setStatusText('Alterações salvas no banco.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível salvar as alterações.')
    }
  }

  async function handleFinalizeAguaFilagem(id: number) {
    setStatus('loading')
    setStatusText('Finalizando ficha...')

    try {
      await laboratorioApi.finalizarAguaFilagem(id)
      await loadAguaFilagem()
      setStatus('live')
      setStatusText('Ficha finalizada e bloqueada para alterações.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível finalizar a ficha.')
    }
  }

  function reloadCurrentView() {
    if (view === 'inicio') void loadOverview()
    if (view === 'listagem-cronogramas-analises') void loadCronogramas()
    if (view === 'listagem-agua-filagem') void loadAguaFilagem()
    if (view === 'edicao-agua-filagem' && editId !== null) void loadAguaFilagemItem(editId)
  }

  const pageTitle = titleForView(view)
  const pageCopy = view === 'inicio'
    ? 'Módulo principal para análises, parâmetros e planejamento laboratorial.'
    : view.includes('preenchimento')
      ? 'Preenchimento operacional salvo como rascunho.'
      : view.includes('edicao')
        ? 'Ajuste de ficha em rascunho antes da finalização.'
        : 'Consulta dos registros gravados no banco.'

  return (
    <main className="app-shell">
      <LaboratorioSidebar view={view} onNavigate={navigate} />

      <section className="content">
        <header className="global-topbar">
          <nav>Laboratório / {pageTitle}</nav>
          <button className="icon-btn" title="Recarregar" onClick={reloadCurrentView}><RefreshCcw size={16} /></button>
        </header>

        <div className="page">
          <div className="page-head">
            <div><h1>{pageTitle}</h1><p>{pageCopy}</p></div>
          </div>
          <div className={`status-line is-${status}`}><span className="status-dot" />{statusText}</div>

          {view === 'inicio' && overview !== null && <Inicio overview={overview} onOpenSubmodulo={(nextView) => navigate(nextView as View)} />}
          {view === 'preenchimento-cronograma-analises' && <PreenchimentoCronogramaAnalises onCreate={handleCreateCronograma} />}
          {view === 'listagem-cronogramas-analises' && <ListagemCronogramasAnalises items={cronogramas} year={year} onYearChange={setYear} onSearch={() => void loadCronogramas()} onCreateNew={() => navigate('preenchimento-cronograma-analises')} />}
          {view === 'preenchimento-agua-filagem' && <PreenchimentoAguaFilagem onCreate={handleCreateAguaFilagem} />}
          {view === 'listagem-agua-filagem' && <ListagemAguaFilagem items={aguaFilagem} pagination={pagination} search={search} onSearchChange={setSearch} onSearch={() => void loadAguaFilagem(1)} onPageChange={(page) => void loadAguaFilagem(page)} onOpenEdit={(id) => navigate('edicao-agua-filagem', id)} onCreateNew={() => navigate('preenchimento-agua-filagem')} onFinalize={(id) => void handleFinalizeAguaFilagem(id)} />}
          {view === 'edicao-agua-filagem' && aguaFilagemEmEdicao !== null && <EdicaoAguaFilagem key={aguaFilagemEmEdicao.id} item={aguaFilagemEmEdicao} onSave={handleUpdateAguaFilagem} />}
        </div>
      </section>
    </main>
  )
}

function titleForView(view: View): string {
  const titles: Record<View, string> = {
    inicio: 'Laboratório',
    'preenchimento-cronograma-analises': 'Preenchimento do Cronograma de Análises',
    'listagem-cronogramas-analises': 'Cronogramas de Análises',
    'preenchimento-agua-filagem': 'Preenchimento da Água de Filagem',
    'listagem-agua-filagem': 'Água de Filagem',
    'edicao-agua-filagem': 'Edição da Água de Filagem',
  }

  return titles[view]
}
