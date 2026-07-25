import { Plus, Save, Trash2, XCircle } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import type { FormulacaoInsumo, FormulacaoQueijo, FormulacaoQueijoCatalogos } from '../../api/producaoApi'

export function EdicaoFormulacaoQueijo({
  item,
  catalogos,
  onSave,
  onCancel,
}: {
  item: FormulacaoQueijo
  catalogos: FormulacaoQueijoCatalogos
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void> | void
  onCancel: () => void
}) {
  const [insumoRows, setInsumoRows] = useState(() => item.insumos.length > 0 ? item.insumos.map((_, index) => index + 1) : [1])
  const [selectedQueijo, setSelectedQueijo] = useState(item.tipo_queijo)
  const [selectedInsumos, setSelectedInsumos] = useState<Record<number, string>>({})

  useEffect(() => {
    const queijo = catalogos.queijos.find((queijo) => compara(queijo.slug, item.tipo_queijo) || compara(queijo.nome, item.tipo_queijo))
    if (queijo) setSelectedQueijo(queijo.nome)

    const next: Record<number, string> = {}
    item.insumos.forEach((insumo, index) => {
      const catalogo = insumoCatalogo(insumo)
      if (catalogo) next[index + 1] = String(catalogo.id)
    })
    setSelectedInsumos(next)
  }, [catalogos, item])

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

  function compara(left: string, right: string) {
    return left.trim().toLowerCase() === right.trim().toLowerCase()
  }

  function insumoCatalogo(insumo?: FormulacaoInsumo) {
    if (!insumo) return null

    return catalogos.insumos.find((item) => {
      const mesmoNome = insumo.nome_insumo ? compara(item.nome, insumo.nome_insumo) : false
      const mesmoTipo = item.tipo_insumo === insumo.tipo_insumo

      return mesmoNome || mesmoTipo
    }) ?? null
  }

  function insumoByRow(rowId: number) {
    return catalogos.insumos.find((insumo) => String(insumo.id) === selectedInsumos[rowId]) ?? null
  }

  function restoreInsumoRows(event: FormEvent<HTMLInputElement>) {
    const count = Math.max(1, Number.parseInt(event.currentTarget.value, 10) || 1)
    setInsumoRows((current) => current.length === count
      ? current
      : Array.from({ length: count }, (_, index) => index + 1))
  }

  return (
    <section className="panel">
      <h2>Edição</h2>
      <form className="form-grid" data-draft-key={`producao:formulacao-queijo:edicao:${item.id}`} onSubmit={onSave}>
        <input name="data_formulacao" type="hidden" value={item.data_formulacao} />
        <input name="__draft_insumo_rows" type="hidden" value={insumoRows.length} readOnly onInput={restoreInsumoRows} />
        <label>
          Tipo de queijo
          <select name="tipo_queijo" value={selectedQueijo} onChange={(event) => setSelectedQueijo(event.target.value)} required>
            <option value="">Selecionar</option>
            {catalogos.queijos.map((queijo) => (
              <option key={queijo.id} value={queijo.nome}>{queijo.nome}</option>
            ))}
          </select>
        </label>
        <label>Lote do queijo<input name="lote_queijo" defaultValue={item.lote_queijo} required /></label>
        <label>Lote do leite<input name="lote_leite" defaultValue={item.lote_leite ?? ''} /></label>
        <label>Silo<input name="silo" defaultValue={item.silo ?? ''} /></label>
        <label>Queijomatic<input name="numero_queijomatic" defaultValue={item.numero_queijomatic ?? ''} /></label>
        <label>Início do enchimento<input name="inicio_enchimento" type="time" defaultValue={item.inicio_enchimento?.slice(0, 5) ?? ''} /></label>
        <label>Quantidade de leite<input name="quantidade_leite" type="number" step="0.001" min="0" defaultValue={item.quantidade_leite ?? ''} /></label>
        <label>Temp. pasteurização<input name="temperatura_pasteurizacao" type="number" step="0.01" defaultValue={item.temperatura_pasteurizacao ?? ''} /></label>
        <label>Fosfatase<select name="fosfatase" defaultValue={item.fosfatase ?? ''}><option value="">Selecionar</option><option value="negativo">Negativo</option><option value="positivo">Positivo</option><option value="nao_aplicavel">Não aplicável</option></select></label>
        <label>Peroxidase<select name="peroxidase" defaultValue={item.peroxidase ?? ''}><option value="">Selecionar</option><option value="negativo">Negativo</option><option value="positivo">Positivo</option><option value="nao_aplicavel">Não aplicável</option></select></label>
        <label>Gordura inicial<input name="gordura_inicial" type="number" step="0.01" defaultValue={item.gordura_inicial ?? ''} /></label>
        <label>Gordura final<input name="gordura_final" type="number" step="0.01" defaultValue={item.gordura_final ?? ''} /></label>
        <label>Acidez<input name="acidez" type="number" step="0.01" defaultValue={item.acidez ?? ''} /></label>
        <label>Temp. coagulação<input name="temperatura_coagulacao" type="number" step="0.01" defaultValue={item.temperatura_coagulacao ?? ''} /></label>
        <label>Hora da coagulação<input name="hora_coagulacao" type="time" defaultValue={item.hora_coagulacao?.slice(0, 5) ?? ''} /></label>
        <label>Hora do corte<input name="hora_corte" type="time" defaultValue={item.hora_corte?.slice(0, 5) ?? ''} /></label>
        <label>Temp. cozimento<input name="temperatura_cozimento" type="number" step="0.01" defaultValue={item.temperatura_cozimento ?? ''} /></label>

        <div className="wide subform-stack">
          <div className="subform-head">
            <strong>Insumos</strong>
            <button className="btn secondary" type="button" onClick={addInsumo}><Plus size={15} />Adicionar insumo</button>
          </div>
          {insumoRows.map((rowId, index) => {
            const insumo = item.insumos[index]
            const selectedInsumo = insumoByRow(rowId) ?? insumoCatalogo(insumo)

            return (
              <div className="subform" key={rowId}>
                <span>Insumo {index + 1}</span>
                <label>
                  Tipo
                  <select name="insumo_catalogo_id" value={selectedInsumos[rowId] ?? String(selectedInsumo?.id ?? '')} onChange={(event) => setSelectedInsumos((current) => ({ ...current, [rowId]: event.target.value }))}>
                    <option value="">Selecionar</option>
                    {catalogos.insumos.map((item) => (
                      <option key={item.id} value={item.id}>{item.nome}</option>
                    ))}
                  </select>
                </label>
                <input name="insumo_tipo" type="hidden" value={selectedInsumo?.tipo_insumo ?? insumo?.tipo_insumo ?? 'outro'} />
                <input name="insumo_nome" type="hidden" value={selectedInsumo?.nome ?? insumo?.nome_insumo ?? ''} />
                <label>Quantidade<input name="insumo_quantidade" type="number" step="0.001" min="0" defaultValue={insumo?.quantidade ?? ''} /></label>
                <label>Unidade<input name="insumo_unidade" value={selectedInsumo?.unidade ?? insumo?.unidade ?? ''} readOnly /></label>
                <label>Lote<input name="insumo_lote" defaultValue={insumo?.lote_insumo ?? ''} /></label>
                <button className="icon-btn" title="Remover insumo" type="button" onClick={() => removeInsumo(rowId)} disabled={insumoRows.length === 1}><Trash2 size={15} /></button>
              </div>
            )
          })}
        </div>

        <div className="form-actions wide">
          <button className="btn secondary" type="button" onClick={onCancel}><XCircle size={16} />Cancelar ficha</button>
          <button className="btn primary" type="submit"><Save size={16} />Salvar alterações</button>
        </div>
      </form>
    </section>
  )
}
