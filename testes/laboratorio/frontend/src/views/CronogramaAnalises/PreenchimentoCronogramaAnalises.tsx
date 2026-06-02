import { Plus } from 'lucide-react'
import type { FormEvent } from 'react'
import { currentYear } from '../../shared/formatters'

export function PreenchimentoCronogramaAnalises({
  onCreate,
}: {
  onCreate: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="panel">
      <h2>Preenchimento</h2>
      <form className="form-grid" onSubmit={onCreate}>
        <label>Ano<input name="ano" type="number" min="2020" max="2100" defaultValue={currentYear()} required /></label>
        <label className="wide">Observações<textarea name="observacoes" rows={3} /></label>

        <div className="subform wide">
          <span>Primeira análise</span>
          <label>Produto<input name="produto" /></label>
          <label>Matriz<select name="matriz"><option value="queijo">Queijo</option><option value="creme">Creme</option><option value="soro">Soro</option><option value="agua">Água</option><option value="outro">Outro</option></select></label>
          <label>Mês<input name="mes" type="number" min="1" max="12" defaultValue="1" /></label>
          <label>Análise<select name="tipo_analise"><option value="fisico_quimica">Físico-química</option><option value="microbiologica">Microbiológica</option><option value="fisico_quimica_microbiologica">FQ + MB</option></select></label>
          <label>Até dia<input name="ate_dia" type="number" min="1" max="31" defaultValue="15" /></label>
        </div>

        <div className="form-actions wide">
          <button className="btn primary" type="submit"><Plus size={16} />Salvar ficha</button>
        </div>
      </form>
    </section>
  )
}
