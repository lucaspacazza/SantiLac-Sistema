import { AlertCircle, CheckCircle2, Database, FileSpreadsheet, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { qualidadeApi, type Analise, type ImportAnalisesResponse } from '../../api/qualidadeApi'
import { formatDate, formatNumber } from '../../shared/formatters'

type LoadStatus = 'loading' | 'live' | 'error'

type AnalisesProps = {
  reloadKey: number
}

const MAX_FILES = 3

export function Analises({ reloadKey }: AnalisesProps) {
  const [analises, setAnalises] = useState<Analise[]>([])
  const [totalAnalises, setTotalAnalises] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando análises...')
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportAnalisesResponse | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function loadAnalises() {
    setStatus('loading')
    setStatusText('Carregando análises...')

    try {
      const response = await qualidadeApi.analises()
      setAnalises(response.items)
      setTotalAnalises(response.pagination.total)
      setStatus('live')
      setStatusText(`${response.pagination.total} análises registradas.`)
    } catch {
      setAnalises([])
      setTotalAnalises(0)
      setStatus('error')
      setStatusText('Não foi possível carregar as análises.')
    }
  }

  useEffect(() => {
    void loadAnalises()
  }, [reloadKey])

  function applySelectedFiles(files: File[]) {
    const validFiles = files.filter((file) => /\.(csv|xls|xlsx)$/i.test(file.name))

    if (validFiles.length === 0) {
      setImportError('Selecione arquivos CSV, XLS ou XLSX.')
      return
    }

    if (validFiles.length > MAX_FILES) {
      setImportError(`Selecione no máximo ${MAX_FILES} planilhas por importação.`)
    } else {
      setImportError(null)
    }

    setSelectedFiles(validFiles.slice(0, MAX_FILES))
    setImportResult(null)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    applySelectedFiles(Array.from(event.dataTransfer.files))
  }

  async function handleImport() {
    if (selectedFiles.length === 0) return

    setIsImporting(true)
    setImportError(null)
    setImportResult(null)

    try {
      const results: ImportAnalisesResponse[] = []

      for (const file of selectedFiles) {
        results.push(await qualidadeApi.importarAnalises(file))
      }

      setImportResult(mergeImportResults(results))
      setSelectedFiles([])
      setFileInputKey((current) => current + 1)
      await loadAnalises()
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Falha ao importar arquivo.')
    } finally {
      setIsImporting(false)
    }
  }

  const ultimaAnalise = useMemo(() => analises[0]?.data ?? null, [analises])
  const selectedFileLabel = selectedFiles.length === 0
    ? 'Selecionar arquivo'
    : selectedFiles.length === 1
      ? selectedFiles[0].name
      : `${selectedFiles.length} arquivos selecionados`
  const selectedFileSize = selectedFiles.length > 0
    ? `${Math.max(selectedFiles.reduce((total, file) => total + file.size, 0) / 1024, 1).toFixed(1)} KB`
    : 'CSV, XLS ou XLSX'

  return (
    <>
      <section className={`status-line is-${status}`}>
        <span className="status-dot" />
        <span>{statusText}</span>
      </section>

      <section className="analysis-layout">
        <section className="upload-panel">
          <div className="panel-title">
            <span className="panel-icon"><Upload size={17} /></span>
            <div>
              <span className="eyebrow">Importação</span>
              <h2>Arquivos de análises</h2>
            </div>
          </div>

          <label
            className={`upload-box ${isDragging ? 'is-dragging' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              key={fileInputKey}
              type="file"
              accept=".csv,.xls,.xlsx"
              multiple
              onChange={(event) => applySelectedFiles(Array.from(event.target.files ?? []))}
            />
            <FileSpreadsheet size={24} />
            <strong>{selectedFileLabel}</strong>
            <span>{selectedFileSize} · até {MAX_FILES} planilhas</span>
          </label>

          {selectedFiles.length > 0 && (
            <div className="selected-files">
              {selectedFiles.map((file) => (
                <span key={`${file.name}-${file.size}`}>{file.name}</span>
              ))}
            </div>
          )}

          <div className="upload-actions">
            <button className="btn primary" type="button" disabled={selectedFiles.length === 0 || isImporting} onClick={handleImport}>
              {isImporting ? 'Importando...' : 'Processar'}
            </button>
            <button
              className="btn secondary"
              type="button"
              disabled={selectedFiles.length === 0 || isImporting}
              onClick={() => {
                setSelectedFiles([])
                setFileInputKey((current) => current + 1)
              }}
            >
              <X size={16} />
              Limpar
            </button>
          </div>
        </section>

        <section className="analysis-cards">
          <InfoCard icon={<Database size={17} />} label="Análises registradas" value={formatNumber(totalAnalises)} />
          <section className="import-card">
            {importError ? (
              <ImportMessage type="error" title="Falha na importação" text={importError} />
            ) : importResult ? (
              <ImportSummary result={importResult} />
            ) : (
              <ImportMessage type="success" title="Importação" text="Nenhuma importação processada nesta etapa." />
            )}
          </section>
          <InfoCard icon={<AlertCircle size={17} />} label="Pendências" value="0" />
        </section>

        <section className="import-history">
          <InfoCard icon={<CheckCircle2 size={17} />} label="Última análise" value={formatDate(ultimaAnalise)} />
        </section>
      </section>
    </>
  )
}

function InfoCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="analysis-card">
      <span className="panel-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ImportMessage({ type, title, text }: { type: 'error' | 'success'; title: string; text: string }) {
  return (
    <div className={`import-message is-${type}`}>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  )
}

function ImportSummary({ result }: { result: ImportAnalisesResponse }) {
  const missingCodes = result.warnings
    .flatMap((warning) => warning.details?.produtor_codigos ?? [])
    .filter(Boolean)

  return (
    <div className="import-result">
      <div className="import-result-head">
        <strong>Importação processada</strong>
        <span>{result.summary.arquivo}</span>
      </div>

      <div className="import-result-grid">
        <SummaryChip label="Criados" value={result.summary.registros_criados} />
        <SummaryChip label="Completados" value={result.summary.registros_completados} />
        <SummaryChip label="Sem mudança" value={result.summary.registros_sem_mudanca} />
        <SummaryChip label="Erros" value={result.summary.linhas_com_erro} />
      </div>

      {result.summary.ja_importado && (
        <p>Uma ou mais planilhas já tinham sido importadas antes. Dados existentes não foram substituídos.</p>
      )}

      {missingCodes.length > 0 && (
        <p>Produtores não encontrados: {[...new Set(missingCodes)].join(', ')}</p>
      )}
    </div>
  )
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="summary-chip">
      {label}: <strong>{formatNumber(value)}</strong>
    </span>
  )
}

function mergeImportResults(results: ImportAnalisesResponse[]): ImportAnalisesResponse {
  const summary = results.reduce<ImportAnalisesResponse['summary']>((merged, result) => ({
    arquivo: results.length === 1 ? result.summary.arquivo : `${results.length} planilhas`,
    arquivo_hash: null,
    ja_importado: merged.ja_importado || result.summary.ja_importado,
    total_linhas: merged.total_linhas + result.summary.total_linhas,
    linhas_validas_processor: merged.linhas_validas_processor + result.summary.linhas_validas_processor,
    linhas_com_erro: merged.linhas_com_erro + result.summary.linhas_com_erro,
    produtores_nao_encontrados: merged.produtores_nao_encontrados + result.summary.produtores_nao_encontrados,
    registros_criados: merged.registros_criados + result.summary.registros_criados,
    registros_completados: merged.registros_completados + result.summary.registros_completados,
    registros_sem_mudanca: merged.registros_sem_mudanca + result.summary.registros_sem_mudanca,
  }), {
    arquivo: null,
    arquivo_hash: null,
    ja_importado: false,
    total_linhas: 0,
    linhas_validas_processor: 0,
    linhas_com_erro: 0,
    produtores_nao_encontrados: 0,
    registros_criados: 0,
    registros_completados: 0,
    registros_sem_mudanca: 0,
  } satisfies ImportAnalisesResponse['summary'])

  return {
    summary,
    warnings: results.flatMap((result) => result.warnings),
    errors: results.flatMap((result) => result.errors),
  }
}
