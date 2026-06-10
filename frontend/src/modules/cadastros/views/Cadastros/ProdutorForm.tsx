import { ArrowLeft, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { cadastrosApi, type Produtor, type ProdutorPayload } from '../../api/cadastrosApi'
import { LoadingOverlay } from '../../components/LoadingOverlay'
import { useLoadingOverlayVisible } from '../../hooks/useLoadingOverlayVisible'

type ProdutorFormProps = {
  id?: number
  onBack: () => void
  onSaved: (id: number) => void
}

export function ProdutorForm({ id, onBack, onSaved }: ProdutorFormProps) {
  const isEdit = id !== undefined
  const [produtor, setProdutor] = useState<Produtor | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlay = useLoadingOverlayVisible(loading || saving)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    cadastrosApi.produtor(id)
      .then((result) => { if (active) setProdutor(result) })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar o produtor.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const form = new FormData(event.currentTarget)
      const payload: ProdutorPayload = {
        id,
        codigo: String(form.get('codigo') ?? '').trim(),
        nome: String(form.get('nome') ?? '').trim(),
        cidade: String(form.get('cidade') ?? '').trim(),
        rota: String(form.get('rota') ?? '').trim(),
        diario: form.get('diario') === 'on',
        endereco: String(form.get('endereco') ?? '').trim() || undefined,
        cep: String(form.get('cep') ?? '').trim() || undefined,
        cpf_cnpj: String(form.get('cpf_cnpj') ?? '').trim() || undefined,
        celular: String(form.get('celular') ?? '').trim() || undefined,
        ativo: form.get('ativo') === 'on',
        novo: form.get('novo') === 'on',
        projeto: form.get('projeto') === 'on',
      }
      const saved = isEdit ? await cadastrosApi.editarProdutor(payload) : await cadastrosApi.criarProdutor(payload)
      onSaved(saved.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o produtor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page">
      {overlay ? <LoadingOverlay message={saving ? 'Salvando produtor...' : 'Carregando produtor...'} /> : null}
      <header className="page-head compact">
        <div>
          <button className="text-btn" type="button" onClick={onBack}><ArrowLeft size={15} />Voltar</button>
          <h1>{isEdit ? 'Editar produtor' : 'Novo produtor'}</h1>
          <p>{isEdit ? produtor?.nome ?? 'Cadastro do produtor.' : 'Cadastro usado nas rotas de coleta.'}</p>
        </div>
      </header>

      <section className={`status-line ${error ? 'is-error' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{error ?? 'Preencha os dados principais.'}</span>
      </section>

      <form className="compact-form producer-form" onSubmit={(event) => void salvar(event)}>
        <label className="field short-field">Código<input name="codigo" defaultValue={produtor?.codigo ?? ''} required /></label>
        <label className="field wide-field">Nome<input name="nome" defaultValue={produtor?.nome ?? ''} required /></label>
        <label className="field medium-field">Cidade<input name="cidade" defaultValue={produtor?.cidade ?? ''} /></label>
        <label className="field tiny-field">Rota<input name="rota" defaultValue={produtor?.rota ?? ''} /></label>
        <label className="field medium-field">Celular<input name="celular" defaultValue={produtor?.celular ?? ''} /></label>
        <label className="field medium-field">CPF/CNPJ<input name="cpf_cnpj" defaultValue={produtor?.cpf_cnpj ?? ''} /></label>
        <label className="field medium-field">CEP<input name="cep" defaultValue={produtor?.cep ?? ''} /></label>
        <label className="field wide-field">Endereço<input name="endereco" defaultValue={produtor?.endereco ?? ''} /></label>
        <div className="check-row">
          <label><input name="diario" type="checkbox" defaultChecked={Boolean(produtor?.diario)} /> Diário</label>
          <label><input name="novo" type="checkbox" defaultChecked={produtor ? Boolean(produtor.novo) : true} /> Novo</label>
          <label><input name="projeto" type="checkbox" defaultChecked={Boolean(produtor?.projeto)} /> Projeto</label>
          <label><input name="ativo" type="checkbox" defaultChecked={produtor ? Boolean(produtor.ativo) : true} /> Ativo</label>
        </div>
        <div className="form-actions">
          <button className="btn" type="button" onClick={onBack}>Cancelar</button>
          <button className="btn primary" type="submit"><Save size={16} />Salvar</button>
        </div>
      </form>
    </section>
  )
}


