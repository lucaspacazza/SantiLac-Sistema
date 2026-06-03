import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { OrdemProducaoCatalogos } from '../../api/producaoApi'
import { today } from '../../shared/formatters'

export function PreenchimentoOrdemProducao({
  catalogos,
  onCreate,
  onBack,
}: {
  catalogos: OrdemProducaoCatalogos
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void> | void
  onBack: () => void
}) {
  const [insumoRows, setInsumoRows] = useState([1])
  const [selectedQueijoId, setSelectedQueijoId] = useState(() => String(catalogos.queijos[0]?.id ?? ''))
  const [selectedInsumos, setSelectedInsumos] = useState<Record<number, string>>({})

  const selectedQueijo = useMemo(
    () => catalogos.queijos.find((queijo) => String(queijo.id) === selectedQueijoId) ?? null,
    [catalogos.queijos, selectedQueijoId],
  )

  useEffect(() => {
    if (selectedQueijoId === '' && catalogos.queijos.length > 0) {
      setSelectedQueijoId(String(catalogos.queijos[0].id))
    }
  }, [catalogos.queijos, selectedQueijoId])

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
      <div className="section-title-row">
        <div>
          <h2>Preenchimento</h2>
        </div>
        <button className="btn subtle" type="button" onClick={onBack}>
          <ArrowLeft size={16} />Voltar
        </button>
      </div>

      <form className="op-manual-form" onSubmit={onCreate}>
        <div className="op-create-head">
          <label>
            Data
            <input name="data" type="date" defaultValue={today()} required />
          </label>
          <label>
            Queijo
            <select value={selectedQueijoId} onChange={(event) => setSelectedQueijoId(event.target.value)} required>
              <option value="" disabled>Selecione</option>
              {catalogos.queijos.map((queijo) => (
                <option key={queijo.id} value={queijo.id}>{queijo.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Lote
            <input name="lote_codigo" required />
          </label>
          <label>
            Litros
            <input name="lts_total" inputMode="decimal" />
          </label>
        </div>

        <input name="produto_codigo" type="hidden" value={selectedQueijo?.codigo_balanca || selectedQueijo?.id || ''} />
        <input name="produto_op_rotulo" type="hidden" value={selectedQueijo?.op_rotulo ?? ''} />

        <div className="op-insumo-list">
          {insumoRows.map((rowId, index) => {
            const selectedInsumo = insumoByRow(rowId)

            return (
              <div className="op-insumo-row" key={rowId}>
                <strong>Insumo {index + 1}</strong>
                <label>
                  Tipo
                  <select
                    value={selectedInsumos[rowId] ?? ''}
                    onChange={(event) => setSelectedInsumos((current) => ({ ...current, [rowId]: event.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {catalogos.insumos.map((insumo) => (
                      <option key={insumo.id} value={insumo.id}>{insumo.nome}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantidade
                  <input name="insumo_quantidade" inputMode="decimal" />
                </label>
                <span className="op-unit">{selectedInsumo?.unidade ?? ''}</span>
                <input name="insumo_op_rotulo" type="hidden" value={selectedInsumo?.op_rotulo ?? ''} />
                <input name="insumo_unidade" type="hidden" value={selectedInsumo?.unidade ?? ''} />
                <button className="icon-btn" title="Remover insumo" type="button" onClick={() => removeInsumo(rowId)} disabled={insumoRows.length === 1}>
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>

        <div className="form-actions compact-actions">
          <button className="btn" type="button" onClick={addInsumo}><Plus size={16} />Insumo</button>
          <button className="btn primary" type="submit"><Save size={16} />Salvar OP</button>
        </div>
      </form>
    </section>
  )
}
