import type { Analise } from './qualidadeApi'
import type { PendenciaQualidade, ProdutorRelatorio } from './relatoriosApi'

export type PendenciasProdutorResponse = {
  periodo: {
    inicio: string
    fim: string
    label: string
  }
  produtor: Pick<ProdutorRelatorio, 'codigo' | 'nome' | 'cidade' | 'rota' | 'ativo' | 'novo'>
  ultima_analise: Analise | null
  status_qualidade: ProdutorRelatorio['status_qualidade']
  total_pendencias: number
  pendencias: PendenciaQualidade[]
}

export type ExportacaoDownload = {
  arquivo: string
}

type ApiResponse<T> = {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

const API_BASE = '/api/qualidade/relatorios'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const json = (await response.json()) as ApiResponse<T>
  if (!json.success) {
    throw new Error(json.error?.message ?? 'Resposta inválida')
  }

  return json.data
}

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback
  const match = disposition.match(/filename="?([^"]+)"?/i)
  return match?.[1] ?? fallback
}

async function postDownload(
  path: string,
  body: Record<string, unknown>,
  options: { accept: string; fallback: string; errorMessage: string },
): Promise<ExportacaoDownload> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Accept: options.accept,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const contentType = response.headers.get('Content-Type') ?? ''
  if (!response.ok || contentType.includes('application/json')) {
    const json = contentType.includes('application/json') ? await response.json().catch(() => null) : null
    throw new Error(json?.error?.message ?? options.errorMessage)
  }

  const blob = await response.blob()
  const arquivo = filenameFromDisposition(response.headers.get('Content-Disposition'), options.fallback)
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = arquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)

  return { arquivo }
}

export const pendenciasApi = {
  produtor: (codigo: string) => getJson<PendenciasProdutorResponse>(`/produtores/${encodeURIComponent(codigo)}/pendencias`),
  exportarProdutor: (codigo: string, mes: string) => postDownload(`/exportacoes/produtores/${encodeURIComponent(codigo)}/pendencias`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    fallback: `qualidade_produtor_${codigo}_inconsistencias.xlsx`,
    errorMessage: 'Falha ao gerar planilha de inconsistências do produtor',
  }),
  exportarProdutorPdf: (codigo: string, mes: string) => postDownload(`/exportacoes/produtores/${encodeURIComponent(codigo)}/pendencias/pdf`, { mes }, {
    accept: 'application/pdf, application/json',
    fallback: `qualidade_produtor_${codigo}_inconsistencias.pdf`,
    errorMessage: 'Falha ao gerar PDF de inconsistências do produtor',
  }),
}
