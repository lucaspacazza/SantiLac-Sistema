import { CheckCircle2, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { OrdemExportFormat, OrdemProducao, OrdemProducaoPayload } from '../../api/producaoApi'
import { OrdemExportMenu } from '../../shared/OrdemExportMenu'

type CampoOrdem = OrdemProducaoPayload['campos'][number]

export function VisualizacaoOrdemProducao({
  ordem,
  salvando,
  onBack,
  onSave,
  onFinalize,
  onDefinirFormato,
  onExport,
}: {
  ordem: OrdemProducao
  salvando: boolean
  onBack: () => void
  onSave: (campos: CampoOrdem[]) => void
  onFinalize: () => void
  onDefinirFormato: (formato: 'f1' | 'f4' | 'f6') => void
  onExport: (format: OrdemExportFormat) => void
}) {
  const [campos, setCampos] = useState<CampoOrdem[]>([])
  const [formato, setFormato] = useState<'f1' | 'f4' | 'f6'>('f4')
  const editavel = ordem.status === 'rascunho'
  const pendenteFormato = ordem.pendencia_formato
  const alterado = useMemo(() => JSON.stringify(campos) !== JSON.stringify(ordem.campos), [campos, ordem.campos])

  useEffect(() => {
    setCampos(ordem.campos)
  }, [ordem])

  const titulo = useMemo(() => {
    return ordem.codigo_ordem ? `OP ${ordem.codigo_ordem}` : 'Ordem de produção'
  }, [ordem.codigo_ordem])

  function updateCampo(index: number, value: string) {
    setCampos((current) => current.map((campo, itemIndex) => (
      itemIndex === index ? { ...campo, valor: value } : campo
    )))
  }

  return (
    <section className="document-view">
      <div className="document-actions">
        <button className="btn secondary subtle" type="button" onClick={onBack}>Voltar</button>
        <OrdemExportMenu disabled={ordem.id === null} onExport={onExport} />
      </div>

      <article className="document-sheet document-sheet-compact">
        <header className="document-header">
          <div>
            <h2>{titulo}</h2>
            <span>Ordem de produção</span>
          </div>
        </header>

        <form
          className="op-sheet-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (editavel) onSave(campos)
          }}
        >
          {pendenteFormato && (
            <div className="op-format-box">
              <label>
                Formato da mussarela
                <select value={formato} onChange={(event) => setFormato(event.target.value as 'f1' | 'f4' | 'f6')}>
                  <option value="f1">F1</option>
                  <option value="f4">F4</option>
                  <option value="f6">F6</option>
                </select>
              </label>
              <button className="btn primary" type="button" disabled={salvando} onClick={() => onDefinirFormato(formato)}>
                <Save size={16} />{salvando ? 'Salvando...' : 'Finalizar OP'}
              </button>
            </div>
          )}

          <div className="op-sheet">
            {campos.map((campo, index) => (
              <label className="op-sheet-line" key={`${campo.rotulo}-${index}`}>
                <span>{campo.rotulo}</span>
                {editavel ? (
                  <input value={campo.valor ?? ''} onChange={(event) => updateCampo(index, event.target.value)} />
                ) : (
                  <span className="op-read-value">{campo.valor}</span>
                )}
              </label>
            ))}
          </div>

          {editavel && (
            <div className="form-actions compact-actions">
              <button className="btn primary" type="submit" disabled={salvando}>
                <Save size={16} />{salvando ? 'Salvando...' : 'Salvar ordem'}
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={salvando || alterado || ordem.id === null}
                title={alterado ? 'Salve as alterações antes de finalizar.' : undefined}
                onClick={onFinalize}
              >
                <CheckCircle2 size={16} />Finalizar OP
              </button>
            </div>
          )}
        </form>
      </article>
    </section>
  )
}
