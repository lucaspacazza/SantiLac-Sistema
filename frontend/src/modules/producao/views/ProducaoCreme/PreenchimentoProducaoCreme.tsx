import { Plus } from 'lucide-react'
import type { FormEvent } from 'react'
import { today } from '../../shared/formatters'

export function PreenchimentoProducaoCreme({ onCreate }: { onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void> | void }) {
  return (
    <section className="panel">
      <h2>Preenchimento</h2>
      <form className="form-grid" onSubmit={onCreate}>
        <label>Data de fabricação<input name="data_fabricacao" type="date" defaultValue={today()} required /></label>
        <label>Lote do creme produzido<input name="lote_creme_produzido" required /></label>
        <label>Quantidade produzida (kg)<input name="quantidade_produzida_kg" type="number" step="0.001" min="0" /></label>
        <label>Tipo de creme<select name="tipo_creme" required><option value="">Selecionar</option><option value="Creme de Leite de Uso Industrial">Creme de leite</option><option value="Creme de Soro de Uso Industrial">Creme de soro</option></select></label>
        <label>Mês<input name="mes" type="number" min="1" max="12" /></label>
        <label>Ano<input name="ano" type="number" min="2020" max="2100" defaultValue={new Date().getFullYear()} /></label>
        <label>Responsável pelo monitoramento<input name="responsavel_monitoramento" /></label>
        <label>Responsável<input name="responsavel" /></label>
        <div className="form-actions wide">
          <button className="btn primary" type="submit"><Plus size={16} />Salvar ficha</button>
        </div>
      </form>
    </section>
  )
}
