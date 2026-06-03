import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { OrdemExportFormat, OrdemProducao, OrdemProducaoPayload } from '../../api/producaoApi'
import { OrdemExportMenu } from '../../shared/OrdemExportMenu'

type CampoOrdem = OrdemProducaoPayload['campos'][number]

export function VisualizacaoOrdemProducao({
  ordem,
  salvando,
  onBack,
  onSave,
  onExport,
}: {
  ordem: OrdemProducao
  salvando: boolean
  onBack: () => void
  onSave: (campos: CampoOrdem[]) => void
  onExport: (format: OrdemExportFormat) => void
}) {
  const [campos, setCampos] = useState<CampoOrdem[]>([])
  const finalizada = ordem.status === 'finalizada'

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
            if (!finalizada) onSave(campos)
          }}
        >
          <div className="op-sheet">
            {campos.map((campo, index) => (
              <label className="op-sheet-line" key={`${campo.rotulo}-${index}`}>
                <span>{campo.rotulo}</span>
                {finalizada ? (
                  <span className="op-read-value">{campo.valor}</span>
                ) : (
                  <input value={campo.valor ?? ''} onChange={(event) => updateCampo(index, event.target.value)} />
                )}
              </label>
            ))}
          </div>

          {!finalizada && (
            <div className="form-actions compact-actions">
              <button className="btn primary" type="submit" disabled={salvando}>
                <Save size={16} />{salvando ? 'Salvando...' : 'Salvar ordem'}
              </button>
            </div>
          )}
        </form>
      </article>
    </section>
  )
}
