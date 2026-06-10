import { ArrowLeft, Edit } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Produtor } from '../../api/cadastrosApi'
import { buscarDetalheProdutor } from '../../api/detalheProdutorApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'

type DetalheProdutorProps = {
  id: number
  onBack: () => void
  onEdit: (id: number) => void
}

export function DetalheProdutor({ id, onBack, onEdit }: DetalheProdutorProps) {
  const [produtor, setProdutor] = useState<Produtor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const overlay = useLoadingOverlayVisible(loading)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    buscarDetalheProdutor(id)
      .then((result) => { if (active) setProdutor(result) })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar o produtor.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  return (
    <section className="page">
      {overlay ? <LoadingOverlay message="Carregando produtor..." /> : null}
      <header className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}><ArrowLeft size={15} />Voltar</button>
          <h1>{produtor?.nome ?? 'Produtor'}</h1>
          <p>{produtor ? `Código ${produtor.codigo} · Rota ${produtor.rota || '-'}` : 'Detalhe do produtor.'}</p>
        </div>
        {produtor ? <button className="btn primary" type="button" onClick={() => onEdit(produtor.id)}><Edit size={16} />Editar</button> : null}
      </header>

      <section className={`status-line ${error ? 'is-error' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? 'Produtor carregado.'}</span>
      </section>

      {produtor ? (
        <section className="detail-grid single-detail-grid">
          <div className="panel">
            <h2>Dados do produtor</h2>
            <dl className="info-list">
              <dt>Nome</dt><dd>{produtor.nome}</dd>
              <dt>Código</dt><dd>{produtor.codigo}</dd>
              <dt>Cidade</dt><dd>{produtor.cidade || '-'}</dd>
              <dt>Rota</dt><dd>{produtor.rota || '-'}</dd>
              <dt>Celular</dt><dd>{produtor.celular || '-'}</dd>
              <dt>CPF/CNPJ</dt><dd>{produtor.cpf_cnpj || '-'}</dd>
              <dt>CEP</dt><dd>{produtor.cep || '-'}</dd>
              <dt>Endereço</dt><dd>{produtor.endereco || '-'}</dd>
              <dt>Status</dt><dd>{produtor.ativo ? 'Ativo' : 'Inativo'}</dd>
              <dt>Diário</dt><dd>{produtor.diario ? 'Sim' : 'Não'}</dd>
              <dt>Novo</dt><dd>{produtor.novo ? 'Sim' : 'Não'}</dd>
              <dt>Projeto</dt><dd>{produtor.projeto ? 'Sim' : 'Não'}</dd>
              <dt>Cadastro</dt><dd>{produtor.data_cadastro ?? '-'}</dd>
              <dt>Inativação</dt><dd>{produtor.data_inativacao ?? '-'}</dd>
            </dl>
          </div>
        </section>
      ) : null}
    </section>
  )
}
