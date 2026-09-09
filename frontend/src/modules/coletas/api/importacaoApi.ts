import { apiPostFile } from '../../../api/http'

export type ColetasImportacaoSummary = {
  arquivo: string
  arquivo_hash: string | null
  ja_importado: boolean
  paginas: number
  registros_lidos: number
  registros_criados: number
  registros_ignorados: number
  produtores_criados: number
  litros_lidos: number
  litros_importados: number
  data_inicio: string
  data_fim: string
}

export type ColetasImportacaoResult = {
  success: boolean
  summary: ColetasImportacaoSummary
  warnings: Array<{ code: string; message: string }>
  errors: Array<{ code: string; message: string }>
}

export const importacaoApi = {
  importar(file: File) {
    return apiPostFile<ColetasImportacaoResult>('/api/gestao/coletas/importacoes', 'arquivo', file)
  },
}
