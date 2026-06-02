import { Plus } from 'lucide-react'
import type { FormEvent } from 'react'
import { today } from '../../shared/formatters'

export function PreenchimentoSoroRefrigerado({
  onCreate,
}: {
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void> | void
}) {
  return (
    <section className="panel">
      <h2>Preenchimento</h2>
      <form className="form-grid" onSubmit={onCreate}>
        <label>Data<input name="data_registro" type="date" defaultValue={today()} required /></label>
        <label>Entrada diária no estoque<input name="entrada_diaria_estoque" type="number" step="0.001" min="0" /></label>
        <label>Litragem vendida<input name="litragem_vendida" type="number" step="0.001" min="0" /></label>
        <label>Silo armazenado<input name="silo_armazenado" /></label>
        <label>Responsável<input name="responsavel" /></label>

        <div className="form-actions wide">
          <button className="btn primary" type="submit"><Plus size={16} />Salvar ficha</button>
        </div>
      </form>
    </section>
  )
}
