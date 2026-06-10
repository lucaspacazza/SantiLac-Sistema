import { Edit, Plus, Search, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cadastrosApi, type Produtor } from '../../api/cadastrosApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'
import { ConfirmarInativacao } from './ConfirmarInativacao'

type ListagemProdutoresProps = {
  onCreate: () => void
  onEdit: (id: number) => void
  onOpen: (id: number) => void
}

export function ListagemProdutores({ onCreate, onEdit, onOpen }: ListagemProdutoresProps) {
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [q, setQ] = useState('')
  const [rota, setRota] = useState('')
  const [status, setStatus] = useState('ativos')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inativar, setInativar] = useState<Produtor | null>(null)
  const overlay = useLoadingOverlayVisible(loading)

  async function carregar() {
    setLoading(true)
    setError(null)
    try {
      setProdutores(await cadastrosApi.listarProdutores({ q, status, rota }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os produtores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  async function confirmarInativacao() {
    if (!inativar) return
    await cadastrosApi.inativarProdutor(inativar.id)
    setInativar(null)
    await carregar()
  }

  return (
    <section className="page">
      {overlay ? <LoadingOverlay message="Carregando produtores..." /> : null}
      {inativar ? (
        <ConfirmarInativacao
          titulo="Inativar produtor"
          nome={inativar.nome}
          onCancel={() => setInativar(null)}
          onConfirm={() => void confirmarInativacao()}
        />
      ) : null}

      <header className="page-head compact">
        <div>
          <h1>Produtores</h1>
          <p>Cadastro usado pelo app e roteirização.</p>
        </div>
        <button className="btn primary" type="button" onClick={onCreate}>
          <Plus size={16} />
          Novo produtor
        </button>
      </header>

      <form className="filters producer-filters" onSubmit={(event) => { event.preventDefault(); void carregar() }}>
        <label className="field">
          Busca
          <span className="input-with-icon">
            <Search size={15} />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Nome, código, cidade ou rota" />
          </span>
        </label>
        <label className="field tiny-field">Rota<input value={rota} onChange={(event) => setRota(event.target.value)} /></label>
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
        <span>{error ?? `${produtores.length.toLocaleString('pt-BR')} produtor(es) encontrado(s).`}</span>
      </section>

      <div className="table-wrap compact-table">
        <table>
          <thead>
            <tr>
              <th>Produtor</th>
              <th>Cidade</th>
              <th>Rota</th>
              <th>Contato</th>
              <th>Status</th>
              <th className="actions-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtores.map((produtor) => (
              <tr key={produtor.id}>
                <td>
                  <button className="name-link" type="button" onClick={() => onOpen(produtor.id)}>
                    <strong>{produtor.nome}</strong>
                    <small>Código {produtor.codigo}</small>
                  </button>
                </td>
                <td>{produtor.cidade || '-'}</td>
                <td>{produtor.rota || '-'}</td>
                <td>{produtor.celular || '-'}</td>
                <td><span className={`badge status-${produtor.ativo ? 0 : 2}`}>{produtor.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn small" type="button" title="Editar" onClick={() => onEdit(produtor.id)}><Edit size={15} /></button>
                    {produtor.ativo ? (
                      <button className="icon-btn small danger-icon" type="button" title="Inativar" onClick={() => setInativar(produtor)}><UserX size={15} /></button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && produtores.length === 0 ? <tr><td colSpan={6} className="empty-row">Nenhum produtor encontrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}


