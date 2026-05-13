import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { pendenciasApi, type PendenciasProdutorResponse } from '../../api/pendenciasApi'
import { formatAnalysisMetric, type AnalysisMetricField } from '../../shared/analysisMetrics'
import { formatDate, formatDecimal } from '../../shared/formatters'

type LoadStatus = 'loading' | 'live' | 'error'

type PendenciasProdutorProps = {
  codigo: string
  onBack: () => void
}

export function PendenciasProdutor({ codigo, onBack }: PendenciasProdutorProps) {
  const [data, setData] = useState<PendenciasProdutorResponse | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando pendências...')

  useEffect(() => {
    let active = true

    async function loadPendencias() {
      setStatus('loading')
      setStatusText('Carregando pendências...')

      try {
        const response = await pendenciasApi.produtor(codigo)
        if (!active) return
        setData(response)
        setStatus('live')
        setStatusText(`${response.total_pendencias} pendência(s) encontrada(s).`)
      } catch {
        if (!active) return
        setData(null)
        setStatus('error')
        setStatusText('Não foi possível carregar as pendências.')
      }
    }

    void loadPendencias()

    return () => {
      active = false
    }
  }, [codigo])

  return (
    <section className="producer-issues-page">
      <button className="btn secondary" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Voltar para relatórios
      </button>

      <section className={`status-line is-${status}`}>
        <span className="status-dot" />
        <span>{statusText}</span>
      </section>

      {data === null ? (
        <section className="empty-state">Nenhuma informação encontrada para este produtor.</section>
      ) : (
        <>
          <section className="issue-detail-header">
            <div>
              <span className="eyebrow">Produtor</span>
              <h2>{data.produtor.nome}</h2>
              <p>Código {data.produtor.codigo} - {data.produtor.cidade || 'Cidade não informada'} - {data.periodo.label}</p>
            </div>
            <strong>{data.total_pendencias} pendência(s)</strong>
          </section>

          {data.pendencias.length === 0 ? (
            <section className="empty-state">Este produtor está dentro do padrão no período selecionado.</section>
          ) : (
            <section className="issue-table-card">
              <div className="issue-table-meta">
                <span>Status: {statusLabel(data.status_qualidade)}</span>
                <span>Última análise: {formatDate(data.ultima_analise?.data)}</span>
              </div>
              <table className="data-table issue-table">
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th>Valor encontrado</th>
                    <th>Referência</th>
                    <th>Gravidade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendencias.map((pendencia) => (
                    <tr key={pendencia.codigo}>
                      <td>{pendencia.label}</td>
                      <td>{formatIssueValue(pendencia.codigo, pendencia.valor, pendencia.unidade)}</td>
                      <td>{pendencia.referencia}{pendencia.unidade ? ` ${pendencia.unidade}` : ''}</td>
                      <td>{formatDecimal(pendencia.gravidade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </section>
  )
}

function statusLabel(status: PendenciasProdutorResponse['status_qualidade']): string {
  const labels = {
    dentro_padrao: 'Dentro do padrão',
    fora_padrao: 'Fora do padrão',
    sem_analise: 'Sem análise',
  }

  return labels[status]
}

function formatIssueValue(codigo: string, value: number | null, unit: string | null): string {
  if (value === null) return '--'

  const metricCodes: Record<string, AnalysisMetricField> = {
    gordura: 'GORD',
    proteina: 'PROT',
    lactose: 'LACT',
    solidos_totais: 'SOL',
    ccs: 'CCS',
    ufc: 'UFC',
    caseina: 'CASE',
    sng: 'SNG',
    ureia: 'UREI',
    temperatura: 'TEMP',
  }

  const metric = metricCodes[codigo]
  if (metric) {
    return formatAnalysisMetric(metric, value)
  }

  return `${formatDecimal(value)}${unit ? ` ${unit}` : ''}`
}
