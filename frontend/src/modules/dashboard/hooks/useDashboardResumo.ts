import { useEffect, useState } from 'react'
import { combustivelApi } from '../../combustivel/api/combustivelApi'
import { rotasApi } from '../../coletas/api/rotasApi'
import { estoqueApi } from '../../estoque/api/estoqueApi'
import { producaoApi } from '../../producao/api/producaoApi'
import { qualidadeApi } from '../../qualidade/api/qualidadeApi'
import { emptyOperationalData, type DashboardOperationalData } from '../api/dashboardOperationalTypes'
import { carregarDashboardResumo } from '../api/dashboardResumoApi'
import type { DashboardResumoSnapshot } from '../api/dashboardResumoTypes'
import { formatDateTime } from '../shared/formatters'
import { parseData, parseView } from '../shared/navigation'
import type { DashboardView } from '../shared/navigation'

export function useDashboardResumo() {
  const [view, setView] = useState<DashboardView>(() => parseView())
  const [data, setData] = useState(() => parseData())
  const [snapshot, setSnapshot] = useState<DashboardResumoSnapshot | null>(null)
  const [operacional, setOperacional] = useState<DashboardOperationalData>(emptyOperationalData)
  const [status, setStatus] = useState('Carregando dados reais...')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  async function carregar(nextData = data) {
    setErro(null)
    setStatus('Carregando dados reais...')
    setCarregando(true)

    try {
      const payload = await carregarDashboardResumo(nextData)
      const dataReferencia = payload.data
      const fontes = await Promise.allSettled([
        qualidadeApi.overview(),
        qualidadeApi.analises(),
        estoqueApi.overview(),
        combustivelApi.resumo(),
        rotasApi.listar({ inicio: dataReferencia, fim: dataReferencia }),
        producaoApi.overview(),
      ] as const)
      const nomes = ['qualidade', 'análises', 'estoque', 'combustível', 'rotas', 'produção']
      const indisponiveis = fontes
        .map((resultado, index) => resultado.status === 'rejected' ? nomes[index] : null)
        .filter((nome): nome is string => Boolean(nome))

      setSnapshot(payload)
      setData(payload.data)
      setOperacional({
        qualidade: {
          overview: fontes[0].status === 'fulfilled' ? fontes[0].value : null,
          analises: fontes[1].status === 'fulfilled' ? fontes[1].value.items : [],
        },
        estoqueBaixo: fontes[2].status === 'fulfilled' ? fontes[2].value.alertas.baixo_estoque : [],
        combustivel: fontes[3].status === 'fulfilled' ? fontes[3].value : null,
        rotas: fontes[4].status === 'fulfilled' ? fontes[4].value : [],
        producao: fontes[5].status === 'fulfilled' ? fontes[5].value : null,
        fontesIndisponiveis: indisponiveis,
      })
      setStatus(`${formatDateTime(payload.gerado_em)}${indisponiveis.length ? ` · ${indisponiveis.length} fonte(s) indisponível(is)` : ''}`)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar a dashboard.')
      setStatus('Erro ao carregar')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    const onHashChange = () => {
      const nextView = parseView()
      const nextData = parseData()
      setView(nextView)
      if (nextData && nextData !== data) {
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
    operacional,
    status,
    erro,
    carregando,
    setData,
    carregar,
  }
}
