import { apiGet, apiPost } from '../../../api/http'

export type Overview = {
  totais: {
    coletas: number
    amostras: number
    canais: number
  }
  ultima_coleta: Coleta | null
  canais: Array<{
    canal: string
    unidade: string | null
  }>
}

export type Coleta = {
  id: number
  equipamento: string
  origem: string
  arquivo_remoto: string
  coletado_em: string | null
  bytes_baixados: number
  total_amostras: number
  status: 'rascunho' | 'processada' | 'erro'
  mensagem_erro: string | null
  ingestion_key?: string | null
  period_start?: string | null
  period_end?: string | null
  raw_sha256?: string | null
}

export type Amostra = {
  sample_index: number
  timestamp_registro: string | null
  canal: string
  valor: number
  unidade: string | null
  qualidade: number | null
  raw_offset: number | null
}

export type Paginated<T> = {
  items: T[]
  pagination: {
    current_page: number
    per_page: number
    total: number
  }
}

export type SerieCanalMeta = {
  canal: string
  total: number
  minimo: number
  maximo: number
  media: number
}

export type SerieAmostrasMeta = {
  source_total: number
  returned: number
  max_points: number
  reduced: boolean
  truncated: false
  first_timestamp: string | null
  last_timestamp: string | null
  channels: SerieCanalMeta[]
}

export type SerieAmostras = {
  items: Amostra[]
  meta: SerieAmostrasMeta
}

export type CoberturaSerie = {
  coverage_contract_version: 2
  coverage_basis: 'processed_period_full_day'
  series_start_date: string | null
  last_sample_timestamp: string | null
  last_sample_date: string | null
  covered_dates: string[]
  coverage_start: string | null
  coverage_end: string | null
  observed_dates: string[]
  observed_start: string | null
  observed_end: string | null
  observed_first_timestamp: string | null
  observed_last_timestamp: string | null
  uncertified_observed_dates: string[]
}

export type ColetaAgoraResult = {
  ok: boolean
  processor_url: string
  response: unknown
}

export const pasteurizadorApi = {
  overview: () => apiGet<Overview>('/api/pasteurizador/overview'),
  coletas: (inicio = '', fim = '', horaInicio = '', horaFim = '', page = 1, perPage = 20) =>
    apiGet<Paginated<Coleta>>(`/api/pasteurizador/coletas?page=${page}&per_page=${perPage}&inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}&hora_inicio=${encodeURIComponent(horaInicio)}&hora_fim=${encodeURIComponent(horaFim)}`),
  coleta: (id: number) => apiGet<Coleta>(`/api/pasteurizador/coletas/${id}`),
  amostras: (coletaId: number, canal = 'Todos', signal?: AbortSignal) =>
    apiGet<Amostra[]>(
      `/api/pasteurizador/coletas/${coletaId}/amostras?canal=${encodeURIComponent(canal)}&limit=20000`,
      { signal, timeoutMs: 60000, retries: 2 },
    ),
  amostrasPeriodo: (inicio = '', fim = '', horaInicio = '', horaFim = '', canal = 'Todos', signal?: AbortSignal) =>
    apiGet<SerieAmostras>(
      `/api/pasteurizador/amostras?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}&hora_inicio=${encodeURIComponent(horaInicio)}&hora_fim=${encodeURIComponent(horaFim)}&canal=${encodeURIComponent(canal)}&limit=12000&with_meta=1`,
      { signal, timeoutMs: 120000, retries: 2, retryDelayMs: 750 },
    ),
  cobertura: (inicio: string, fim: string, signal?: AbortSignal) =>
    apiGet<CoberturaSerie>(
      `/api/pasteurizador/cobertura?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`,
      { signal, timeoutMs: 30000, retries: 2, retryDelayMs: 500 },
    ),
  coletarAgora: (inicio: string, fim: string, horaInicio = '00:00:00', horaFim = '23:59:59') =>
    apiPost<ColetaAgoraResult>('/api/pasteurizador/coletar-agora', {
      inicio,
      fim,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
    }),
  exportCsvUrl: (coletaId: number, canal = 'Temp.Pasteuriza') =>
    `/api/pasteurizador/coletas/${coletaId}/exportar.csv?canal=${encodeURIComponent(canal)}`,
  exportCsvPeriodoUrl: (inicio = '', fim = '', horaInicio = '', horaFim = '', canal = 'Todos') =>
    `/api/pasteurizador/amostras/exportar.csv?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}&hora_inicio=${encodeURIComponent(horaInicio)}&hora_fim=${encodeURIComponent(horaFim)}&canal=${encodeURIComponent(canal)}`,
  exportPdfPeriodoUrl: (inicio = '', fim = '', horaInicio = '', horaFim = '', canal = 'Todos') =>
    `/api/pasteurizador/amostras/exportar.pdf?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}&hora_inicio=${encodeURIComponent(horaInicio)}&hora_fim=${encodeURIComponent(horaFim)}&canal=${encodeURIComponent(canal)}`,
}
