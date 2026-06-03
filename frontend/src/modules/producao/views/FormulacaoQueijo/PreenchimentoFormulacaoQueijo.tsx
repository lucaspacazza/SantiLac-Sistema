import { Plus, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import type { FormulacaoQueijoCatalogos } from '../../api/producaoApi'
import { today } from '../../shared/formatters'

export function PreenchimentoFormulacaoQueijo({
  catalogos,
  onCreate,
}: {
  catalogos: FormulacaoQueijoCatalogos
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void> | void
}) {
  const [insumoRows, setInsumoRows] = useState([1])
  const [selectedInsumos, setSelectedInsumos] = useState<Record<number, string>>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    return onCreate(event)
  }

  function addInsumo() {
    setInsumoRows((current) => [...current, Math.max(...current) + 1])
  }

  function removeInsumo(rowId: number) {
    setInsumoRows((current) => current.filter((id) => id !== rowId))
    setSelectedInsumos((current) => {
      const next = { ...current }
      delete next[rowId]
      return next
    })
  }

  function insumoByRow(rowId: number) {
    return catalogos.insumos.find((insumo) => String(insumo.id) === selectedInsumos[rowId]) ?? null
  }

  return (
    <section className="panel">
      <h2>Preenchimento</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <input name="data_formulacao" type="hidden" value={today()} />
        <label>
          Tipo de queijo
          <select name="tipo_queijo" required>
            <option value="">Selecionar</option>
            {catalogos.queijos.map((queijo) => (
              <option key={queijo.id} value={queijo.nome}>{queijo.nome}</option>
            ))}
          </select>
        </label>
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

        <div className="wide subform-stack">
          <div className="subform-head">
            <strong>Insumos</strong>
            <button className="btn secondary" type="button" onClick={addInsumo}><Plus size={15} />Adicionar insumo</button>
          </div>
          {insumoRows.map((rowId, index) => {
            const insumo = insumoByRow(rowId)
            return (
              <div className="subform" key={rowId}>
                <span>Insumo {index + 1}</span>
                <label>
                  Tipo
                  <select value={selectedInsumos[rowId] ?? ''} onChange={(event) => setSelectedInsumos((current) => ({ ...current, [rowId]: event.target.value }))}>
                    <option value="">Selecionar</option>
                    {catalogos.insumos.map((item) => (
                      <option key={item.id} value={item.id}>{item.nome}</option>
                    ))}
                  </select>
                </label>
                <input name="insumo_tipo" type="hidden" value={insumo?.tipo_insumo ?? 'outro'} />
                <input name="insumo_nome" type="hidden" value={insumo?.nome ?? ''} />
                <label>Quantidade<input name="insumo_quantidade" type="number" step="0.001" min="0" /></label>
                <label>Unidade<input name="insumo_unidade" value={insumo?.unidade ?? ''} readOnly /></label>
                <label>Lote<input name="insumo_lote" /></label>
                <button className="icon-btn" title="Remover insumo" type="button" onClick={() => removeInsumo(rowId)} disabled={insumoRows.length === 1}><Trash2 size={15} /></button>
              </div>
            )
          })}
        </div>

        <div className="form-actions wide">
          <button className="btn primary" type="submit"><Plus size={16} />Salvar ficha</button>
        </div>
      </form>
    </section>
  )
}
