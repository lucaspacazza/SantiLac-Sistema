type Status = 'draft' | 'closed' | 'reopened' | 'cancelled'

const labels: Record<Status, string> = {
  draft: 'Rascunho',
  closed: 'Fechado',
  reopened: 'Reaberto',
  cancelled: 'Cancelado',
}

export function BatchStatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge is-${status}`}>
      {labels[status] ?? status}
    </span>
  )
}
