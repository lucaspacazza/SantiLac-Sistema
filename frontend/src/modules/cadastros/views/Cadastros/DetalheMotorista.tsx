import { ArrowLeft, Edit } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Motorista } from '../../api/cadastrosApi'
import { buscarDetalheMotorista } from '../../api/detalheMotoristaApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'

type DetalheMotoristaProps = {
  id: number
  onBack: () => void
  onEdit: (id: number) => void
}

export function DetalheMotorista({ id, onBack, onEdit }: DetalheMotoristaProps) {
  const [motorista, setMotorista] = useState<Motorista | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const overlay = useLoadingOverlayVisible(loading)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    buscarDetalheMotorista(id)
      .then((result) => { if (active) setMotorista(result) })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar o motorista.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  return (
    <section className="page">
      {overlay ? <LoadingOverlay message="Carregando motorista..." /> : null}
      <header className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}><ArrowLeft size={15} />Voltar</button>
          <h1>{motorista?.nome ?? 'Motorista'}</h1>
          <p>{motorista ? `ID ${motorista.id}` : 'Detalhe do motorista.'}</p>
        </div>
        {motorista ? <button className="btn primary" type="button" onClick={() => onEdit(motorista.id)}><Edit size={16} />Editar</button> : null}
      </header>

      <section className={`status-line ${error ? 'is-error' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? 'Motorista carregado.'}</span>
      </section>

      {motorista ? (
        <section className="detail-grid single-detail-grid">
          <div className="panel">
            <h2>Dados do motorista</h2>
            <dl className="info-list">
              <dt>Nome</dt><dd>{motorista.nome}</dd>
              <dt>ID</dt><dd>{motorista.id}</dd>
              <dt>Status</dt><dd>{motorista.ativo ? 'Ativo' : 'Inativo'}</dd>
            </dl>
          </div>
        </section>
      ) : null}
    </section>
  )
}
