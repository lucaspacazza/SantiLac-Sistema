import { AlertCircle, CheckCircle2, Database, FileSpreadsheet, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { qualidadeApi, type Analise } from '../../api/qualidadeApi'
import { formatDate, formatNumber } from '../../shared/formatters'

type LoadStatus = 'loading' | 'live' | 'error'

type AnalisesProps = {
  reloadKey: number
}

const camposAnalise = [
  'produtor_codigo',
  'data',
  'gordura',
  'proteina',
  'lactose',
  'solidos_totais',
  'ccs',
  'ufc',
  'caseina',
  'sng',
  'ureia',
  'antibiotico',
  'bacteria',
  'temperatura',
]

export function Analises({ reloadKey }: AnalisesProps) {
  const [analises, setAnalises] = useState<Analise[]>([])
  const [totalAnalises, setTotalAnalises] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando análises...')

  async function loadAnalises() {
    setStatus('loading')
    setStatusText('Carregando análises...')

    try {
      const response = await qualidadeApi.analises()
      setAnalises(response.items)
      setTotalAnalises(response.pagination.total)
      setStatus('live')
      setStatusText(`${response.pagination.total} análise(s) registrada(s) na API.`)
    } catch {
      setAnalises([])
      setTotalAnalises(0)
      setStatus('error')
      setStatusText('Não foi possível carregar as análises da API.')
    }
  }

  useEffect(() => {
    void loadAnalises()
  }, [reloadKey])

  const ultimaAnalise = useMemo(() => analises[0]?.data ?? null, [analises])
  const fileSize = selectedFile ? `${Math.max(selectedFile.size / 1024, 1).toFixed(1)} KB` : null

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
              <h2>Arquivo de análises</h2>
            </div>
          </div>

          <label className="upload-box">
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <FileSpreadsheet size={24} />
            <strong>{selectedFile?.name ?? 'Selecionar arquivo'}</strong>
            <span>{fileSize ?? 'CSV, XLS ou XLSX'}</span>
          </label>

          <div className="upload-actions">
            <button className="btn primary" type="button" disabled>
              Enviar para processor
            </button>
            <button className="btn secondary" type="button" disabled={!selectedFile} onClick={() => setSelectedFile(null)}>
              <X size={16} />
              Limpar
            </button>
          </div>
        </section>

        <section className="analysis-cards">
          <InfoCard icon={<Database size={17} />} label="Análises registradas" value={formatNumber(totalAnalises)} />
          <InfoCard icon={<CheckCircle2 size={17} />} label="Última análise" value={formatDate(ultimaAnalise)} />
          <InfoCard icon={<AlertCircle size={17} />} label="Pendências" value="0" />
        </section>

        <section className="schema-panel">
          <div className="panel-title">
            <span className="panel-icon"><FileSpreadsheet size={17} /></span>
            <div>
              <span className="eyebrow">Estrutura V3</span>
              <h2>Campos esperados</h2>
            </div>
          </div>
          <div className="field-grid">
            {camposAnalise.map((campo) => (
              <span key={campo}>{campo}</span>
            ))}
          </div>
        </section>

        <section className="empty-state import-history">
          Nenhuma importação processada nesta etapa.
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
