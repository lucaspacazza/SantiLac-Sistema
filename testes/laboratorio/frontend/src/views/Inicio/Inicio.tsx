import { CalendarCheck, ClipboardList, FlaskConical } from 'lucide-react'
import type { Overview } from '../../api/laboratorioApi'

export function Inicio({ overview, onOpenCronograma, onOpenSubmodulo }: {
  overview: Overview
  onOpenCronograma?: () => void
  onOpenSubmodulo?: (view: string) => void
}) {
  return (
    <div className="dashboard">
      <div className="kpi-row compact-kpis">
        <div className="kpi"><ClipboardList size={18} /><span>Cronogramas</span><strong>{overview.totais.cronogramas}</strong></div>
        <div className="kpi"><FlaskConical size={18} /><span>Água de filagem</span><strong>{overview.totais.agua_filagem}</strong></div>
        <div className="kpi"><CalendarCheck size={18} /><span>Previstas</span><strong>{overview.totais.itens_previstos}</strong></div>
      </div>

      <div className="module-grid">
        {overview.submodulos.map((submodulo) => (
          <button className="module-card" key={submodulo.codigo} onClick={() => onOpenSubmodulo ? onOpenSubmodulo(submodulo.rota_listagem) : onOpenCronograma?.()}>
            <strong>{submodulo.nome}</strong>
            <small>{submodulo.descricao}</small>
          </button>
        ))}
      </div>
    </div>
  )
}
