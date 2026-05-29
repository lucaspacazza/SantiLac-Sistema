import { CalendarDays, ClipboardList, Droplets, Factory, FlaskConical } from 'lucide-react'

type View =
  | 'inicio'
  | 'preenchimento-cronograma-analises'
  | 'listagem-cronogramas-analises'
  | 'preenchimento-agua-filagem'
  | 'listagem-agua-filagem'
  | 'edicao-agua-filagem'

export function LaboratorioSidebar({
  view,
  onNavigate,
}: {
  view: View
  onNavigate: (view: View) => void
}) {
  const isCronograma = view.includes('cronograma') || view.includes('cronogramas')
  const isAguaFilagem = view.includes('agua-filagem')

  return (
    <aside className="sidebar">
      <div className="brand"><span className="avatar"><FlaskConical size={15} /></span><strong>SantiLac</strong></div>

      <nav className="nav" aria-label="Navegação principal">
        <span className="nav-section-title">Sistema</span>
        <button className="nav-item" type="button" onClick={() => { window.location.href = '/producao/' }}><Factory size={16} />Produção</button>
        <button className={`nav-item ${view === 'inicio' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('inicio')}><FlaskConical size={16} />Laboratório</button>
        <div className="nav-subtree" aria-label="Submódulos de laboratório">
          <button className={`nav-subitem ${isCronograma ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-cronogramas-analises')}><CalendarDays size={15} />Cronograma</button>
          <div className="nav-subtree is-nested" aria-label="Telas de cronograma">
            <button className={`nav-subitem ${view === 'listagem-cronogramas-analises' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-cronogramas-analises')}><ClipboardList size={15} />Cronogramas salvos</button>
          </div>
          <button className={`nav-subitem ${isAguaFilagem ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-agua-filagem')}><Droplets size={15} />Água de filagem</button>
          <div className="nav-subtree is-nested" aria-label="Telas de água de filagem">
            <button className={`nav-subitem ${view === 'listagem-agua-filagem' || view === 'edicao-agua-filagem' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate('listagem-agua-filagem')}><ClipboardList size={15} />Fichas salvas</button>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">Ambiente de testes</div>
    </aside>
  )
}
