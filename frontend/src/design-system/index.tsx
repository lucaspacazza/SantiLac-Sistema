import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export type LoadStatus = 'loading' | 'live' | 'error'

export type NavigationItem = {
  key: string
  label: string
  icon: ReactNode
  active?: boolean
  onClick: () => void
}

export function AppShell({
  workspaceName,
  workspaceInitial = 'S',
  userName,
  navigation,
  topbarActions,
  children,
}: {
  workspaceName: string
  workspaceInitial?: string
  userName: string
  navigation: NavigationItem[]
  topbarActions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="sl-app-shell">
      <aside className="sl-sidebar">
        <div className="sl-workspace">
          <span className="sl-avatar">{workspaceInitial}</span>
          <strong>{workspaceName}</strong>
        </div>

        <nav className="sl-nav" aria-label="Navegação principal">
          {navigation.map((item) => (
            <button
              key={item.key}
              className={`sl-nav-item ${item.active ? 'is-active' : ''}`.trim()}
              type="button"
              onClick={item.onClick}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sl-sidebar-footer">
          <span className="sl-avatar is-small">{userName.slice(0, 1).toUpperCase()}</span>
          <span>{userName}</span>
        </div>
      </aside>

      <main className="sl-content">
        <header className="sl-topbar">
          <span />
          {topbarActions && <nav>{topbarActions}</nav>}
        </header>

        <section className="sl-page">
          {children}
        </section>
      </main>
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  variant?: 'primary' | 'secondary'
}

export function Button({ children, icon, variant = 'secondary', className = '', ...props }: ButtonProps) {
  return (
    <button className={`sl-btn is-${variant} ${className}`.trim()} type="button" {...props}>
      {icon}
      {children}
    </button>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  icon: ReactNode
}

export function IconButton({ label, icon, className = '', ...props }: IconButtonProps) {
  return (
    <button className={`sl-icon-btn ${className}`.trim()} type="button" aria-label={label} title={label} {...props}>
      {icon}
    </button>
  )
}

export function PageHeader({ title, copy, actions }: { title: string; copy: string; actions?: ReactNode }) {
  return (
    <header className="sl-page-head">
      <div>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {actions && <div className="sl-page-actions">{actions}</div>}
    </header>
  )
}

export function StatusLine({ status, text }: { status: LoadStatus; text: string }) {
  return (
    <section className={`sl-status-line is-${status}`}>
      <span className="sl-status-dot" />
      <span>{text}</span>
    </section>
  )
}

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  icon: ReactNode
  value: string
  onValueChange: (value: string) => void
}

export function SearchField({ icon, value, onValueChange, ...props }: SearchFieldProps) {
  return (
    <label className="sl-search-field">
      {icon}
      <input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        type="search"
        {...props}
      />
    </label>
  )
}

export function PanelTitle({ eyebrow, title, icon }: { eyebrow: string; title: string; icon?: ReactNode }) {
  return (
    <div className="sl-panel-title">
      {icon && <span className="sl-panel-icon">{icon}</span>}
      <div>
        <span className="sl-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
    </div>
  )
}

export function InfoCard({
  label,
  value,
  detail,
  icon,
  className = '',
}: {
  label: string
  value: string
  detail?: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <article className={`sl-card ${className}`.trim()}>
      {icon && <span className="sl-panel-icon">{icon}</span>}
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <section className="sl-empty-state">{children}</section>
}
