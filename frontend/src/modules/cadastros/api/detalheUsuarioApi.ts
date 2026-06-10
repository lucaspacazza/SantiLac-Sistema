import type { Usuario } from './cadastrosApi'
import { cadastrosGetJson } from './cadastrosHttp'

export async function buscarDetalheUsuario(id: number) {
  const meta = await cadastrosGetJson<{ usuario: Usuario }>('/api/cadastros/usuarios/detalhe', { id: String(id) })
  return meta.usuario
}
