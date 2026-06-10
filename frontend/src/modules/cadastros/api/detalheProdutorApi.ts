import type { Produtor } from './cadastrosApi'
import { cadastrosGetJson } from './cadastrosHttp'

export async function buscarDetalheProdutor(id: number) {
  const meta = await cadastrosGetJson<{ produtor: Produtor }>('/api/cadastros/produtores/detalhe', { id: String(id) })
  return meta.produtor
}
