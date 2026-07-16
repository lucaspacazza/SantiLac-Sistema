import { Search } from 'lucide-react'
import type { FormEvent } from 'react'

export function IniciarEmbalagem({
  codigo,
  carregando,
  onCodigoChange,
  onSubmit,
}: {
  codigo: string
  carregando: boolean
  onCodigoChange: (value: string) => void
  onSubmit: () => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <section className="panel start-panel">
      <div>
        <span className="section-kicker">OP</span>
        <h2>Iniciar embalagem</h2>
      </div>

      <form className="search-form" onSubmit={submit}>
        <label className="field">
          <span>Código da OP</span>
          <input
            autoFocus
            className="control op-input"
            inputMode="text"
            value={codigo}
            onChange={(event) => onCodigoChange(event.target.value)}
            placeholder="Ex.: op1122"
          />
        </label>
        <button className="btn primary" disabled={carregando} type="submit">
          <Search size={17} />
          {carregando ? 'Validando' : 'Buscar'}
        </button>
      </form>
    </section>
  )
}
