import { ArrowLeft, Save } from 'lucide-react'
import type { FormEvent } from 'react'
import type { EstoqueItemDetalhe } from '../../api/estoqueApi'

type EditarItemProps = {
  item: EstoqueItemDetalhe | null
  categorias: string[]
  loading: boolean
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function EditarItem({ item, categorias, loading, onBack, onSubmit }: EditarItemProps) {
  if (loading) {
    return (
      <section className="panel detail-empty">
        <p className="empty-copy">Carregando item...</p>
      </section>
    )
  }

  if (item === null) {
    return (
      <section className="panel detail-empty">
        <p className="empty-copy">Item não encontrado.</p>
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
      </section>
    )
  }

  return (
    <section className="detail-grid estoque-detail">
      <header className="detail-title">
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div>
          <span>{item.codigo ?? 'Sem código'}</span>
          <h2>Editar item</h2>
          <p>{item.nome}</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-title">
          <h2>Cadastro</h2>
        </div>

        <form className="form-grid detail-form" onSubmit={onSubmit}>
          <input name="codigo" placeholder="Código" defaultValue={item.codigo ?? ''} />
          <input name="nome" placeholder="Nome do item" defaultValue={item.nome} required />
          <input name="categoria" placeholder="Categoria" list="categorias-estoque-editar" defaultValue={item.categoria} required />
          <datalist id="categorias-estoque-editar">
            {categorias.map((categoria) => <option key={categoria} value={categoria} />)}
          </datalist>
          <input name="unidade" placeholder="Unidade" defaultValue={item.unidade} required />
          <input name="estoque_minimo" placeholder="Estoque mínimo" type="number" step="0.001" min="0" defaultValue={item.estoque_minimo} />
          <label className="check-line">
            <input name="ativo" type="checkbox" defaultChecked={item.ativo} />
            Item ativo
          </label>
          <textarea name="descricao" placeholder="Descrição" defaultValue={item.descricao ?? ''} />
          <div className="modal-actions">
            <button className="btn secondary" type="button" onClick={onBack}>Cancelar</button>
            <button className="btn primary" type="submit">
              <Save size={16} />
              Salvar
            </button>
          </div>
        </form>
      </section>
    </section>
  )
}
