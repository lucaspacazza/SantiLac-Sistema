import { Activity, CheckCircle2, ClipboardList, Factory, FlaskConical, Milk, RefreshCcw, Save, Wheat } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  producaoApi,
  type FormulacaoQueijoCatalogos,
  type FormulacaoQueijoPayload,
  type OrdemProducaoPayload,
  type OrdemProducaoResumo,
  type Overview,
  type SoroRefrigeradoPayload,
} from '../producao/api/producaoApi'

type FabricaView = 'inicio' | 'ordens' | 'queijo' | 'soro'
type LoadState = 'loading' | 'ready' | 'error' | 'saving'

const views: Array<{
  id: FabricaView
  title: string
  subtitle: string
  icon: typeof ClipboardList
}> = [
  { id: 'ordens', title: 'OP', subtitle: 'Criar e acompanhar ordens do dia', icon: ClipboardList },
  { id: 'queijo', title: 'Formulação', subtitle: 'Registrar formulação de queijo', icon: FlaskConical },
  { id: 'soro', title: 'Soro', subtitle: 'Registrar entrada e saída de soro', icon: Milk },
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function numberValue(form: FormData, field: string): number | null {
  const value = String(form.get(field) ?? '').replace(',', '.').trim()

  return value === '' ? null : Number(value)
}

function stringValue(form: FormData, field: string): string | null {
  const value = String(form.get(field) ?? '').trim()

  return value === '' ? null : value
}

function fieldValue(form: FormData, field: string): string {
  return String(form.get(field) ?? '').trim()
}

function submitValue(event: FormEvent<HTMLFormElement>, field: string): string {
  const submitter = (event.nativeEvent as SubmitEvent).submitter

  return submitter instanceof HTMLButtonElement && submitter.name === field ? submitter.value : ''
}

export function FabricaApp() {
  const [view, setView] = useState<FabricaView>('inicio')
  const [state, setState] = useState<LoadState>('loading')
  const [message, setMessage] = useState('Carregando produção...')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [ordens, setOrdens] = useState<OrdemProducaoResumo[]>([])
  const [catalogosQueijo, setCatalogosQueijo] = useState<FormulacaoQueijoCatalogos>({ queijos: [], insumos: [] })
  const [selectedDate, setSelectedDate] = useState(today())

  const resumo = useMemo(() => {
    const totais = overview?.totais

    return [
      { label: 'Formulações', value: totais?.formulacoes_queijo ?? 0 },
      { label: 'Soro', value: totais?.soro_refrigerado ?? 0 },
      { label: 'Creme', value: totais?.producoes_creme ?? 0 },
      { label: 'Rascunhos', value: totais?.rascunhos ?? 0 },
    ]
  }, [overview])

  async function loadBase(date = selectedDate) {
    setState('loading')
    setMessage('Carregando produção...')

    try {
      const [overviewData, ordensData, catalogosData] = await Promise.all([
        producaoApi.overview(),
        producaoApi.ordensProducao(date),
        producaoApi.formulacaoQueijoCatalogos(),
      ])

      setOverview(overviewData)
      setOrdens(ordensData)
      setCatalogosQueijo(catalogosData)
      setState('ready')
      setMessage('Pronto para lançamento.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a produção.')
    }
  }

  useEffect(() => {
    void loadBase()
  }, [])

  async function refreshDate(date: string) {
    setSelectedDate(date)
    await loadBase(date)
  }

  async function saveOrdem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const produto = fieldValue(form, 'produto')
    const lote = fieldValue(form, 'lote')
    const litros = fieldValue(form, 'litros')
    const payload: OrdemProducaoPayload = {
      data: fieldValue(form, 'data'),
      codigo_ordem: stringValue(form, 'codigo_ordem'),
      campos: [
        { rotulo: 'PRODUTO', valor: produto },
        { rotulo: 'LOTE', valor: lote },
        { rotulo: 'LTS PRODUZIDOS TOTAL', valor: litros ? `${litros} L` : '' },
      ].filter((campo) => campo.valor !== ''),
    }

    setState('saving')
    setMessage('Salvando OP...')

    try {
      await producaoApi.salvarOrdemProducao(payload)
      event.currentTarget.reset()
      await loadBase(payload.data)
      setSelectedDate(payload.data)
      setView('ordens')
      setMessage('OP salva.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a OP.')
    }
  }

  async function saveQueijo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const shouldFinalize = submitValue(event, 'finalizar') === '1'
    const payload: FormulacaoQueijoPayload = {
      tipo_queijo: fieldValue(form, 'tipo_queijo'),
      data_formulacao: fieldValue(form, 'data_formulacao'),
      silo: stringValue(form, 'silo'),
      lote_leite: stringValue(form, 'lote_leite'),
      lote_queijo: fieldValue(form, 'lote_queijo'),
      numero_queijomatic: stringValue(form, 'numero_queijomatic'),
      inicio_enchimento: stringValue(form, 'inicio_enchimento'),
      quantidade_leite: numberValue(form, 'quantidade_leite'),
      temperatura_pasteurizacao: numberValue(form, 'temperatura_pasteurizacao'),
      fosfatase: stringValue(form, 'fosfatase') as FormulacaoQueijoPayload['fosfatase'],
      peroxidase: stringValue(form, 'peroxidase') as FormulacaoQueijoPayload['peroxidase'],
      gordura_inicial: numberValue(form, 'gordura_inicial'),
      gordura_final: numberValue(form, 'gordura_final'),
      acidez: numberValue(form, 'acidez'),
      temperatura_coagulacao: numberValue(form, 'temperatura_coagulacao'),
      hora_coagulacao: stringValue(form, 'hora_coagulacao'),
      hora_corte: stringValue(form, 'hora_corte'),
      temperatura_cozimento: numberValue(form, 'temperatura_cozimento'),
      insumos: [],
    }

    setState('saving')
    setMessage('Salvando formulação...')

    try {
      const created = await producaoApi.criarFormulacaoQueijo(payload)
      if (shouldFinalize) {
        await producaoApi.finalizarFormulacaoQueijo(created.id)
      }
      event.currentTarget.reset()
      await loadBase(payload.data_formulacao)
      setSelectedDate(payload.data_formulacao)
      setView('inicio')
      setMessage(shouldFinalize ? 'Formulação finalizada.' : 'Formulação salva em rascunho.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a formulação.')
    }
  }

  async function saveSoro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const shouldFinalize = submitValue(event, 'finalizar') === '1'
    const payload: SoroRefrigeradoPayload = {
      data_registro: fieldValue(form, 'data_registro'),
      entrada_diaria_estoque: numberValue(form, 'entrada_diaria_estoque'),
      litragem_vendida: numberValue(form, 'litragem_vendida'),
      silo_armazenado: stringValue(form, 'silo_armazenado'),
      responsavel: stringValue(form, 'responsavel'),
    }

    setState('saving')
    setMessage('Salvando soro...')

    try {
      const created = await producaoApi.criarSoroRefrigerado(payload)
      if (shouldFinalize) {
        await producaoApi.finalizarSoroRefrigerado(created.id)
      }
      event.currentTarget.reset()
      await loadBase(payload.data_registro)
      setSelectedDate(payload.data_registro)
      setView('inicio')
      setMessage(shouldFinalize ? 'Soro finalizado.' : 'Soro salvo em rascunho.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o soro.')
    }
  }

  return (
    <main className="fabrica-app">
      <header className="fabrica-topbar">
        <button className="fabrica-brand" type="button" onClick={() => setView('inicio')}>
          <Factory size={24} />
          <span>Produção</span>
        </button>
        <div className="fabrica-date">
          <input type="date" value={selectedDate} onChange={(event) => void refreshDate(event.target.value)} />
          <button type="button" onClick={() => void loadBase()} aria-label="Atualizar">
            <RefreshCcw size={19} />
          </button>
        </div>
      </header>

      <section className={`fabrica-status is-${state}`}>
        <Activity size={18} />
        <span>{message}</span>
      </section>

      {view === 'inicio' && (
        <section className="fabrica-grid">
          <div className="fabrica-panel fabrica-overview">
            <div className="fabrica-panel-head">
              <span>Resumo</span>
              <small>{selectedDate}</small>
            </div>
            <div className="fabrica-metrics">
              {resumo.map((item) => (
                <div className="fabrica-metric" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fabrica-actions">
            {views.map((item) => {
              const Icon = item.icon

              return (
                <button className="fabrica-action" type="button" key={item.id} onClick={() => setView(item.id)}>
                  <Icon size={30} />
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </button>
              )
            })}
          </div>

          <div className="fabrica-panel fabrica-list-panel">
            <div className="fabrica-panel-head">
              <span>OPs do dia</span>
              <small>{ordens.length}</small>
            </div>
            <div className="fabrica-list">
              {ordens.length === 0 ? (
                <div className="fabrica-empty">Nenhuma OP para a data.</div>
              ) : ordens.map((ordem) => (
                <div className="fabrica-row" key={ordem.id}>
                  <div>
                    <strong>{ordem.codigo_ordem}</strong>
                    <span>{ordem.tipo_queijo || ordem.lote_queijo || 'Ordem manual'}</span>
                  </div>
                  <em>{ordem.status ?? 'rascunho'}</em>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {view === 'ordens' && (
        <FabricaForm title="Nova OP" onBack={() => setView('inicio')} onSubmit={saveOrdem}>
          <input name="data" type="date" defaultValue={selectedDate} required />
          <input name="codigo_ordem" placeholder="Código da OP" />
          <input name="produto" placeholder="Produto" />
          <input name="lote" placeholder="Lote" />
          <input name="litros" inputMode="decimal" placeholder="Litros previstos" />
        </FabricaForm>
      )}

      {view === 'queijo' && (
        <FabricaForm title="Formulação de queijo" onBack={() => setView('inicio')} onSubmit={saveQueijo}>
          <input name="data_formulacao" type="date" defaultValue={selectedDate} required />
          <select name="tipo_queijo">
            <option value="">Tipo de queijo</option>
            {catalogosQueijo.queijos.map((queijo) => (
              <option key={queijo.id} value={queijo.nome}>{queijo.nome}</option>
            ))}
          </select>
          <input name="lote_queijo" placeholder="Lote do queijo" />
          <input name="lote_leite" placeholder="Lote do leite" />
          <input name="silo" placeholder="Silo" />
          <input name="numero_queijomatic" placeholder="Queijomatic" />
          <input name="inicio_enchimento" type="time" placeholder="Início" />
          <input name="quantidade_leite" inputMode="decimal" placeholder="Quantidade de leite" />
          <input name="temperatura_pasteurizacao" inputMode="decimal" placeholder="Temperatura pasteurização" />
          <div className="fabrica-two">
            <select name="fosfatase" defaultValue="">
              <option value="">Fosfatase</option>
              <option value="negativo">Negativo</option>
              <option value="positivo">Positivo</option>
              <option value="nao_aplicavel">Não aplicável</option>
            </select>
            <select name="peroxidase" defaultValue="">
              <option value="">Peroxidase</option>
              <option value="negativo">Negativo</option>
              <option value="positivo">Positivo</option>
              <option value="nao_aplicavel">Não aplicável</option>
            </select>
          </div>
          <div className="fabrica-two">
            <input name="gordura_inicial" inputMode="decimal" placeholder="Gordura inicial" />
            <input name="gordura_final" inputMode="decimal" placeholder="Gordura final" />
          </div>
          <div className="fabrica-two">
            <input name="acidez" inputMode="decimal" placeholder="Acidez" />
            <input name="temperatura_coagulacao" inputMode="decimal" placeholder="Temp. coagulação" />
          </div>
          <div className="fabrica-two">
            <input name="hora_coagulacao" type="time" />
            <input name="hora_corte" type="time" />
          </div>
          <input name="temperatura_cozimento" inputMode="decimal" placeholder="Temp. cozimento" />
        </FabricaForm>
      )}

      {view === 'soro' && (
        <FabricaForm title="Soro refrigerado" onBack={() => setView('inicio')} onSubmit={saveSoro}>
          <input name="data_registro" type="date" defaultValue={selectedDate} required />
          <input name="entrada_diaria_estoque" inputMode="decimal" placeholder="Entrada diária" />
          <input name="litragem_vendida" inputMode="decimal" placeholder="Litragem vendida" />
          <input name="silo_armazenado" placeholder="Silo armazenado" />
          <input name="responsavel" placeholder="Responsável" />
        </FabricaForm>
      )}
    </main>
  )
}

function FabricaForm({
  title,
  children,
  onBack,
  onSubmit,
}: {
  title: string
  children: React.ReactNode
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="fabrica-form-panel" onSubmit={onSubmit}>
      <div className="fabrica-form-head">
        <button type="button" onClick={onBack}>Voltar</button>
        <h1>{title}</h1>
      </div>
      <div className="fabrica-fields">{children}</div>
      <div className="fabrica-form-actions">
        <button className="secondary" type="submit" name="finalizar" value="0">
          <Save size={20} />
          Salvar
        </button>
        <button className="primary" type="submit" name="finalizar" value="1">
          <CheckCircle2 size={20} />
          Salvar e finalizar
        </button>
      </div>
    </form>
  )
}
