import { useCallback, useEffect, useState } from 'react'
import { combustivelIndicadorApi, type CombustivelIndicador } from '../api/combustivelIndicadorApi'
import { estoqueIndicadorApi, type EstoqueIndicador } from '../api/estoqueIndicadorApi'
import { expedicaoIndicadorApi, type ExpedicaoIndicador } from '../api/expedicaoIndicadorApi'
import { leiteIndicadorApi, type LeiteIndicador } from '../api/leiteIndicadorApi'
import { pasteurizadorIndicadorApi, type PasteurizadorIndicador } from '../api/pasteurizadorIndicadorApi'
import { producaoIndicadorApi, type ProducaoIndicador } from '../api/producaoIndicadorApi'
import { produtoresIndicadorApi } from '../api/produtoresIndicadorApi'
import { qualidadeIndicadorApi, type QualidadeIndicador } from '../api/qualidadeIndicadorApi'
import { quickDashboardDateRange, type DashboardDateRange } from '../api/dashboardDateRangeApi'

export type DataState<T> = {
  loading: boolean
  data: T | null
  failed: boolean
}

const initialState = <T,>(): DataState<T> => ({ loading: true, data: null, failed: false })

export function useDashboardOverview() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [dateRange, setDateRangeState] = useState<DashboardDateRange>(() => quickDashboardDateRange(7))
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [produtores, setProdutores] = useState<DataState<number>>(initialState)
  const [leite, setLeite] = useState<DataState<LeiteIndicador>>(initialState)
  const [qualidade, setQualidade] = useState<DataState<QualidadeIndicador>>(initialState)
  const [estoque, setEstoque] = useState<DataState<EstoqueIndicador>>(initialState)
  const [expedicao, setExpedicao] = useState<DataState<ExpedicaoIndicador>>(initialState)
  const [combustivel, setCombustivel] = useState<DataState<CombustivelIndicador>>(initialState)
  const [producao, setProducao] = useState<DataState<ProducaoIndicador>>(initialState)
  const [pasteurizador, setPasteurizador] = useState<DataState<PasteurizadorIndicador>>(initialState)

  useEffect(() => {
    const controller = new AbortController()

    const requests = [
      loadSource(
        produtoresIndicadorApi.buscar({ signal: controller.signal }).then((response) => response.total),
        setProdutores,
        controller.signal,
      ),
      loadSource(leiteIndicadorApi.buscar(dateRange, { signal: controller.signal }), setLeite, controller.signal),
      loadSource(qualidadeIndicadorApi.buscar(dateRange, { signal: controller.signal }), setQualidade, controller.signal),
      loadSource(estoqueIndicadorApi.buscar({ signal: controller.signal }), setEstoque, controller.signal),
      loadSource(expedicaoIndicadorApi.buscar(dateRange, { signal: controller.signal }), setExpedicao, controller.signal),
      loadSource(combustivelIndicadorApi.buscar({ signal: controller.signal }), setCombustivel, controller.signal),
      loadSource(producaoIndicadorApi.buscar(dateRange, { signal: controller.signal }), setProducao, controller.signal),
      loadSource(pasteurizadorIndicadorApi.buscar(dateRange, { signal: controller.signal }), setPasteurizador, controller.signal),
    ]

    void Promise.allSettled(requests).then(() => {
      if (!controller.signal.aborted) setUpdatedAt(new Date())
    })

    return () => controller.abort()
  }, [dateRange, refreshKey])

  const setDateRange = useCallback((range: DashboardDateRange) => {
    setLeite((state) => ({ ...state, loading: true, failed: false }))
    setQualidade((state) => ({ ...state, loading: true, failed: false }))
    setExpedicao((state) => ({ ...state, loading: true, failed: false }))
    setProducao((state) => ({ ...state, loading: true, failed: false }))
    setPasteurizador((state) => ({ ...state, loading: true, failed: false }))
    setDateRangeState(range)
  }, [])

  const refresh = useCallback(() => {
    setProdutores((state) => ({ ...state, loading: true, failed: false }))
    setLeite((state) => ({ ...state, loading: true, failed: false }))
    setQualidade((state) => ({ ...state, loading: true, failed: false }))
    setEstoque((state) => ({ ...state, loading: true, failed: false }))
    setExpedicao((state) => ({ ...state, loading: true, failed: false }))
    setCombustivel((state) => ({ ...state, loading: true, failed: false }))
    setProducao((state) => ({ ...state, loading: true, failed: false }))
    setPasteurizador((state) => ({ ...state, loading: true, failed: false }))
    setRefreshKey((value) => value + 1)
  }, [])

  return {
    produtores,
    leite,
    qualidade,
    estoque,
    expedicao,
    combustivel,
    producao,
    pasteurizador,
    dateRange,
    updatedAt,
    refreshing: [produtores, leite, qualidade, estoque, expedicao, combustivel, producao, pasteurizador]
      .some((source) => source.loading),
    refresh,
    setDateRange,
  }
}

async function loadSource<T>(
  request: Promise<T>,
  setState: (state: DataState<T>) => void,
  signal: AbortSignal,
) {
  try {
    const data = await request
    if (!signal.aborted) setState({ loading: false, data, failed: false })
  } catch {
    if (!signal.aborted) setState({ loading: false, data: null, failed: true })
  }
}
