import { Edit, Plus, Search, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cadastrosApi, type Usuario } from '../../api/cadastrosApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'
import { ConfirmarInativacao } from './ConfirmarInativacao'

type ListagemUsuariosProps = {
  onCreate: () => void
  onEdit: (id: number) => void
  onOpen: (id: number) => void
}

export function ListagemUsuarios({ onCreate, onEdit, onOpen }: ListagemUsuariosProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ativos')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inativar, setInativar] = useState<Usuario | null>(null)
  const loadingOverlayVisible = useLoadingOverlayVisible(loading)

  async function carregar() {
    setLoading(true)
    setError(null)
    try {
      setUsuarios(await cadastrosApi.listarUsuarios({ q, status }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  async function confirmarInativacao() {
    if (!inativar) return
    await cadastrosApi.inativarUsuario(inativar.id)
    setInativar(null)
    await carregar()
  }

  return (
    <section className="page">
      {loadingOverlayVisible ? <LoadingOverlay message="Carregando usuários..." /> : null}
      {inativar ? (
        <ConfirmarInativacao
          titulo="Inativar usuário"
          nome={inativar.nome}
          onCancel={() => setInativar(null)}
          onConfirm={() => void confirmarInativacao()}
        />
      ) : null}

      <header className="page-head compact">
        <div>
          <h1>Usuários</h1>
          <p>Acessos do sistema e permissões do app.</p>
        </div>
        <button className="btn primary" type="button" onClick={onCreate}>
          <Plus size={16} />
          Novo usuário
        </button>
      </header>

      <form className="filters compact-filters" onSubmit={(event) => { event.preventDefault(); void carregar() }}>
        <label className="field">
          Busca
          <span className="input-with-icon">
            <Search size={15} />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Nome, usuário ou código" />
          </span>
        </label>
        <label className="field small-field">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <button className="btn" type="submit">Buscar</button>
      </form>

      <section className={`status-line ${error ? 'is-error' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? `${usuarios.length.toLocaleString('pt-BR')} usuário(s) encontrado(s).`}</span>
      </section>

      <div className="table-wrap compact-table usuarios-table">
        <table>
          <colgroup>
            <col className="col-usuario" />
            <col className="col-codigo" />
            <col className="col-status" />
            <col className="col-acoes" />
          </colgroup>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Código</th>
              <th>Status</th>
              <th className="actions-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td>
                  <button className="name-link" type="button" onClick={() => onOpen(usuario.id)}>
                    <strong>{usuario.nome}</strong>
                    <small>{usuario.usuario}</small>
                  </button>
                </td>
                <td>{usuario.codigo}</td>
                <td><span className={`badge status-${usuario.ativo ? 0 : 2}`}>{usuario.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn small" type="button" title="Editar" onClick={() => onEdit(usuario.id)}><Edit size={15} /></button>
                    {usuario.ativo ? (
                      <button className="icon-btn small danger-icon" type="button" title="Inativar" onClick={() => setInativar(usuario)}><UserX size={15} /></button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && usuarios.length === 0 ? <tr><td colSpan={4} className="empty-row">Nenhum usuário encontrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}


