import { ClipboardList, Droplets, Factory, FlaskConical, Milk } from 'lucide-react'

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

export function ProducaoSidebar({
  view,
  onNavigate,
}: {
  view: View
  onNavigate: (view: View) => void
}) {
  const isQueijo = view.includes('formulacao-queijo') || view.includes('formulacoes-queijo')
  const isOrdemProducao = view === 'ordem-producao' || view === 'preenchimento-ordem-producao' || view === 'visualizacao-ordem-producao'
  const isSoro = view.includes('soro-refrigerado')
  const isFormulacaoCreme = view.includes('formulacao-creme') || view.includes('formulacoes-creme')
  const isProducaoCreme = view.includes('producao-creme') || view.includes('producoes-creme')

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="avatar"><Factory size={15} /></span>
        <strong>SantiLac</strong>
      </div>

      <nav className="nav" aria-label="Navegação principal">
        <span className="nav-section-title">Sistema</span>
        <button className={`nav-item ${view === 'inicio' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('inicio')}>
          <Factory size={16} />
          Produção
        </button>

        <div className="nav-subtree" aria-label="Submódulos de produção">
          <button className={`nav-subitem ${isQueijo ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-formulacoes-queijo')}>
            <FlaskConical size={15} />
            Formulação de queijo
          </button>

          <button className={`nav-subitem ${isOrdemProducao ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('ordem-producao')}>
            <ClipboardList size={15} />
            Ordem de produção
          </button>

          <button className={`nav-subitem ${isSoro ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-soro-refrigerado')}>
            <Droplets size={15} />
            Soro refrigerado
          </button>

          <button className={`nav-subitem ${isFormulacaoCreme ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-formulacoes-creme')}>
            <Milk size={15} />
            Formulação de creme
          </button>

          <button className={`nav-subitem ${isProducaoCreme ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-producoes-creme')}>
            <Factory size={15} />
            Produção de creme de leite e soro
          </button>
        </div>

        <button className="nav-item" type="button" onClick={() => { window.location.href = '/laboratorio/' }}>
          <FlaskConical size={16} />
          Laboratório
        </button>
      </nav>

      <div className="sidebar-footer">Ambiente de testes</div>
    </aside>
  )
}
