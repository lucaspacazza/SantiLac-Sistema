import { Edit, Plus, Search, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cadastrosApi, type Motorista } from '../../api/cadastrosApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'
import { ConfirmarInativacao } from './ConfirmarInativacao'

type ListagemMotoristasProps = {
  onCreate: () => void
  onEdit: (id: number) => void
  onOpen: (id: number) => void
}

export function ListagemMotoristas({ onCreate, onEdit, onOpen }: ListagemMotoristasProps) {
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ativos')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inativar, setInativar] = useState<Motorista | null>(null)
  const overlay = useLoadingOverlayVisible(loading)

  async function carregar() {
    setLoading(true)
    setError(null)
    try {
      setMotoristas(await cadastrosApi.listarMotoristas({ q, status }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os motoristas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  async function confirmarInativacao() {
    if (!inativar) return
    await cadastrosApi.inativarMotorista(inativar.id)
    setInativar(null)
    await carregar()
  }

  return (
    <section className="page">
      {overlay ? <LoadingOverlay message="Carregando motoristas..." /> : null}
      {inativar ? (
        <ConfirmarInativacao
          titulo="Inativar motorista"
          nome={inativar.nome}
          onCancel={() => setInativar(null)}
          onConfirm={() => void confirmarInativacao()}
        />
      ) : null}

      <header className="page-head compact">
        <div>
          <h1>Motoristas</h1>
          <p>Motoristas disponíveis para rotas do app.</p>
        </div>
        <button className="btn primary" type="button" onClick={onCreate}>
          <Plus size={16} />
          Novo motorista
        </button>
      </header>

      <form className="filters compact-filters" onSubmit={(event) => { event.preventDefault(); void carregar() }}>
        <label className="field">
          Busca
          <span className="input-with-icon">
            <Search size={15} />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Nome do motorista" />
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
        <span>{error ?? `${motoristas.length.toLocaleString('pt-BR')} motorista(s) encontrado(s).`}</span>
      </section>

      <div className="table-wrap compact-table narrow-table">
        <table>
          <thead>
            <tr>
              <th>Motorista</th>
              <th>Status</th>
              <th className="actions-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map((motorista) => (
              <tr key={motorista.id}>
                <td>
                  <button className="name-link" type="button" onClick={() => onOpen(motorista.id)}>
                    <strong>{motorista.nome}</strong>
                    <small>ID {motorista.id}</small>
                  </button>
                </td>
                <td><span className={`badge status-${motorista.ativo ? 0 : 2}`}>{motorista.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn small" type="button" title="Editar" onClick={() => onEdit(motorista.id)}><Edit size={15} /></button>
                    {motorista.ativo ? (
                      <button className="icon-btn small danger-icon" type="button" title="Inativar" onClick={() => setInativar(motorista)}><UserX size={15} /></button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && motoristas.length === 0 ? <tr><td colSpan={3} className="empty-row">Nenhum motorista encontrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}


