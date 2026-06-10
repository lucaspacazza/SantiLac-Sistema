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
  amostras: (coletaId: number, canal = 'Todos') =>
    apiGet<Amostra[]>(`/api/pasteurizador/coletas/${coletaId}/amostras?canal=${encodeURIComponent(canal)}&limit=20000`),
  amostrasPeriodo: (inicio = '', fim = '', horaInicio = '', horaFim = '', canal = 'Todos') =>
    apiGet<Amostra[]>(`/api/pasteurizador/amostras?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}&hora_inicio=${encodeURIComponent(horaInicio)}&hora_fim=${encodeURIComponent(horaFim)}&canal=${encodeURIComponent(canal)}&limit=50000`),
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
