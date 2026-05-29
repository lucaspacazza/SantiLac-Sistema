import { ClipboardList, FlaskConical } from 'lucide-react'
import type { Overview } from '../../api/producaoApi'

export function Inicio({ overview, onOpenFormulacao, onOpenSubmodulo }: {
  overview: Overview
  onOpenFormulacao?: () => void
  onOpenSubmodulo?: (view: string) => void
}) {
  return (
    <div className="dashboard">
      <div className="kpi-row compact-kpis">
        <div className="kpi"><FlaskConical size={18} /><span>Formulações</span><strong>{overview.totais.formulacoes_queijo}</strong></div>
        <div className="kpi"><ClipboardList size={18} /><span>Rascunhos</span><strong>{overview.totais.rascunhos}</strong></div>
      </div>

      <div className="module-grid">
        {overview.submodulos.map((submodulo) => (
          <button className="module-card" key={submodulo.codigo} onClick={() => onOpenSubmodulo ? onOpenSubmodulo(submodulo.rota_listagem) : onOpenFormulacao?.()}>
            <span>{submodulo.documento}</span>
            <strong>{submodulo.nome}</strong>
            <small>{submodulo.descricao}</small>
          </button>
        ))}
      </div>
    </div>
  )
}
