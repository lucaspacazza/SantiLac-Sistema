import { useEffect, useState } from 'react'
import { carregarDashboardResumo } from '../api/dashboardResumoApi'
import type { DashboardResumoSnapshot } from '../api/dashboardResumoTypes'
import { formatDateTime } from '../shared/formatters'
import { parseData, parseView } from '../shared/navigation'
import type { DashboardView } from '../shared/navigation'

export function useDashboardResumo() {
  const [view, setView] = useState<DashboardView>(() => parseView())
  const [data, setData] = useState(() => parseData())
  const [snapshot, setSnapshot] = useState<DashboardResumoSnapshot | null>(null)
  const [status, setStatus] = useState('Carregando dados reais...')
  const [erro, setErro] = useState<string | null>(null)

  async function carregar(nextData = data) {
    setErro(null)
    setStatus('Carregando dados reais...')

    try {
      const payload = await carregarDashboardResumo(nextData)
      setSnapshot(payload)
      setData(payload.data)
      setStatus(`Atualizado em ${formatDateTime(payload.gerado_em)}`)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar a dashboard.')
      setStatus('Erro ao carregar')
    }
  }

  useEffect(() => {
    const onHashChange = () => {
      const nextView = parseView()
      const nextData = parseData()
      setView(nextView)
      if (nextData) {
        setData(nextData)
        void carregar(nextData)
      }
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [data])

  useEffect(() => {
    void carregar(data)
  }, [])

  return {
    view,
    data,
    snapshot,
    status,
    erro,
    setData,
    carregar,
  }
}
