import { Plus, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { today } from '../../shared/formatters'

export function PreenchimentoFormulacaoQueijo({
  onCreate,
}: {
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void> | void
}) {
  const [insumoRows, setInsumoRows] = useState([1])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    await onCreate(event)
    setInsumoRows([1])
  }

  function addInsumo() {
    setInsumoRows((current) => [...current, Math.max(...current) + 1])
  }

  function removeInsumo(rowId: number) {
    setInsumoRows((current) => current.filter((id) => id !== rowId))
  }

  return (
    <section className="panel">
      <h2>Preenchimento</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>Tipo de queijo<input name="tipo_queijo" required /></label>
        <label>Data<input name="data_formulacao" type="date" defaultValue={today()} required /></label>
        <label>Lote do queijo<input name="lote_queijo" required /></label>
        <label>Lote do leite<input name="lote_leite" /></label>
        <label>Silo<input name="silo" /></label>
        <label>Queijomatic<input name="numero_queijomatic" /></label>
        <label>Início do enchimento<input name="inicio_enchimento" type="time" /></label>
        <label>Quantidade de leite<input name="quantidade_leite" type="number" step="0.001" min="0" /></label>
        <label>Temp. pasteurização<input name="temperatura_pasteurizacao" type="number" step="0.01" /></label>
        <label>Fosfatase<select name="fosfatase"><option value="">Selecionar</option><option value="negativo">Negativo</option><option value="positivo">Positivo</option><option value="nao_aplicavel">Não aplicável</option></select></label>
        <label>Peroxidase<select name="peroxidase"><option value="">Selecionar</option><option value="negativo">Negativo</option><option value="positivo">Positivo</option><option value="nao_aplicavel">Não aplicável</option></select></label>
        <label>Gordura inicial<input name="gordura_inicial" type="number" step="0.01" /></label>
        <label>Gordura final<input name="gordura_final" type="number" step="0.01" /></label>
        <label>Acidez<input name="acidez" type="number" step="0.01" /></label>
        <label>Temp. coagulação<input name="temperatura_coagulacao" type="number" step="0.01" /></label>
        <label>Hora da coagulação<input name="hora_coagulacao" type="time" /></label>
        <label>Hora do corte<input name="hora_corte" type="time" /></label>
        <label>Temp. cozimento<input name="temperatura_cozimento" type="number" step="0.01" /></label>
        <label className="wide">Observações<textarea name="observacoes" rows={3} /></label>

        <div className="wide subform-stack">
          <div className="subform-head">
            <strong>Insumos</strong>
            <button className="btn secondary" type="button" onClick={addInsumo}><Plus size={15} />Adicionar insumo</button>
          </div>
          {insumoRows.map((rowId, index) => (
            <div className="subform" key={rowId}>
              <span>Insumo {index + 1}</span>
              <label>Tipo<select name="insumo_tipo"><option value="fermento_mvd">Fermento MVD</option><option value="fermento_fast">Fermento FAST</option><option value="fermento">Fermento</option><option value="cloreto">Cloreto</option><option value="corante">Corante</option><option value="coalho">Coalho</option><option value="outro">Outro</option></select></label>
              <label>Quantidade<input name="insumo_quantidade" type="number" step="0.001" min="0" /></label>
              <label>Unidade<input name="insumo_unidade" /></label>
              <label>Lote<input name="insumo_lote" /></label>
              <button className="icon-btn" title="Remover insumo" type="button" onClick={() => removeInsumo(rowId)} disabled={insumoRows.length === 1}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        <div className="form-actions wide">
          <button className="btn primary" type="submit"><Plus size={16} />Salvar ficha</button>
        </div>
      </form>
    </section>
  )
}
