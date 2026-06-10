import { ArrowLeft, Edit } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usuarioAtualEhAdmin, type Usuario } from '../../api/cadastrosApi'
import { buscarDetalheUsuario } from '../../api/detalheUsuarioApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'

type DetalheUsuarioProps = {
  id: number
  onBack: () => void
  onEdit: (id: number) => void
}

export function DetalheUsuario({ id, onBack, onEdit }: DetalheUsuarioProps) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canViewAdminFields, setCanViewAdminFields] = useState(false)
  const overlay = useLoadingOverlayVisible(loading)

  useEffect(() => {
    let active = true
    usuarioAtualEhAdmin()
      .then((isAdmin) => { if (active) setCanViewAdminFields(isAdmin) })
      .catch(() => { if (active) setCanViewAdminFields(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    buscarDetalheUsuario(id)
      .then((result) => { if (active) setUsuario(result) })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar o usuário.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  return (
    <section className="page">
      {overlay ? <LoadingOverlay message="Carregando usuário..." /> : null}
      <header className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}><ArrowLeft size={15} />Voltar</button>
          <h1>{usuario?.nome ?? 'Usuário'}</h1>
          <p>{usuario ? `Código ${usuario.codigo} · ${usuario.usuario}` : 'Detalhe do usuário.'}</p>
        </div>
        {usuario ? <button className="btn primary" type="button" onClick={() => onEdit(usuario.id)}><Edit size={16} />Editar</button> : null}
      </header>

      <section className={`status-line ${error ? 'is-error' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? 'Usuário carregado.'}</span>
      </section>

      {usuario ? (
        <section className="detail-grid single-detail-grid">
          <div className="panel">
            <h2>Dados do usuário</h2>
            <dl className="info-list">
              <dt>Nome</dt><dd>{usuario.nome}</dd>
              <dt>Usuário</dt><dd>{usuario.usuario}</dd>
              <dt>Código</dt><dd>{usuario.codigo}</dd>
              <dt>Nível</dt><dd>{usuario.nivel || '-'}</dd>
              <dt>Status</dt><dd>{usuario.ativo ? 'Ativo' : 'Inativo'}</dd>
              {canViewAdminFields ? (
                <>
                  <dt>Admin</dt><dd>{usuario.admin ? 'Sim' : 'Não'}</dd>
                  <dt>Admin app</dt><dd>{usuario.adm_app ? 'Sim' : 'Não'}</dd>
                  <dt>App coletas</dt><dd>{usuario.app_coletas ? 'Sim' : 'Não'}</dd>
                </>
              ) : null}
              <dt>Último login</dt><dd>{usuario.ultimo_login ?? '-'}</dd>
              <dt>Criado em</dt><dd>{usuario.criado_em ?? '-'}</dd>
            </dl>
          </div>
        </section>
      ) : null}
    </section>
  )
}
