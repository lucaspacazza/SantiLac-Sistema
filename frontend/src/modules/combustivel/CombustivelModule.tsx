import { ArrowDownToLine, ArrowUpFromLine, RefreshCcw, Search } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  combustivelApi,
  type CombustivelCaminhao,
  type CombustivelMovimentacao,
  type CombustivelMotorista,
  type CombustivelResumo,
} from './api/combustivelApi'
import './combustivel.css'

type View = 'inicio' | 'entrada' | 'saida' | 'historico'
type LoadStatus = 'loading' | 'live' | 'error'

function parseRoute(): View {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)

  if (parts[0] !== 'combustivel') {
    return 'inicio'
  }

  if (parts[1] === 'entrada' || parts[1] === 'saida' || parts[1] === 'historico') {
    return parts[1]
  }

  return 'inicio'
}

function pushRoute(view: View): void {
  const nextHash = view === 'inicio' ? '#/combustivel/inicio' : `#/combustivel/${view}`

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

function formatLitros(value: number | null | undefined): string {
  return `${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('pt-BR')
}

export function CombustivelModule() {
  const [view, setView] = useState<View>(() => parseRoute())
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando combustível...')
  const [resumo, setResumo] = useState<CombustivelResumo | null>(null)
  const [historico, setHistorico] = useState<CombustivelMovimentacao[]>([])
  const [motoristas, setMotoristas] = useState<CombustivelMotorista[]>([])
  const [caminhoes, setCaminhoes] = useState<CombustivelCaminhao[]>([])
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [motoristaFiltro, setMotoristaFiltro] = useState('')
  const [entradaQuantidade, setEntradaQuantidade] = useState('')
  const [saidaQuantidade, setSaidaQuantidade] = useState('')
  const [saidaMotorista, setSaidaMotorista] = useState('')
  const [saidaCaminhao, setSaidaCaminhao] = useState('')
  const [saidaKm, setSaidaKm] = useState('')

  const ultimasMovimentacoes = useMemo(() => historico.slice(0, 8), [historico])

  async function loadResumo() {
    setStatus('loading')
    setStatusText('Carregando dados do tanque...')

    try {
      const [resumoResult, motoristasResult, caminhoesResult] = await Promise.all([
        combustivelApi.resumo(),
        combustivelApi.motoristas(),
        combustivelApi.caminhoes(),
      ])
      setResumo(resumoResult)
      setMotoristas(motoristasResult.items)
      setCaminhoes(caminhoesResult.items)
      setStatus('live')
      setStatusText('Dados de combustível carregados.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o combustível.')
    }
  }

  async function loadHistorico() {
    setStatus('loading')
    setStatusText('Carregando histórico de combustível...')

    try {
      const result = await combustivelApi.historico({
        tipo: tipoFiltro,
        dataInicial,
        dataFinal,
        motorista: motoristaFiltro,
        perPage: 100,
      })
      setHistorico(result.items)
      setStatus('live')
      setStatusText(`${result.pagination.total.toLocaleString('pt-BR')} movimentação(ões) carregada(s).`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o histórico.')
    }
  }

  async function reloadCurrentView() {
    if (view === 'historico') {
      await Promise.all([loadResumo(), loadHistorico()])
      return
    }

    await loadResumo()
  }

  async function handleEntrada(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('loading')
    setStatusText('Registrando entrada de combustível...')

    try {
      const result = await combustivelApi.registrarEntrada({
        quantidade_litros: Number(entradaQuantidade),
      })
      setResumo(result.resumo)
      setEntradaQuantidade('')
      setStatus('live')
      setStatusText('Entrada registrada com sucesso.')
      pushRoute('inicio')
      setView('inicio')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível registrar a entrada.')
    }
  }

  async function handleSaida(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('loading')
    setStatusText('Registrando saída de combustível...')

    try {
      const result = await combustivelApi.registrarSaida({
        quantidade_litros: Number(saidaQuantidade),
        motorista_nome: saidaMotorista,
        caminhao_id: Number(saidaCaminhao),
        km: saidaKm ? Number(saidaKm) : undefined,
      })
      setResumo(result.resumo)
      setSaidaQuantidade('')
      setSaidaMotorista('')
      setSaidaCaminhao('')
      setSaidaKm('')
      setStatus('live')
      setStatusText('Saída registrada com sucesso.')
      pushRoute('inicio')
      setView('inicio')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível registrar a saída.')
    }
  }

  function navigate(nextView: View) {
    pushRoute(nextView)
    setView(nextView)
  }

  useEffect(() => {
    const handleHashChange = () => setView(parseRoute())

    if (!window.location.hash.startsWith('#/combustivel')) {
      window.history.replaceState(null, '', '#/combustivel/inicio')
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (view === 'historico') {
      void Promise.all([loadResumo(), loadHistorico()])
      return
    }

    void loadResumo()
  }, [view])

  const pageTitle = view === 'inicio'
    ? 'Combustível'
    : view === 'entrada'
      ? 'Entrada de combustível'
      : view === 'saida'
        ? 'Saída de combustível'
        : 'Histórico de combustível'

  const pageCopy = view === 'inicio'
    ? 'Controle de entradas, saídas e saldo disponível.'
    : view === 'historico'
      ? 'Consulta das movimentações registradas.'
      : 'Registro operacional do estoque.'

  return (
    <section className="page combustivel-module">
      <header className="page-head">
        <div>
          <h1>{pageTitle}</h1>
          <p>{pageCopy}</p>
        </div>
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => void reloadCurrentView()}>
            <RefreshCcw size={16} />
            Atualizar
          </button>
        </div>
      </header>

      <section className={`status-line is-${status}`}>
        <span className="status-dot" />
        <span>{statusText}</span>
      </section>

      {view === 'inicio' ? (
        <Inicio resumo={resumo} movimentacoes={ultimasMovimentacoes} onNavigate={navigate} />
      ) : view === 'entrada' ? (
        <FormularioEntrada
          quantidade={entradaQuantidade}
          onQuantidadeChange={setEntradaQuantidade}
          onSubmit={handleEntrada}
        />
      ) : view === 'saida' ? (
        <FormularioSaida
          quantidade={saidaQuantidade}
          motorista={saidaMotorista}
          motoristas={motoristas}
          caminhao={saidaCaminhao}
          caminhoes={caminhoes}
          km={saidaKm}
          onQuantidadeChange={setSaidaQuantidade}
          onMotoristaChange={setSaidaMotorista}
          onCaminhaoChange={setSaidaCaminhao}
          onKmChange={setSaidaKm}
          onSubmit={handleSaida}
        />
      ) : (
        <Historico
          movimentacoes={historico}
          motoristas={motoristas}
          tipo={tipoFiltro}
          dataInicial={dataInicial}
          dataFinal={dataFinal}
          motorista={motoristaFiltro}
          onTipoChange={setTipoFiltro}
          onDataInicialChange={setDataInicial}
          onDataFinalChange={setDataFinal}
          onMotoristaChange={setMotoristaFiltro}
          onFiltrar={() => void loadHistorico()}
        />
      )}
    </section>
  )
}

function Inicio({
  resumo,
  movimentacoes,
  onNavigate,
}: {
  resumo: CombustivelResumo | null
  movimentacoes: CombustivelMovimentacao[]
  onNavigate: (view: View) => void
}) {
  const percentual = Math.max(0, Math.min(100, resumo?.porcentagem ?? 0))

  return (
    <div className="dashboard">
      <section className="fuel-grid">
        <div className="fuel-tank">
          <TankGauge percentual={percentual} />
          <div>
            <span className="section-kicker">Estoque</span>
            <h2>{formatLitros(resumo?.estoque_atual_litros)}</h2>
            <p className="empty-copy">
              Capacidade: {formatLitros(resumo?.capacidade_litros)} | Ocupação: {percentual.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="stack">
          <article className="kpi-card">
            <ArrowDownToLine size={18} />
            <span>Última entrada</span>
            <strong>{formatLitros(resumo?.ultima_entrada?.quantidade_litros)}</strong>
            <small>{formatDate(resumo?.ultima_entrada?.data_hora)}</small>
          </article>
          <article className="kpi-card">
            <ArrowUpFromLine size={18} />
            <span>Última saída</span>
            <strong>{formatLitros(resumo?.ultima_saida?.quantidade_litros)}</strong>
            <small>{resumo?.ultima_saida?.motorista_nome ?? formatDate(resumo?.ultima_saida?.data_hora)}</small>
          </article>
        </div>
      </section>

      <section className="fuel-actions">
        <button className="btn secondary" type="button" onClick={() => onNavigate('entrada')}>
          <ArrowDownToLine size={16} />
          Entrada
        </button>
        <button className="btn secondary" type="button" onClick={() => onNavigate('saida')}>
          <ArrowUpFromLine size={16} />
          Saída
        </button>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="section-kicker">Movimentações</span>
            <h3>Últimos registros</h3>
          </div>
          <button className="btn secondary" type="button" onClick={() => onNavigate('historico')}>
            Abrir histórico
          </button>
        </div>
        <MovimentacoesTable movimentacoes={movimentacoes} emptyText="Nenhuma movimentação carregada." />
      </section>
    </div>
  )
}

function TankGauge({ percentual }: { percentual: number }) {
  const safePercent = Math.max(0, Math.min(100, percentual))
  const fillHeight = 104 * (safePercent / 100)
  const fillY = 38 + (104 - fillHeight)

  return (
    <div className="tank-visual" aria-label={`Nível do tanque: ${safePercent.toFixed(2)}%`}>
      <svg className="tank-svg" viewBox="0 0 160 180" role="img" aria-hidden="true">
        <defs>
          <clipPath id="fuel-tank-clip">
            <path d="M45 38c0-11 16-20 35-20s35 9 35 20v104c0 11-16 20-35 20s-35-9-35-20z" />
          </clipPath>
          <linearGradient id="fuel-fill-gradient" x1="45" x2="115" y1="0" y2="0">
            <stop offset="0%" stopColor="#21c37a" />
            <stop offset="100%" stopColor="#6fd391" />
          </linearGradient>
        </defs>

        <path className="tank-body-shadow" d="M45 38c0-11 16-20 35-20s35 9 35 20v104c0 11-16 20-35 20s-35-9-35-20z" />
        <rect className="tank-fill-shape" x="45" y={fillY} width="70" height={fillHeight} clipPath="url(#fuel-tank-clip)" />
        <ellipse className="tank-fill-surface" cx="80" cy={fillY} rx="35" ry="9" clipPath="url(#fuel-tank-clip)" />

        <path className="tank-body" d="M45 38c0-11 16-20 35-20s35 9 35 20v104c0 11-16 20-35 20s-35-9-35-20z" />
        <ellipse className="tank-rim" cx="80" cy="38" rx="35" ry="20" />
        <path className="tank-rim tank-bottom" d="M45 142c0 11 16 20 35 20s35-9 35-20" />
        <path className="tank-pipe" d="M115 58h15v62h-15M130 74h14M130 104h14" />
        <path className="tank-leg" d="M58 158v14M102 158v14M52 172h56" />
        <path className="tank-highlight" d="M61 52v76" />
      </svg>
      <span className="tank-percent">{safePercent.toFixed(2)}%</span>
    </div>
  )
}

function FormularioEntrada({
  quantidade,
  onQuantidadeChange,
  onSubmit,
}: {
  quantidade: string
  onQuantidadeChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="fuel-form-panel">
      <form className="fuel-form" onSubmit={onSubmit}>
        <label className="is-litros">
          <span>Litros</span>
          <input type="number" min="0.001" step="0.001" value={quantidade} onChange={(event) => onQuantidadeChange(event.target.value)} required />
        </label>
        <div className="modal-actions">
          <button className="btn primary" type="submit">Salvar entrada</button>
        </div>
      </form>
    </section>
  )
}

function FormularioSaida({
  quantidade,
  motorista,
  motoristas,
  caminhao,
  caminhoes,
  km,
  onQuantidadeChange,
  onMotoristaChange,
  onCaminhaoChange,
  onKmChange,
  onSubmit,
}: {
  quantidade: string
  motorista: string
  motoristas: CombustivelMotorista[]
  caminhao: string
  caminhoes: CombustivelCaminhao[]
  km: string
  onQuantidadeChange: (value: string) => void
  onMotoristaChange: (value: string) => void
  onCaminhaoChange: (value: string) => void
  onKmChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="fuel-form-panel">
      <form className="fuel-form" onSubmit={onSubmit}>
        <label className="is-driver">
          <span>Motorista</span>
          <select value={motorista} onChange={(event) => onMotoristaChange(event.target.value)} required>
            <option value="" disabled>Selecione</option>
            {motoristas.map((item) => (
              <option key={item.id} value={item.nome}>{item.nome}</option>
            ))}
          </select>
        </label>
        <label className="is-truck">
          <span>Caminhão</span>
          <select value={caminhao} onChange={(event) => onCaminhaoChange(event.target.value)} required>
            <option value="" disabled>Selecione</option>
            {caminhoes.map((item) => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </label>
        <label className="is-litros">
          <span>Litros</span>
          <input type="number" min="0.001" step="0.001" value={quantidade} onChange={(event) => onQuantidadeChange(event.target.value)} required />
        </label>
        <label className="is-small">
          <span>KM</span>
          <input type="number" min="0" step="1" value={km} onChange={(event) => onKmChange(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="btn primary" type="submit">Salvar saída</button>
        </div>
      </form>
    </section>
  )
}

function Historico({
  movimentacoes,
  motoristas,
  tipo,
  dataInicial,
  dataFinal,
  motorista,
  onTipoChange,
  onDataInicialChange,
  onDataFinalChange,
  onMotoristaChange,
  onFiltrar,
}: {
  movimentacoes: CombustivelMovimentacao[]
  motoristas: CombustivelMotorista[]
  tipo: string
  dataInicial: string
  dataFinal: string
  motorista: string
  onTipoChange: (value: string) => void
  onDataInicialChange: (value: string) => void
  onDataFinalChange: (value: string) => void
  onMotoristaChange: (value: string) => void
  onFiltrar: () => void
}) {
  return (
    <div className="stack">
      <section className="panel">
        <div className="filter-row">
          <label>
            <span>Tipo</span>
            <select value={tipo} onChange={(event) => onTipoChange(event.target.value)}>
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </label>
          <label>
            <span>Data inicial</span>
            <input type="date" value={dataInicial} onChange={(event) => onDataInicialChange(event.target.value)} />
          </label>
          <label>
            <span>Data final</span>
            <input type="date" value={dataFinal} onChange={(event) => onDataFinalChange(event.target.value)} />
          </label>
          <label>
            <span>Motorista</span>
            <select value={motorista} onChange={(event) => onMotoristaChange(event.target.value)}>
              <option value="">Todos</option>
              {motoristas.map((item) => (
                <option key={item.id} value={item.nome}>{item.nome}</option>
              ))}
            </select>
          </label>
          <button className="btn secondary" type="button" onClick={onFiltrar}>
            <Search size={16} />
            Filtrar
          </button>
        </div>
      </section>

      <section className="table-card">
        <MovimentacoesTable movimentacoes={movimentacoes} emptyText="Nenhuma movimentação encontrada." />
      </section>
    </div>
  )
}

function MovimentacoesTable({ movimentacoes, emptyText }: { movimentacoes: CombustivelMovimentacao[]; emptyText: string }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Litros</th>
            <th>Motorista</th>
            <th>Caminhão</th>
            <th>Placa</th>
            <th>KM</th>
            <th>Responsável</th>
          </tr>
        </thead>
        <tbody>
          {movimentacoes.length === 0 ? (
            <tr>
              <td colSpan={8}>{emptyText}</td>
            </tr>
          ) : movimentacoes.map((movimentacao) => (
            <tr key={movimentacao.id}>
              <td>{formatDate(movimentacao.data_hora)}</td>
              <td>
                <span className={`movement-type is-${movimentacao.tipo}`}>
                  {movimentacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                </span>
              </td>
              <td>{formatLitros(movimentacao.quantidade_litros)}</td>
              <td>{movimentacao.motorista_nome ?? '-'}</td>
              <td>{movimentacao.caminhao_nome ?? '-'}</td>
              <td>{movimentacao.placa ?? '-'}</td>
              <td>{movimentacao.km ?? '-'}</td>
              <td>{movimentacao.usuario_responsavel?.nome ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
