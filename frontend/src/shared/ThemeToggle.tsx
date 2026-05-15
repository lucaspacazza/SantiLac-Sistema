import { Moon, Sun } from 'lucide-react'

export type ThemeMode = 'dark' | 'light'

type ThemeToggleProps = {
  theme: ThemeMode
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isLight = theme === 'light'

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={isLight ? 'Usar tema escuro' : 'Usar tema claro'}
      title={isLight ? 'Tema escuro' : 'Tema claro'}
      onClick={onToggle}
    >
      {isLight ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  )
}
