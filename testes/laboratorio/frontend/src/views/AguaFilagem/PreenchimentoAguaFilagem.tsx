import { Plus } from 'lucide-react'
import type { FormEvent } from 'react'

export function PreenchimentoAguaFilagem({
  onCreate,
}: {
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void> | void
}) {
  return (
    <section className="panel">
      <h2>Preenchimento</h2>
      <form className="form-grid" onSubmit={onCreate}>
        <label>Data<input name="data_monitoramento" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
        <label>Sequência<input name="sequencia" type="number" min="1" max="3" /></label>
        <label>Hora<input name="hora" type="time" /></label>
        <label>Acidez<input name="acidez" type="number" step="0.01" min="0" /></label>
        <label>Gordura<input name="gordura" type="number" step="0.01" min="0" /></label>
        <label>pH<input name="ph" type="number" step="0.01" min="0" max="14" /></label>
        <label>Responsável<input name="responsavel" /></label>
        <label className="wide">Observações<textarea name="observacoes" rows={3} /></label>

        <div className="form-actions wide">
          <button className="btn primary" type="submit"><Plus size={16} />Salvar ficha</button>
        </div>
      </form>
    </section>
  )
}
