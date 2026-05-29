import { Save } from 'lucide-react'
import type { FormEvent } from 'react'
import type { AguaFilagem } from '../../api/laboratorioApi'

export function EdicaoAguaFilagem({
  item,
  onSave,
}: {
  item: AguaFilagem
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void> | void
}) {
  return (
    <section className="panel">
      <h2>Edição</h2>
      <form className="form-grid" onSubmit={onSave}>
        <label>Data<input name="data_monitoramento" type="date" defaultValue={item.data_monitoramento} required /></label>
        <label>Sequência<input name="sequencia" type="number" min="1" max="3" defaultValue={item.sequencia ?? ''} /></label>
        <label>Hora<input name="hora" type="time" defaultValue={item.hora?.slice(0, 5) ?? ''} /></label>
        <label>Acidez<input name="acidez" type="number" step="0.01" min="0" defaultValue={item.acidez ?? ''} /></label>
        <label>Gordura<input name="gordura" type="number" step="0.01" min="0" defaultValue={item.gordura ?? ''} /></label>
        <label>pH<input name="ph" type="number" step="0.01" min="0" max="14" defaultValue={item.ph ?? ''} /></label>
        <label>Responsável<input name="responsavel" defaultValue={item.responsavel ?? ''} /></label>
        <label className="wide">Observações<textarea name="observacoes" rows={3} defaultValue={item.observacoes ?? ''} /></label>

        <div className="form-actions wide">
          <button className="btn primary" type="submit"><Save size={16} />Salvar alterações</button>
        </div>
      </form>
    </section>
  )
}
