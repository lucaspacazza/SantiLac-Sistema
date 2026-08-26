export type Caixa = {
  id: number
  sequencia: number
  codigo_barra: string
  peso: number
  palete_id: number
  created_at: string | null
}

export type OrdemDisponivel = {
  id: number
  codigo_ordem: string
  nome: string
  lote: string
  tipo_queijo: string
}

export type Palete = {
  id: number
  numero: number
  caixas: number
  peso_total: number
  status: 'aberto' | 'cheio' | 'finalizado'
}

export type OperacaoEmbalagem = {
  ordem: {
    id: number
    codigo: string
    status_embalagem: string
  }
  lote: {
    id: number
    lote: string
    tipo_queijo: string
    nome_queijo: string
    data_fabricacao: string | null
    data_validade: string | null
    pecas_por_caixa: number
    caixas_por_palete: number
    caixas_total: number
    pecas_total: number
    peso_total: number
    peso_pecas_avulsas: number
    status: 'aberto' | 'finalizado'
  }
  palete_atual: Palete | null
  paletes: Palete[]
  historico: Caixa[]
  barcode: {
    length: number
    product_start: number
    product_length: number
    lot_start: number
    lot_length: number
    weight_start: number
    weight_length: number
    weight_divisor: number
  }
}

export const embalagemApi = {
  ordensDisponiveis() {
    return apiGet<OrdemDisponivel[]>('/api/embalagem/ordens/disponiveis')
  },

  validarOrdem(codigoOrdem: string) {
    return apiPost<OperacaoEmbalagem>('/api/embalagem/ordens/validar', { codigo_ordem: codigoOrdem })
  },

  estado(loteId: number) {
    return apiGet<OperacaoEmbalagem>(`/api/embalagem/lotes/${loteId}`)
  },

  registrarCaixa(scan: OfflineScan) {
    return apiPost<OperacaoEmbalagem>(`/api/embalagem/lotes/${scan.loteId}/caixas`, {
      codigo_barra: scan.codigoBarra,
      device_id: scan.deviceId,
      id_local: scan.id,
    })
  },

  finalizar(loteId: number, pecasAvulsas: number, pesoPecasAvulsas = 0, paleteParcial: 'preencher' | 'finalizar' = 'preencher') {
    return apiPost<OperacaoEmbalagem>(`/api/embalagem/lotes/${loteId}/finalizar`, {
      pecas_avulsas: pecasAvulsas,
      peso_pecas_avulsas: pesoPecasAvulsas,
      palete_parcial: paleteParcial,
    })
  },
}

export type CarregamentoResumo = {
  id: number
  codigo: string
  status: 'lancada' | 'carregando'
  paletes_total: number
  carregados: number
  peso_total: number
}

export type Carregamento = {
  id: number
  codigo: string
  status: 'lancada' | 'carregando' | 'concluida'
  paletes_total: number
  caixas_total: number
  peso_total: number
  produtos: Array<{ produto: string; paletes: number; carregados: number; peso_total: number }>
  paletes: Array<{
    id: number
    numero: number
    produto: string
    lote: string
    caixas: number
    peso_total: number
    status_carregamento: 'reservado' | 'carregado'
  }>
}

export const carregamentoApi = {
  listar: () => apiGet<{ itens: CarregamentoResumo[] }>('/api/expedicao/carregamentos'),
  detalhe: (id: number) => apiGet<Carregamento>(`/api/expedicao/carregamentos/${id}`),
  iniciar: (id: number) => apiPost<Carregamento>(`/api/expedicao/carregamentos/${id}/iniciar`, {}),
  escanear: (id: number, codigo: string) => apiPost<Carregamento>(`/api/expedicao/carregamentos/${id}/escanear`, { codigo }),
  concluir: (id: number) => apiPost<Carregamento>(`/api/expedicao/carregamentos/${id}/concluir`, {}),
}
import { apiGet, apiPost } from '../../../api/http'
import type { OfflineScan } from '../offline/offlineQueue'
