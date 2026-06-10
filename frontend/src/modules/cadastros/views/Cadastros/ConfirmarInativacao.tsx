type ConfirmarInativacaoProps = {
  titulo: string
  nome: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmarInativacao({ titulo, nome, onCancel, onConfirm }: ConfirmarInativacaoProps) {
  return (
    <div className="modal-backdrop">
      <section className="modal-panel">
        <h2>{titulo}</h2>
        <p>Inativar {nome}?</p>
        <div className="modal-actions">
          <button className="btn" type="button" onClick={onCancel}>Voltar</button>
          <button className="btn danger" type="button" onClick={onConfirm}>Inativar</button>
        </div>
      </section>
    </div>
  )
}


