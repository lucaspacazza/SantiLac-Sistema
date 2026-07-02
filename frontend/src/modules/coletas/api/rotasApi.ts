import { apiGet } from '../../../api/http'

export type RotaResumo = {
  uuid: string
  id_referencia: number
  rota_nome: string
  motorista_nome: string
  caminhao_nome: string
  placa: string
  inicio: string
  fim: string | null
  km_ini: number | null
  km_fim: number | null
  status_codigo: number
  status_label: string
  total_litros: number
  total_coletas: number
  total_pontos_gps: number
  km_rodado: number | null
  distancia_gps_km?: number
  total_paradas: number
  tempo_parado_seg: number
  tempo_movimento_seg: number
  velocidade_media_kmh: number
  velocidade_maxima_kmh: number
}

export type GpsPonto = {
  ts: string
  lat: number
  lng: number
  segment?: number
  speed_mps: number | null
  accuracy_m: number | null
  low_accuracy: boolean
}

export type GpsParada = {
  inicio_ts: string
  fim_ts: string
  duracao_seg: number
  lat: number
  lng: number
}

export type ColetaRota = {
  id: number
  produtor_codigo: string
  produtor_nome: string
  litros: number
  temperatura: number | null
  tanque: number | null
  usuario: string
  device_id: string
  datahora: string
  ponto_lat: number | null
  ponto_lng: number | null
  ponto_accuracy_m: number | null
  ponto_captured_at?: string | null
  rota_uuid?: string | null
  rota_nome?: string | null
  observacoes: string | null
}

export type RotasFiltro = {
  q?: string
  status?: string
  inicio?: string
  fim?: string
}

export type LeiteResumoMes = {
  mes: string
  litros: number
  coletas: number
}

export type LeiteResumoMensal = {
  mes_atual: LeiteResumoMes
  mes_anterior: LeiteResumoMes
  serie: LeiteResumoMes[]
}

function buildUrl(path: string, params?: Record<string, string | undefined>) {
  const url = new URL(path, window.location.origin)
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value?.trim()) url.searchParams.set(key, value.trim())
  })
  return `${url.pathname}${url.search}`
}

export const rotasApi = {
  async resumoMensal() {
    return apiGet<LeiteResumoMensal>('/api/gestao/coletas/resumo-mensal')
  },

  async listar(filtros: RotasFiltro) {
    const meta = await apiGet<{ rotas: RotaResumo[] }>(buildUrl('/api/gestao/rotas', filtros))
    return meta.rotas
  },

  async detalhe(uuid: string) {
    return apiGet<{ rota: RotaResumo; gps: GpsPonto[]; paradas: GpsParada[] }>(buildUrl('/api/gestao/rotas/detalhe', { uuid }))
  },

  async coletas(uuid: string) {
    return apiGet<{ rota: RotaResumo; coletas: ColetaRota[] }>(buildUrl('/api/gestao/rotas/coletas', { uuid }))
  },

  async coletaDetalhe(id: number) {
    return apiGet<{ coleta: ColetaRota; ultimas_coletas: ColetaRota[] }>(buildUrl('/api/gestao/coletas/detalhe', { id: String(id) }))
  },
}
