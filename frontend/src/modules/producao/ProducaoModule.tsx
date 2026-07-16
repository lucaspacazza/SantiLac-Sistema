import { RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  producaoApi,
  type EstoqueSoroResumo,
  type FormulacaoCreme,
  type FormulacaoCremePayload,
  type FormulacaoQueijo,
  type FormulacaoQueijoCatalogos,
  type FormulacaoQueijoPayload,
  type OrdemProducao,
  type OrdemProducaoCatalogos,
  type OrdemExportFormat,
  type OrdemProducaoPayload,
  type OrdemProducaoResumo,
  type ExportFormat,
  type Overview,
  type ProducaoCreme,
  type ProducaoCremePayload,
  type SoroRefrigerado,
  type SoroRefrigeradoPayload,
} from './api/producaoApi'
import { EdicaoFormulacaoCreme } from './views/FormulacaoCreme/EdicaoFormulacaoCreme'
import { ListagemFormulacoesCreme } from './views/FormulacaoCreme/ListagemFormulacoesCreme'
import { PreenchimentoFormulacaoCreme } from './views/FormulacaoCreme/PreenchimentoFormulacaoCreme'
import { VisualizacaoFormulacaoCreme } from './views/FormulacaoCreme/VisualizacaoFormulacaoCreme'
import { EdicaoFormulacaoQueijo } from './views/FormulacaoQueijo/EdicaoFormulacaoQueijo'
import { ListagemFormulacoesQueijo } from './views/FormulacaoQueijo/ListagemFormulacoesQueijo'
import { PreenchimentoFormulacaoQueijo } from './views/FormulacaoQueijo/PreenchimentoFormulacaoQueijo'
import { TodosFormulacoesQueijo } from './views/FormulacaoQueijo/TodosFormulacoesQueijo'
import { VisualizacaoFormulacaoQueijo } from './views/FormulacaoQueijo/VisualizacaoFormulacaoQueijo'
import { Inicio } from './views/Inicio/Inicio'
import { ConsultaOrdemProducao } from './views/OrdemProducao/ConsultaOrdemProducao'
import { PreenchimentoOrdemProducao } from './views/OrdemProducao/PreenchimentoOrdemProducao'
import { VisualizacaoOrdemProducao } from './views/OrdemProducao/VisualizacaoOrdemProducao'
import { EdicaoProducaoCreme } from './views/ProducaoCreme/EdicaoProducaoCreme'
import { ListagemProducoesCreme } from './views/ProducaoCreme/ListagemProducoesCreme'
import { PreenchimentoProducaoCreme } from './views/ProducaoCreme/PreenchimentoProducaoCreme'
import { VisualizacaoProducaoCreme } from './views/ProducaoCreme/VisualizacaoProducaoCreme'
import { EdicaoSoroRefrigerado } from './views/SoroRefrigerado/EdicaoSoroRefrigerado'
import { EstoqueSoroRefrigerado } from './views/SoroRefrigerado/EstoqueSoroRefrigerado'
import { ListagemSoroRefrigerado } from './views/SoroRefrigerado/ListagemSoroRefrigerado'
import { PreenchimentoSoroRefrigerado } from './views/SoroRefrigerado/PreenchimentoSoroRefrigerado'
import { VisualizacaoSoroRefrigerado } from './views/SoroRefrigerado/VisualizacaoSoroRefrigerado'
import './producao.css'

type View =
  | 'inicio'
  | 'preenchimento-formulacao-queijo'
  | 'listagem-formulacoes-queijo'
  | 'todos-formulacoes-queijo'
  | 'ordem-producao'
  | 'preenchimento-ordem-producao'
  | 'visualizacao-ordem-producao'
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
  const path = window.location.hash.replace(/^#\/?/, '').replace(/^producao\/?/, '')
  const view = path.replace(/\/\d+$/, '')

  if (isView(view)) return view

  return 'inicio'
}

