import { useCallback, useEffect, useState } from 'react'
import { combustivelApi, type CombustivelResumo } from '../../combustivel/api/combustivelApi'
import { estoqueApi, type Overview as EstoqueOverview } from '../../estoque/api/estoqueApi'
import { expedicaoApi, type Resumo as ExpedicaoResumo } from '../../expedicao/api/expedicaoApi'
import { pasteurizadorApi, type Overview as PasteurizadorOverview } from '../../pasteurizador/api/pasteurizadorApi'
import { producaoApi, type Overview as ProducaoOverview } from '../../producao/api/producaoApi'
import { qualidadeApi, type Overview as QualidadeOverview } from '../../qualidade/api/qualidadeApi'
import { leiteIndicadorApi, type LeiteIndicador } from '../api/leiteIndicadorApi'
import { produtoresIndicadorApi } from '../api/produtoresIndicadorApi'

export type DataState<T> = {
  loading: boolean
  data: T | null
  failed: boolean
}

const initialState = <T,>(): DataState<T> => ({ loading: true, data: null, failed: false })

export function useDashboardOverview() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [produtores, setProdutores] = useState<DataState<number>>(initialState)
  const [leite, setLeite] = useState<DataState<LeiteIndicador>>(initialState)
  const [qualidade, setQualidade] = useState<DataState<QualidadeOverview>>(initialState)
  const [estoque, setEstoque] = useState<DataState<EstoqueOverview>>(initialState)
  const [expedicao, setExpedicao] = useState<DataState<ExpedicaoResumo>>(initialState)
  const [combustivel, setCombustivel] = useState<DataState<CombustivelResumo>>(initialState)
  const [producao, setProducao] = useState<DataState<ProducaoOverview>>(initialState)
  const [pasteurizador, setPasteurizador] = useState<DataState<PasteurizadorOverview>>(initialState)

  useEffect(() => {
    const controller = new AbortController()

    const requests = [
      loadSource(
        produtoresIndicadorApi.buscar({ signal: controller.signal }).then((response) => response.total),
        setProdutores,
        controller.signal,
      ),
      loadSource(leiteIndicadorApi.buscar({ signal: controller.signal }), setLeite, controller.signal),
      loadSource(qualidadeApi.overview(), setQualidade, controller.signal),
      loadSource(estoqueApi.overview(), setEstoque, controller.signal),
      loadSource(expedicaoApi.resumo(), setExpedicao, controller.signal),
      loadSource(combustivelApi.resumo(), setCombustivel, controller.signal),
      loadSource(producaoApi.overview(), setProducao, controller.signal),
      loadSource(pasteurizadorApi.overview(), setPasteurizador, controller.signal),
    ]

    void Promise.allSettled(requests).then(() => {
      if (!controller.signal.aborted) setUpdatedAt(new Date())
    })

    return () => controller.abort()
  }, [refreshKey])

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
    updatedAt,
    refreshing: [produtores, leite, qualidade, estoque, expedicao, combustivel, producao, pasteurizador]
      .some((source) => source.loading),
    refresh,
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
