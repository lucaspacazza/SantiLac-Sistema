import { ChevronDown, Download, FileText } from 'lucide-react'
import { useState } from 'react'
import type { ExportFormat } from '../api/producaoApi'

type ExportFormatMenuProps = {
  disabled?: boolean
  isExporting?: boolean
  label?: string
  onExport: (format: ExportFormat) => void
}

export function ExportFormatMenu({
  disabled = false,
  isExporting = false,
  label = 'Exportar',
  onExport,
}: ExportFormatMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isDisabled = disabled || isExporting

  function handleExport(format: ExportFormat) {
    setIsOpen(false)
    onExport(format)
  }

  return (
    <div className="export-menu-wrap">
      <button
        className="export-format-button"
        type="button"
        aria-expanded={isOpen}
        disabled={isDisabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Download size={16} />
        {isExporting ? 'Gerando...' : label}
        <ChevronDown size={15} />
      </button>
      {isOpen && !isDisabled && (
        <div className="export-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => handleExport('docx')}>
            <FileText size={16} />
            DOCX
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
