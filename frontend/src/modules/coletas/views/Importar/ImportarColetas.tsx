import { AlertCircle, CalendarRange, CheckCircle2, Database, FileText, Upload, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { importacaoApi, type ColetasImportacaoResult } from '../../api/importacaoApi'
import { formatLitros } from '../Rotas/formatters'

const MAX_FILE_BYTES = 100 * 1024 * 1024

export function ImportarColetas() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ColetasImportacaoResult | null>(null)

  function selectFile(candidate: File | undefined) {
    setResult(null)
    if (!candidate) return
    if (!candidate.name.toLowerCase().endsWith('.pdf') || candidate.type && candidate.type !== 'application/pdf') {
      setFile(null)
      setError('Selecione o PDF Leite - Relação de Tiket de Entrada.')
      return
    }
    if (candidate.size > MAX_FILE_BYTES) {
      setFile(null)
      setError('O PDF pode ter no máximo 100 MB.')
      return
    }
    setFile(candidate)
    setError(null)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    selectFile(event.dataTransfer.files[0])
  }

  async function handleImport() {
    if (!file || importing) return
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      setResult(await importacaoApi.importar(file))
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Não foi possível importar o PDF.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="page leite-import-page">
      <header className="page-head">
        <div>
          <h1>Importar coletas</h1>
          <p>Importe o relatório Leite - Relação de Tiket de Entrada em formato PDF.</p>
        </div>
      </header>

      <article className="leite-import-panel">
        <div className="leite-import-panel-head">
          <span className="leite-import-icon"><Upload size={20} /></span>
          <div>
            <h2>Arquivo de coletas</h2>
            <p>O processor identifica produtor, data e quantidade e registra apenas coletas ainda inexistentes.</p>
          </div>
        </div>

        <div
          className={`leite-import-dropzone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            id="coletas-pdf"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          {file ? (
            <div className="leite-import-file">
              <FileText size={28} />
              <div>
                <strong>{file.name}</strong>
                <span>{formatBytes(file.size)}</span>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Remover arquivo"
                onClick={() => {
                  setFile(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label htmlFor="coletas-pdf">
              <Upload size={30} />
              <strong>Arraste o PDF aqui</strong>
              <span>ou clique para selecionar · máximo de 100 MB</span>
            </label>
          )}
        </div>

        {error ? <div className="leite-import-message is-error" role="alert"><AlertCircle size={17} />{error}</div> : null}

        <div className="leite-import-actions">
          <button className="btn primary" type="button" disabled={!file || importing} onClick={() => void handleImport()}>
            <Upload size={16} />
            {importing ? 'Processando PDF...' : 'Importar'}
          </button>
          <span>{importing ? 'Aguarde enquanto o processor analisa todas as páginas.' : 'Coletas do mesmo produtor e dia não são duplicadas.'}</span>
        </div>
      </article>

      {result ? <ImportResult result={result} /> : null}
    </section>
  )
}

function ImportResult({ result }: { result: ColetasImportacaoResult }) {
  const summary = result.summary
  return (
    <article className="leite-import-result" aria-live="polite">
      <header>
        <span className="leite-import-success"><CheckCircle2 size={19} /></span>
        <div>
          <h2>{summary.ja_importado && summary.registros_criados === 0 ? 'Nenhuma coleta nova' : 'Importação concluída'}</h2>
          <p>{summary.arquivo}</p>
        </div>
      </header>
      <div className="leite-import-summary">
        <SummaryItem icon={<Database size={17} />} label="Coletas registradas" value={String(summary.registros_criados)} />
        <SummaryItem icon={<FileText size={17} />} label="Coletas lidas" value={String(summary.registros_lidos)} />
        <SummaryItem icon={<Database size={17} />} label="Litros importados" value={formatLitros(summary.litros_importados)} />
        <SummaryItem icon={<CalendarRange size={17} />} label="Período" value={formatPeriod(summary.data_inicio, summary.data_fim)} />
      </div>
      <p className="leite-import-result-note">
        {summary.registros_ignorados > 0 ? `${summary.registros_ignorados} coleta(s) existente(s) foram preservadas. ` : ''}
        {summary.produtores_criados > 0 ? `${summary.produtores_criados} produtor(es) foram cadastrados a partir do relatório.` : ''}
      </p>
    </article>
  )
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="leite-import-summary-item"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatPeriod(start: string, end: string) {
  if (!start || !end) return 'Não informado'
  const format = (value: string) => value.split('-').reverse().join('/')
  return start === end ? format(start) : `${format(start)} a ${format(end)}`
}
