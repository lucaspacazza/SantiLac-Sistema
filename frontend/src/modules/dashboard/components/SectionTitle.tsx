export function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="section-head dashboard-section-title">
      <div>
        <span className="section-kicker">Resumo</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}