function isView(value: string): value is View {
  return [
    'inicio',
    'preenchimento-formulacao-queijo',
    'listagem-formulacoes-queijo',
    'todos-formulacoes-queijo',
    'ordem-producao',
    'preenchimento-ordem-producao',
    'visualizacao-ordem-producao',
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
  const match = window.location.hash.replace(/^#\/?/, '').replace(/^producao\/?/, '').match(/^(edicao|visualizacao)-[^/]+\/(\d+)$/)

  return match ? Number(match[2]) : null
}

function hashForView(view: View, id?: number): string {
  if ((view.startsWith('edicao-') || view.startsWith('visualizacao-')) && id !== undefined) return `#/producao/${view}/${id}`

  return `#/producao/${view}`
}

function optionalString(form: FormData, name: string): string | null {
  const value = String(form.get(name) ?? '').trim()

  return value === '' ? null : value
}

function optionalNumber(form: FormData, name: string): number | null {
  const value = String(form.get(name) ?? '').trim()

  return value === '' ? null : Number(value)
}

function formatDateInput(value: string): string {
  if (!value) return ''
  const [year, month, day] = value.split('-')

  return `${day}/${month}/${year}`
}

export function ProducaoModule() {
  const [view, setView] = useState<View>(() => routeFromHash())
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando produção...')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [formulacoes, setFormulacoes] = useState<FormulacaoQueijo[]>([])
  const [ordensProducao, setOrdensProducao] = useState<OrdemProducaoResumo[]>([])
  const [ordemProducao, setOrdemProducao] = useState<OrdemProducao | null>(null)
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
  const [dataFormulacaoQueijo, setDataFormulacaoQueijo] = useState('')
  const [consultouFormulacaoQueijo, setConsultouFormulacaoQueijo] = useState(false)
  const [dataOrdemProducao, setDataOrdemProducao] = useState('')
  const [consultouOrdemProducao, setConsultouOrdemProducao] = useState(false)
  const [salvandoOrdemProducao, setSalvandoOrdemProducao] = useState(false)
  const [catalogosOrdemProducao, setCatalogosOrdemProducao] = useState<OrdemProducaoCatalogos>({ queijos: [], insumos: [] })
  const [catalogosFormulacaoQueijo, setCatalogosFormulacaoQueijo] = useState<FormulacaoQueijoCatalogos>({ queijos: [], insumos: [] })
  const [confirmacaoOp, setConfirmacaoOp] = useState<{ id: number; origem: 'lista' | 'todos' } | null>(null)

  function navigate(nextView: View, id?: number) {
    window.location.hash = hashForView(nextView, id)
    setEditId(nextView.startsWith('edicao-') || nextView.startsWith('visualizacao-') ? id ?? null : null)
    setView(nextView)
  }

  function changeDataFormulacaoQueijo(value: string) {
    setDataFormulacaoQueijo(value)
    setConsultouFormulacaoQueijo(false)
    setFormulacoes([])
    setPagination({ current_page: 1, per_page: 100, total: 0 })
    setStatus('live')
    setStatusText(value ? 'Clique em buscar para consultar a data selecionada.' : 'Escolha uma data para consultar.')
  }

  function changeDataOrdemProducao(value: string) {
    setDataOrdemProducao(value)
    setConsultouOrdemProducao(false)
    setOrdensProducao([])
    setOrdemProducao(null)
    setStatus('live')
    setStatusText(value ? 'Clique em buscar para consultar a ordem.' : 'Escolha uma data para consultar.')
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
    if (!dataFormulacaoQueijo) {
      setFormulacoes([])
      setPagination({ current_page: 1, per_page: 100, total: 0 })
      setConsultouFormulacaoQueijo(false)
      setStatus('live')
      setStatusText('Escolha uma data para consultar.')
      return
    }

    setConsultouFormulacaoQueijo(true)
    await loadList(() => producaoApi.formulacoesQueijo('', page, 100, dataFormulacaoQueijo), setFormulacoes)
  }

  async function loadTodasFormulacoes(page = pagination.current_page) {
    await loadList(() => producaoApi.formulacoesQueijo(search, page, 10), setFormulacoes)
  }

  async function loadOrdemProducao() {
    if (!dataOrdemProducao) {
      setOrdensProducao([])
      setOrdemProducao(null)
      setConsultouOrdemProducao(false)
      setStatus('live')
      setStatusText('Escolha uma data para consultar.')
      return
    }

    setStatus('loading')
    setStatusText('Gerando ordem de produção...')

    try {
      const result = await producaoApi.ordensProducao(dataOrdemProducao)
      setOrdensProducao(result)
      setConsultouOrdemProducao(true)
      setStatus('live')
      setStatusText(`${result.length} OP(s) carregada(s).`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível gerar a ordem.')
    }
  }

  async function loadOrdemProducaoItem(id: number) {
    setStatus('loading')
    setStatusText('Carregando OP...')

    try {
      setOrdemProducao(await producaoApi.ordemProducao(id))
      setStatus('live')
      setStatusText('OP carregada.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar a OP.')
    }
  }

  async function saveOrdemProducao(campos: OrdemProducaoPayload['campos']) {
    if (!dataOrdemProducao) {
      setStatus('live')
      setStatusText('Escolha uma data para consultar.')
      return
    }

    setSalvandoOrdemProducao(true)
    setStatus('loading')
    setStatusText('Salvando ordem de produção...')

    try {
      const payload = {
        data: dataOrdemProducao,
        campos,
      }
      const result = ordemProducao?.id !== null && ordemProducao?.id !== undefined
        ? await producaoApi.atualizarOrdemProducao(ordemProducao.id, payload)
        : await producaoApi.salvarOrdemProducao(payload)
      setOrdemProducao(result)
      setConsultouOrdemProducao(true)
      setStatus('live')
      setStatusText('Ordem de produção salva.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível salvar a ordem.')
    } finally {
      setSalvandoOrdemProducao(false)
    }
  }

  async function finalizeOrdemProducao() {
    if (ordemProducao?.id === null || ordemProducao?.id === undefined) {
      setStatus('live')
      setStatusText('Salve a OP antes de finalizar.')
      return
    }

    setSalvandoOrdemProducao(true)
    setStatus('loading')
    setStatusText('Finalizando ordem de produção...')

    try {
      const result = await producaoApi.finalizarOrdemProducao(ordemProducao.id)
      setOrdemProducao(result)
      if (dataOrdemProducao && consultouOrdemProducao) {
        setOrdensProducao(await producaoApi.ordensProducao(dataOrdemProducao))
      }
      setStatus('live')
      setStatusText('Ordem de produção finalizada.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível finalizar a ordem.')
    } finally {
      setSalvandoOrdemProducao(false)
    }
  }

  async function definirFormatoOrdemProducao(formato: 'f1' | 'f4' | 'f6') {
    if (ordemProducao?.id === null || ordemProducao?.id === undefined) {
      setStatus('live')
      setStatusText('OP não carregada.')
      return
    }

    setSalvandoOrdemProducao(true)
    setStatus('loading')
    setStatusText('Finalizando formato da OP...')

    try {
      const result = await producaoApi.definirFormatoOrdemProducao(ordemProducao.id, formato)
      setOrdemProducao(result)
      if (dataOrdemProducao && consultouOrdemProducao) {
        setOrdensProducao(await producaoApi.ordensProducao(dataOrdemProducao))
      }
      setStatus('live')
      setStatusText('Formato definido. OP finalizada.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível finalizar o formato da OP.')
    } finally {
      setSalvandoOrdemProducao(false)
    }
  }

  async function createOrdemProducao() {
    if (!dataOrdemProducao) {
      setStatus('live')
      setStatusText('Escolha uma data para criar a OP.')
      return
    }

    setSalvandoOrdemProducao(true)
    setStatus('loading')
    setStatusText('Criando OP...')

    try {
      const ordemSalva = await producaoApi.salvarOrdemProducao({
        data: dataOrdemProducao,
        campos: [],
      })
      setOrdemProducao(ordemSalva)
      setConsultouOrdemProducao(true)
      setStatus('live')
      setStatusText(`OP ${ordemSalva.codigo_ordem ?? ''} criada.`.trim())
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível criar a OP.')
    } finally {
      setSalvandoOrdemProducao(false)
    }
  }

  async function createManualOrdemProducao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = payloadFromOrdemProducao(new FormData(event.currentTarget))

    setSalvandoOrdemProducao(true)
    setStatus('loading')
    setStatusText('Salvando OP...')

    try {
      const result = await producaoApi.salvarOrdemProducao(payload)
      setDataOrdemProducao(payload.data)
      setOrdemProducao(result)
      setConsultouOrdemProducao(true)
      if (result.id !== null) navigate('visualizacao-ordem-producao', result.id)
      else navigate('ordem-producao')
      setStatus('live')
      setStatusText(`OP ${result.codigo_ordem ?? ''} salva.`.trim())
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível salvar a OP.')
    } finally {
      setSalvandoOrdemProducao(false)
    }
  }

  async function loadCatalogosOrdemProducao() {
    setStatus('loading')
    setStatusText('Carregando opções...')

    try {
      setCatalogosOrdemProducao(await producaoApi.ordemProducaoCatalogos())
      setStatus('live')
      setStatusText('Tela de preenchimento pronta.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar as opções.')
    }
  }

  async function loadCatalogosFormulacaoQueijo() {
    setStatus('loading')
    setStatusText('Carregando opções...')

    try {
      setCatalogosFormulacaoQueijo(await producaoApi.formulacaoQueijoCatalogos())
      setStatus('live')
      setStatusText('Tela de preenchimento pronta.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar as opções.')
    }
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
      if (view === 'visualizacao-ordem-producao') await loadOrdemProducaoItem(id)
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
    else if (view === 'preenchimento-formulacao-queijo') {
      void loadCatalogosFormulacaoQueijo()
    }
    else if (view === 'listagem-formulacoes-queijo') {
      if (dataFormulacaoQueijo && consultouFormulacaoQueijo) {
        setStatus('live')
        setStatusText(`${pagination.total} ficha(s) carregada(s).`)
        return
      }

      setStatus('live')
      setStatusText('Escolha uma data para consultar.')
    }
    else if (view === 'todos-formulacoes-queijo') void loadTodasFormulacoes(1)
    else if (view === 'ordem-producao') {
      setStatus('live')
      setStatusText(dataOrdemProducao && consultouOrdemProducao ? 'Ordem carregada.' : 'Escolha uma data para consultar.')
    }
    else if (view === 'preenchimento-ordem-producao') {
      void loadCatalogosOrdemProducao()
    }
    else if (view === 'listagem-soro-refrigerado') void loadSoros()
    else if (view === 'estoque-soro-refrigerado') void loadEstoqueSoro()
    else if (view === 'listagem-formulacoes-creme') void loadFormulacoesCreme()
    else if (view === 'listagem-producoes-creme') void loadProducoesCreme()
    else if (view === 'edicao-formulacao-queijo' && editId !== null) {
      void loadCatalogosFormulacaoQueijo()
      void loadEditRecord(editId)
    }
    else if ((view.startsWith('edicao-') || view.startsWith('visualizacao-')) && editId !== null) void loadEditRecord(editId)
    else {
      setStatus('live')
      setStatusText('Tela de preenchimento pronta.')
    }
  }, [view, editId])

  function payloadFromFormulacaoQueijo(form: FormData): FormulacaoQueijoPayload {
    const insumoTipos = form.getAll('insumo_tipo')
    const insumoNomes = form.getAll('insumo_nome')
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
          nome_insumo: String(insumoNomes[index] ?? '').trim() || null,
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

  function payloadFromOrdemProducao(form: FormData): OrdemProducaoPayload {
    const produto = String(form.get('produto_codigo') ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const lote = String(form.get('lote_codigo') ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const data = String(form.get('data') ?? '')
    const litros = String(form.get('lts_total') ?? '').trim()
    const produtoRotulo = String(form.get('produto_op_rotulo') ?? '').trim()
    const insumoRotulos = form.getAll('insumo_op_rotulo')
    const insumoQuantidades = form.getAll('insumo_quantidade')
    const insumoUnidades = form.getAll('insumo_unidade')

    const campos: OrdemProducaoPayload['campos'] = [
      { rotulo: 'PRODUÇÃO DIARIA / DATA', valor: formatDateInput(data) },
    ]

    if (litros !== '') {
      campos.push({ rotulo: 'LTS PRODUZIDOS TOTAL', valor: `${litros} L` })
    }

    if (produtoRotulo !== '') {
      campos.push({ rotulo: produtoRotulo, valor: '' })
    }

    insumoQuantidades.forEach((quantidade, index) => {
      const valor = String(quantidade ?? '').trim()
      const rotulo = String(insumoRotulos[index] ?? '').trim()
      const unidade = String(insumoUnidades[index] ?? '').trim()

      if (valor !== '' && rotulo !== '') {
        campos.push({ rotulo, valor: unidade !== '' ? `${valor} ${unidade}` : valor })
      }
    })

    return {
      data,
      codigo_ordem: `op${produto}${lote}`,
      campos,
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

  function pedirFinalizacaoFormulacaoQueijo(id: number) {
    setConfirmacaoOp({ id, origem: view === 'todos-formulacoes-queijo' ? 'todos' : 'lista' })
  }

  async function finalizarFormulacaoQueijo(gerarOp: boolean) {
    if (confirmacaoOp === null) return

    const { id, origem } = confirmacaoOp
    const reload = origem === 'todos' ? loadTodasFormulacoes : loadFormulacoes
    setConfirmacaoOp(null)
    setStatus('loading')
    setStatusText(gerarOp ? 'Finalizando ficha e gerando OP...' : 'Finalizando ficha...')

    try {
      await producaoApi.finalizarFormulacaoQueijo(id)
      const ordem = gerarOp ? await producaoApi.gerarOpFormulacaoQueijo(id) : null
      await reload()
      setStatus('live')
      setStatusText(ordem ? `Ficha finalizada. OP ${ordem.codigo_ordem ?? ''} gerada.`.trim() : 'Ficha finalizada.')
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

  async function exportOrdensDoDia(formato: OrdemExportFormat) {
    if (!dataOrdemProducao) {
      setStatus('live')
      setStatusText('Escolha uma data para exportar.')
      return
    }

    setStatus('loading')
    setStatusText('Gerando exportação das OPs...')

    try {
      const result = await producaoApi.exportarOrdensProducaoDia(dataOrdemProducao, formato)
      setStatus('live')
      setStatusText(`Download iniciado: ${result.arquivo}`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível exportar as OPs.')
    }
  }

  async function exportOrdemAtual(formato: OrdemExportFormat) {
    if (ordemProducao?.id === null || ordemProducao?.id === undefined) {
      setStatus('live')
      setStatusText('OP não carregada.')
      return
    }

    setStatus('loading')
    setStatusText('Gerando exportação da OP...')

    try {
      const result = await producaoApi.exportarOrdemProducao(ordemProducao.id, formato)
      setStatus('live')
      setStatusText(`Download iniciado: ${result.arquivo}`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível exportar a OP.')
    }
  }

  async function cancelCurrent(id: number, action: (id: number) => Promise<unknown>, reload: () => Promise<void>, nextView?: View) {
    setStatus('loading')
    setStatusText('Excluindo ficha...')

    try {
      await action(id)
      await reload()
      if (nextView) navigate(nextView)
      setStatus('live')
      setStatusText('Ficha excluída.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível excluir a ficha.')
    }
  }

  function reloadCurrentView() {
    if (view === 'inicio') void loadOverview()
    if (view === 'listagem-formulacoes-queijo') void loadFormulacoes()
    if (view === 'todos-formulacoes-queijo') void loadTodasFormulacoes()
    if (view === 'ordem-producao') void loadOrdemProducao()
    if (view === 'listagem-soro-refrigerado') void loadSoros()
    if (view === 'estoque-soro-refrigerado') void loadEstoqueSoro()
    if (view === 'listagem-formulacoes-creme') void loadFormulacoesCreme()
    if (view === 'listagem-producoes-creme') void loadProducoesCreme()
    if ((view.startsWith('edicao-') || view.startsWith('visualizacao-')) && editId !== null) void loadEditRecord(editId)
  }

  function searchCurrentList() {
    if (view === 'listagem-formulacoes-queijo') void loadFormulacoes(1)
    if (view === 'todos-formulacoes-queijo') void loadTodasFormulacoes(1)
    if (view === 'listagem-soro-refrigerado') void loadSoros(1)
    if (view === 'listagem-formulacoes-creme') void loadFormulacoesCreme(1)
    if (view === 'listagem-producoes-creme') void loadProducoesCreme(1)
  }

  function changeCurrentPage(page: number) {
    if (view === 'listagem-formulacoes-queijo') void loadFormulacoes(page)
    if (view === 'todos-formulacoes-queijo') void loadTodasFormulacoes(page)
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
    <section className="producao-module page">
      <header className="global-topbar">
          <button className="icon-btn" title="Recarregar" onClick={reloadCurrentView}><RefreshCcw size={16} /></button>
      </header>

      <div className="page-body">
          <div className="page-head">
            <div><h1>{pageTitle}</h1><p>{pageCopy}</p></div>
          </div>
          <div className={`status-line is-${status}`}><span className="status-dot" />{statusText}</div>

          {view === 'inicio' && overview !== null && <Inicio overview={overview} />}
          {view === 'preenchimento-formulacao-queijo' && <PreenchimentoFormulacaoQueijo catalogos={catalogosFormulacaoQueijo} onCreate={(event) => saveAndClose(event, (form) => producaoApi.criarFormulacaoQueijo(payloadFromFormulacaoQueijo(form)), 'listagem-formulacoes-queijo')} />}
          {view === 'listagem-formulacoes-queijo' && <ListagemFormulacoesQueijo items={formulacoes} selectedDate={dataFormulacaoQueijo} hasSearched={consultouFormulacaoQueijo} onDateChange={changeDataFormulacaoQueijo} onSearch={searchCurrentList} onShowAll={() => navigate('todos-formulacoes-queijo')} onOpenItem={openFormulacaoQueijo} onCreateNew={() => navigate('preenchimento-formulacao-queijo')} onFinalize={pedirFinalizacaoFormulacaoQueijo} onCancel={(id) => void cancelCurrent(id, producaoApi.cancelarFormulacaoQueijo, loadFormulacoes)} />}
          {view === 'todos-formulacoes-queijo' && <TodosFormulacoesQueijo items={formulacoes} pagination={pagination} search={search} onSearchChange={setSearch} onSearch={searchCurrentList} onPageChange={changeCurrentPage} onBack={() => navigate('listagem-formulacoes-queijo')} onOpenItem={openFormulacaoQueijo} onCreateNew={() => navigate('preenchimento-formulacao-queijo')} onFinalize={pedirFinalizacaoFormulacaoQueijo} onCancel={(id) => void cancelCurrent(id, producaoApi.cancelarFormulacaoQueijo, loadTodasFormulacoes)} />}
          {view === 'ordem-producao' && <ConsultaOrdemProducao data={dataOrdemProducao} ordens={ordensProducao} consultou={consultouOrdemProducao} onDataChange={changeDataOrdemProducao} onSearch={loadOrdemProducao} onCreate={() => navigate('preenchimento-ordem-producao')} onOpen={(id) => navigate('visualizacao-ordem-producao', id)} onExport={(formato) => void exportOrdensDoDia(formato)} />}
          {view === 'preenchimento-ordem-producao' && <PreenchimentoOrdemProducao catalogos={catalogosOrdemProducao} onCreate={createManualOrdemProducao} onBack={() => navigate('ordem-producao')} />}
          {view === 'visualizacao-ordem-producao' && ordemProducao !== null && <VisualizacaoOrdemProducao ordem={ordemProducao} salvando={salvandoOrdemProducao} onBack={() => navigate('ordem-producao')} onSave={saveOrdemProducao} onFinalize={finalizeOrdemProducao} onDefinirFormato={(formato) => void definirFormatoOrdemProducao(formato)} onExport={(formato) => void exportOrdemAtual(formato)} />}
          {view === 'visualizacao-formulacao-queijo' && formulacaoEmEdicao !== null && <VisualizacaoFormulacaoQueijo item={formulacaoEmEdicao} onBack={() => navigate('listagem-formulacoes-queijo')} onExport={(formato) => void exportCurrent(producaoApi.exportarFormulacaoQueijo, formulacaoEmEdicao.id, formato)} />}
          {view === 'edicao-formulacao-queijo' && formulacaoEmEdicao !== null && <EdicaoFormulacaoQueijo key={formulacaoEmEdicao.id} item={formulacaoEmEdicao} catalogos={catalogosFormulacaoQueijo} onSave={(event) => updateAndClose(event, (form) => producaoApi.atualizarFormulacaoQueijo(formulacaoEmEdicao.id, payloadFromFormulacaoQueijo(form)), 'listagem-formulacoes-queijo')} onCancel={() => void cancelCurrent(formulacaoEmEdicao.id, producaoApi.cancelarFormulacaoQueijo, loadFormulacoes, 'listagem-formulacoes-queijo')} />}

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

      {confirmacaoOp !== null && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="confirm-modal">
            <h2>Gerar OP automaticamente?</h2>
            <p>A formulação será finalizada. Se confirmar, a OP será preenchida com os dados usados nessa formulação.</p>
            <div className="confirm-actions">
              <button className="btn subtle" type="button" onClick={() => void finalizarFormulacaoQueijo(false)}>Não</button>
              <button className="btn primary" type="button" onClick={() => void finalizarFormulacaoQueijo(true)}>Sim, gerar OP</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function titleForView(view: View): string {
  const titles: Record<View, string> = {
    inicio: 'Produção',
    'preenchimento-formulacao-queijo': 'Preenchimento da Formulação de Queijo',
    'listagem-formulacoes-queijo': 'Formulações de Queijo',
    'todos-formulacoes-queijo': 'Registros de Formulação de Queijo',
    'ordem-producao': 'Ordem de Produção',
    'preenchimento-ordem-producao': 'Criar Ordem de Produção',
    'visualizacao-ordem-producao': 'Ordem de Produção',
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
  if (view === 'listagem-formulacoes-queijo') return 'Consulta por data das fichas gravadas.'
  if (view === 'todos-formulacoes-queijo') return 'Consulta geral para auditoria dos registros.'
  if (view === 'ordem-producao') return ''
  if (view === 'preenchimento-ordem-producao') return ''
  if (view === 'visualizacao-ordem-producao') return ''
  if (view.includes('preenchimento')) return 'Preenchimento operacional salvo como rascunho.'
  if (view.includes('visualizacao')) return 'Formulário preenchido.'
  if (view.includes('edicao')) return 'Ajuste de ficha em rascunho antes da finalização.'

  return 'Consulta das fichas gravadas.'
}
