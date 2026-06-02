import { ClipboardList, FlaskConical } from 'lucide-react'
import type { Overview } from '../../api/producaoApi'

export function Inicio({ overview }: {
  overview: Overview
}) {
  return (
    <div className="dashboard">
      <div className="kpi-row compact-kpis">
        <div className="kpi"><FlaskConical size={18} /><span>Formulações</span><strong>{overview.totais.formulacoes_queijo}</strong></div>
        <div className="kpi"><ClipboardList size={18} /><span>Rascunhos</span><strong>{overview.totais.rascunhos}</strong></div>
      </div>

      <section className="info-panel">
        <h2>Produção</h2>
        <p>Área de acompanhamento dos registros produtivos em teste.</p>
        <p>Use a sidebar para acessar cada submódulo e consultar ou preencher as fichas.</p>
      </section>
    </div>
  )
}
