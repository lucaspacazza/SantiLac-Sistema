import { ArrowLeft, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { cadastrosApi, usuarioAtualEhAdmin, type Usuario, type UsuarioPayload } from '../../api/cadastrosApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'

type UsuarioFormProps = {
  id?: number
  onBack: () => void
  onSaved: (id: number) => void
}

export function UsuarioForm({ id, onBack, onSaved }: UsuarioFormProps) {
  const isEdit = id !== undefined
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canManageAdminFlags, setCanManageAdminFlags] = useState(false)
  const overlay = useLoadingOverlayVisible(loading || saving)

  useEffect(() => {
    let active = true
    usuarioAtualEhAdmin()
      .then((isAdmin) => { if (active) setCanManageAdminFlags(isAdmin) })
      .catch(() => { if (active) setCanManageAdminFlags(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    cadastrosApi.usuario(id)
      .then((result) => { if (active) setUsuario(result) })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar o usuário.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const form = new FormData(event.currentTarget)
      const payload: UsuarioPayload = {
        id,
        codigo: String(form.get('codigo') ?? '').trim(),
        nome: String(form.get('nome') ?? '').trim(),
        usuario: String(form.get('usuario') ?? '').trim(),
        senha: String(form.get('senha') ?? '').trim() || undefined,
        nivel: String(form.get('nivel') ?? '1').trim() || '1',
        admin: canManageAdminFlags ? form.get('admin') === 'on' : Boolean(usuario?.admin),
        ativo: form.get('ativo') === 'on',
        adm_app: canManageAdminFlags ? form.get('adm_app') === 'on' : Boolean(usuario?.adm_app),
        app_coletas: canManageAdminFlags ? form.get('app_coletas') === 'on' : Boolean(usuario?.app_coletas),
      }
      const saved = isEdit ? await cadastrosApi.editarUsuario(payload) : await cadastrosApi.criarUsuario(payload)
      onSaved(saved.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o usuário.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page">
      {overlay ? <LoadingOverlay message={saving ? 'Salvando usuário...' : 'Carregando usuário...'} /> : null}
      <header className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}><ArrowLeft size={15} />Voltar</button>
          <h1>{isEdit ? 'Editar usuário' : 'Novo usuário'}</h1>
          <p>{isEdit ? usuario?.nome ?? 'Cadastro do usuário.' : 'Cadastro de acesso ao sistema.'}</p>
        </div>
      </header>

      <section className={`status-line ${error ? 'is-error' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? 'Preencha os dados principais.'}</span>
      </section>

      <form className="compact-form" onSubmit={(event) => void salvar(event)}>
        <label className="field short-field">Código<input name="codigo" defaultValue={usuario?.codigo ?? ''} required /></label>
        <label className="field medium-field">Nome<input name="nome" defaultValue={usuario?.nome ?? ''} required /></label>
        <label className="field medium-field">Usuário<input name="usuario" defaultValue={usuario?.usuario ?? ''} required /></label>
        <label className="field short-field">Nível<input name="nivel" defaultValue={usuario?.nivel ?? '1'} required /></label>
        <label className="field medium-field">Senha<input name="senha" type="password" placeholder={isEdit ? 'Deixe em branco para manter' : ''} required={!isEdit} /></label>
        <div className="check-row">
          {canManageAdminFlags ? (
            <>
              <label><input name="admin" type="checkbox" defaultChecked={Boolean(usuario?.admin)} /> Admin</label>
              <label><input name="adm_app" type="checkbox" defaultChecked={Boolean(usuario?.adm_app)} /> Admin app</label>
              <label><input name="app_coletas" type="checkbox" defaultChecked={Boolean(usuario?.app_coletas)} /> App coletas</label>
            </>
          ) : null}
          <label><input name="ativo" type="checkbox" defaultChecked={usuario ? Boolean(usuario.ativo) : true} /> Ativo</label>
        </div>
        <div className="form-actions">
          <button className="btn" type="button" onClick={onBack}>Cancelar</button>
          <button className="btn primary" type="submit"><Save size={16} />Salvar</button>
        </div>
      </form>
    </section>
  )
}


