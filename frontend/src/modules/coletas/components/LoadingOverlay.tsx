export function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="coletas-loading-overlay" role="status" aria-live="polite" aria-label={message}>
      <div className="coletas-loading-card">
        <span className="coletas-loading-spinner" />
        <strong>Carregando</strong>
        <span>{message}</span>
      </div>
    </div>
  )
}
