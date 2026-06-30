export type DashboardResumoSnapshot = {
  data: string
  gerado_em: string
  rotas: {
    home: string
    resumo_diario: string
    coletas: string
    producao: string
    pasteurizador: string
    estoque: string
  }
  homeResumo: {
    coletas: ColetasResumo
    producao: ProducaoResumo
    pasteurizador: PasteurizadorResumo
    estoque: EstoqueResumo
    pendencias: PendenciaResumo[]
  }
  resumoDiario: {
    data: string
    coletas: ColetasDiaResumo
    producao: ProducaoDiaResumo
    pasteurizador: PasteurizadorResumo
    estoque: EstoqueResumo
    pendencias: PendenciaResumo[]
  }
}

export type ColetasResumo = {
  ultima_data: string | null
  litros: number
  coletas: number
  serie: Array<{
    data: string
    litros: number
    coletas: number
  }>
}

export type ColetasDiaResumo = {
  data: string
  litros: number
  coletas: number
}

export type ProducaoResumo = {
  ultima_data: string | null
  litros: number
  lotes: LoteProducao[]
}

export type ProducaoDiaResumo = {
  data: string
  litros: number
  total_lotes: number
  lotes: LoteProducao[]
}

export type LoteProducao = {
  id: number
  tipo: string
  lote: string
  litros: number
  status: string
  data: string | null
}

export type PasteurizadorResumo = {
  data: string
  canal: string
  total_pontos: number
  media: number | null
  minima: number | null
  maxima: number | null
  pontos: Array<{
    timestamp: string | null
    valor: number
  }>
  filtro: {
    inicio: string
    fim: string
    hora_inicio: string
    hora_fim: string
    canal: string
  }
}

export type EstoqueResumo = {
  itens: number
  ativos: number
  abaixo_minimo: number
  categorias: Array<{
    categoria: string
    itens: number
    saldo: number
  }>
}

export type PendenciaResumo = {
  tipo: string
  nivel: string
  texto: string
}
