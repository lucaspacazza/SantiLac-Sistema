import { apiGet, type ApiGetOptions } from '../../../api/http'

export type ProducaoIndicador = {
  formulacoes_queijo: number
  ops_aguardando_formato: number
  rascunhos: number
}

export const producaoIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<ProducaoIndicador>('/api/dashboard/producao', options)
  },
}
