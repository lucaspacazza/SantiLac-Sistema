export type Caixa = {
  id: number
  sequencia: number
  codigo_barra: string
  peso: number
  palete_id: number
  created_at: string | null
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? 'Não foi possível concluir a operação.')
  }

  return payload.data as T
}

export const embalagemApi = {
  validarOrdem(codigoOrdem: string) {
    return request<OperacaoEmbalagem>('/api/embalagem/ordens/validar', {
      method: 'POST',
      body: JSON.stringify({ codigo_ordem: codigoOrdem }),
    })
  },

  estado(loteId: number) {
    return request<OperacaoEmbalagem>(`/api/embalagem/lotes/${loteId}`)
  },

  registrarCaixa(loteId: number, codigoBarra: string) {
    return request<OperacaoEmbalagem>(`/api/embalagem/lotes/${loteId}/caixas`, {
      method: 'POST',
      body: JSON.stringify({ codigo_barra: codigoBarra }),
    })
  },

  finalizar(loteId: number, pecasAvulsas: number, pesoPecasAvulsas = 0) {
    return request<OperacaoEmbalagem>(`/api/embalagem/lotes/${loteId}/finalizar`, {
      method: 'POST',
      body: JSON.stringify({ pecas_avulsas: pecasAvulsas, peso_pecas_avulsas: pesoPecasAvulsas }),
    })
  },
}
