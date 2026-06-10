import type { Motorista } from './cadastrosApi'
import { cadastrosGetJson } from './cadastrosHttp'

export async function buscarDetalheMotorista(id: number) {
  const meta = await cadastrosGetJson<{ motorista: Motorista }>('/api/cadastros/motoristas/detalhe', { id: String(id) })
  return meta.motorista
}
