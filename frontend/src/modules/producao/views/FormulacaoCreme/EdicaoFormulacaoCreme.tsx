import { Save, XCircle } from 'lucide-react'
import type { FormEvent } from 'react'
import type { FormulacaoCreme } from '../../api/producaoApi'

export function EdicaoFormulacaoCreme({ item, onSave, onCancel }: { item: FormulacaoCreme; onSave: (event: FormEvent<HTMLFormElement>) => Promise<void> | void; onCancel: () => void }) {
  return (
    <section className="panel">
      <h2>Edição</h2>
      <form className="form-grid" onSubmit={onSave}>
        <label>Data de fabricação<input name="data_fabricacao" type="date" defaultValue={item.data_fabricacao} required /></label>
        <label>Lote do creme produzido<input name="lote_creme_produzido" defaultValue={item.lote_creme_produzido} required /></label>
        <label>Tipo de creme<select name="tipo_creme" defaultValue={item.tipo_creme ?? ''} required><option value="">Selecionar</option><option value="Creme de Leite de Uso Industrial">Creme de leite</option><option value="Creme de Soro de Uso Industrial">Creme de soro</option></select></label>
        <label>Mês<input name="mes" type="number" min="1" max="12" defaultValue={item.mes ?? ''} /></label>
        <label>Ano<input name="ano" type="number" min="2020" max="2100" defaultValue={item.ano ?? ''} /></label>
        <label>Gordura inicial<input name="gordura_inicial" type="number" step="0.01" min="0" defaultValue={item.gordura_inicial ?? ''} /></label>
        <label>Gordura final<input name="gordura_final" type="number" step="0.01" min="0" defaultValue={item.gordura_final ?? ''} /></label>
        <label>Acidez (°D)<input name="acidez" type="number" step="0.01" min="0" defaultValue={item.acidez ?? ''} /></label>
        <label>Responsável pelo monitoramento<input name="responsavel_monitoramento" defaultValue={item.responsavel_monitoramento ?? ''} /></label>
        <label>Responsável<input name="responsavel" defaultValue={item.responsavel ?? ''} /></label>
        <div className="form-actions wide">
          <button className="btn secondary" type="button" onClick={onCancel}><XCircle size={16} />Cancelar ficha</button>
          <button className="btn primary" type="submit"><Save size={16} />Salvar alterações</button>
        </div>
      </form>
    </section>
  )
}
