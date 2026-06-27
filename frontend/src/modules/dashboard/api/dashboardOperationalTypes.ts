import type { CombustivelResumo } from '../../combustivel/api/combustivelApi'
import type { EstoqueItem } from '../../estoque/api/estoqueApi'
import type { Overview as ProducaoOverview } from '../../producao/api/producaoApi'
import type { Analise, Overview as QualidadeOverview } from '../../qualidade/api/qualidadeApi'
import type { RotaResumo } from '../../coletas/api/rotasApi'

export type DashboardOperationalData = {
  qualidade: {
    overview: QualidadeOverview | null
    analises: Analise[]
  }
  estoqueBaixo: EstoqueItem[]
  combustivel: CombustivelResumo | null
  rotas: RotaResumo[]
  producao: ProducaoOverview | null
  fontesIndisponiveis: string[]
}

export const emptyOperationalData: DashboardOperationalData = {
  qualidade: {
    overview: null,
    analises: [],
  },
  estoqueBaixo: [],
  combustivel: null,
  rotas: [],
  producao: null,
  fontesIndisponiveis: [],
}
