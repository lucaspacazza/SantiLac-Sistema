import { Save } from 'lucide-react'
import type { FormEvent } from 'react'
import type { SoroRefrigerado } from '../../api/producaoApi'

export function EdicaoSoroRefrigerado({
  item,
  onSave,
}: {
  item: SoroRefrigerado
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void> | void
}) {
  return (
    <section className="panel">
      <h2>Edição</h2>
      <form className="form-grid" onSubmit={onSave}>
        <label>Data<input name="data_registro" type="date" defaultValue={item.data_registro} required /></label>
        <label>Entrada diária no estoque<input name="entrada_diaria_estoque" type="number" step="0.001" min="0" defaultValue={item.entrada_diaria_estoque ?? ''} /></label>
        <label>Litragem vendida<input name="litragem_vendida" type="number" step="0.001" min="0" defaultValue={item.litragem_vendida ?? ''} /></label>
        <label>Silo armazenado<input name="silo_armazenado" defaultValue={item.silo_armazenado ?? ''} /></label>
        <label>Responsável<input name="responsavel" defaultValue={item.responsavel ?? ''} /></label>
        <label className="wide">Observações<textarea name="observacoes" rows={3} defaultValue={item.observacoes ?? ''} /></label>

        <div className="form-actions wide">
          <button className="btn primary" type="submit"><Save size={16} />Salvar alterações</button>
        </div>
      </form>
    </section>
  )
}
