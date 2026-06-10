import { ArrowLeft, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { cadastrosApi, type Motorista, type MotoristaPayload } from '../../api/cadastrosApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'

type MotoristaFormProps = {
  id?: number
  onBack: () => void
  onSaved: (id: number) => void
}

export function MotoristaForm({ id, onBack, onSaved }: MotoristaFormProps) {
  const isEdit = id !== undefined
  const [motorista, setMotorista] = useState<Motorista | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlay = useLoadingOverlayVisible(loading || saving)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    cadastrosApi.motorista(id)
      .then((result) => { if (active) setMotorista(result) })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar o motorista.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const form = new FormData(event.currentTarget)
      const payload: MotoristaPayload = {
        id,
        nome: String(form.get('nome') ?? '').trim(),
        ativo: form.get('ativo') === 'on',
      }
      const saved = isEdit ? await cadastrosApi.editarMotorista(payload) : await cadastrosApi.criarMotorista(payload)
      onSaved(saved.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o motorista.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page">
      {overlay ? <LoadingOverlay message={saving ? 'Salvando motorista...' : 'Carregando motorista...'} /> : null}
      <header className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}><ArrowLeft size={15} />Voltar</button>
          <h1>{isEdit ? 'Editar motorista' : 'Novo motorista'}</h1>
          <p>{isEdit ? motorista?.nome ?? 'Cadastro do motorista.' : 'Cadastro para seleção nas rotas.'}</p>
        </div>
      </header>

      <section className={`status-line ${error ? 'is-error' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? 'Informe o nome do motorista.'}</span>
      </section>

      <form className="compact-form" onSubmit={(event) => void salvar(event)}>
        <label className="field medium-field">Nome<input name="nome" defaultValue={motorista?.nome ?? ''} required /></label>
        <div className="check-row">
          <label><input name="ativo" type="checkbox" defaultChecked={motorista ? Boolean(motorista.ativo) : true} /> Ativo</label>
        </div>
        <div className="form-actions">
          <button className="btn" type="button" onClick={onBack}>Cancelar</button>
          <button className="btn primary" type="submit"><Save size={16} />Salvar</button>
        </div>
      </form>
    </section>
  )
}


