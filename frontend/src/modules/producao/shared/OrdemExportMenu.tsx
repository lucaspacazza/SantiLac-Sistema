import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { useState } from 'react'
import type { OrdemExportFormat } from '../api/producaoApi'

type OrdemExportMenuProps = {
  disabled?: boolean
  onExport: (format: OrdemExportFormat) => void
}

export function OrdemExportMenu({ disabled = false, onExport }: OrdemExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  function handleExport(format: OrdemExportFormat) {
    setIsOpen(false)
    onExport(format)
  }

  return (
    <div className="export-menu-wrap">
      <button
        className="export-format-button"
        type="button"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Download size={16} />
        Exportar
        <ChevronDown size={15} />
      </button>
      {isOpen && !disabled && (
        <div className="export-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => handleExport('xlsx')}>
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <button type="button" role="menuitem" onClick={() => handleExport('pdf')}>
            <FileText size={16} />
            PDF
          </button>
        </div>
      )}
    </div>
  )
}
