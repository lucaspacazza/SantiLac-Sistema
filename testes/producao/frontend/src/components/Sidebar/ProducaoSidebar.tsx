import { ClipboardList, Droplets, Factory, FlaskConical, Milk } from 'lucide-react'

type View =
  | 'inicio'
  | 'preenchimento-formulacao-queijo'
  | 'listagem-formulacoes-queijo'
  | 'visualizacao-formulacao-queijo'
  | 'edicao-formulacao-queijo'
  | 'preenchimento-soro-refrigerado'
  | 'listagem-soro-refrigerado'
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
  const isSoro = view.includes('soro-refrigerado')
  const isFormulacaoCreme = view.includes('formulacao-creme') || view.includes('formulacoes-creme')
  const isProducaoCreme = view.includes('producao-creme') || view.includes('producoes-creme')

  return (
    <aside className="sidebar">
      <div className="brand"><span className="avatar"><Factory size={15} /></span><strong>SantiLac</strong></div>

      <nav className="nav" aria-label="Navegação principal">
        <span className="nav-section-title">Sistema</span>
        <button className={`nav-item ${view === 'inicio' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('inicio')}><Factory size={16} />Produção</button>
        <div className="nav-subtree" aria-label="Submódulos de produção">
          <button className={`nav-subitem ${isQueijo ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-formulacoes-queijo')}><FlaskConical size={15} />Formulação de queijo</button>
          <div className="nav-subtree is-nested" aria-label="Telas de formulação">
            <button className={`nav-subitem ${view === 'listagem-formulacoes-queijo' || view === 'visualizacao-formulacao-queijo' || view === 'edicao-formulacao-queijo' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-formulacoes-queijo')}><ClipboardList size={15} />Fichas salvas</button>
          </div>
          <button className={`nav-subitem ${isSoro ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-soro-refrigerado')}><Droplets size={15} />Soro refrigerado</button>
          <div className="nav-subtree is-nested" aria-label="Telas de soro refrigerado">
            <button className={`nav-subitem ${view === 'listagem-soro-refrigerado' || view === 'visualizacao-soro-refrigerado' || view === 'edicao-soro-refrigerado' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-soro-refrigerado')}><ClipboardList size={15} />Fichas salvas</button>
          </div>
          <button className={`nav-subitem ${isFormulacaoCreme ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-formulacoes-creme')}><Milk size={15} />Formulação de creme</button>
          <div className="nav-subtree is-nested" aria-label="Telas de formulação de creme">
            <button className={`nav-subitem ${view === 'listagem-formulacoes-creme' || view === 'visualizacao-formulacao-creme' || view === 'edicao-formulacao-creme' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-formulacoes-creme')}><ClipboardList size={15} />Fichas salvas</button>
          </div>
          <button className={`nav-subitem ${isProducaoCreme ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-producoes-creme')}><Factory size={15} />Produção de creme de leite e soro</button>
          <div className="nav-subtree is-nested" aria-label="Telas de produção de creme">
            <button className={`nav-subitem ${view === 'listagem-producoes-creme' || view === 'visualizacao-producao-creme' || view === 'edicao-producao-creme' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-producoes-creme')}><ClipboardList size={15} />Fichas salvas</button>
          </div>
        </div>
        <button className="nav-item" type="button" onClick={() => { window.location.href = '/laboratorio/' }}><FlaskConical size={16} />Laboratório</button>
      </nav>

      <div className="sidebar-footer">Ambiente de testes</div>
    </aside>
  )
}
