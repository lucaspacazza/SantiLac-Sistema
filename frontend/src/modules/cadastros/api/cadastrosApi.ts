import { apiGet, apiPost } from '../../../api/http'

export type Usuario = {
  id: number
  codigo: string
  nome: string
  usuario: string
  nivel: string
  admin: number
  ativo: number
  ultimo_login: string | null
  criado_em: string
  adm_app: number
  app_coletas: number
}

export type Produtor = {
  id: number
  codigo: string
  nome: string
  cidade: string
  rota: string
  diario: number
  endereco: string | null
  cep: string | null
  cpf_cnpj: string | null
  celular: string | null
  ativo: number
  novo: number
  data_cadastro: string | null
  data_inativacao: string | null
  projeto: number
}

export type Motorista = {
  id: number
  nome: string
  ativo: number
}

type FiltrosCadastro = {
  q?: string
  status?: string
  rota?: string
}

type CurrentUserResponse = {
  user: {
    admin?: boolean | number
  } | null
}

export type UsuarioPayload = {
  id?: number
  codigo: string
  nome: string
  usuario: string
  senha?: string
  nivel: string
  admin: boolean
  ativo: boolean
  adm_app: boolean
  app_coletas: boolean
}

export type ProdutorPayload = {
  id?: number
  codigo: string
  nome: string
  cidade: string
  rota: string
  diario: boolean
  endereco?: string
  cep?: string
  cpf_cnpj?: string
  celular?: string
  ativo: boolean
  novo: boolean
  projeto: boolean
}

export type MotoristaPayload = {
  id?: number
  nome: string
  ativo: boolean
}

function buildUrl(path: string, params?: Record<string, string | undefined>) {
  const url = new URL(path, window.location.origin)
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value?.trim()) url.searchParams.set(key, value.trim())
  })
  return `${url.pathname}${url.search}`
}

async function getJson<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  return apiGet<T>(buildUrl(path, params))
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return apiPost<T>(buildUrl(path), body as Record<string, unknown>)
}

export async function usuarioAtualEhAdmin() {
  const data = await apiGet<CurrentUserResponse>('/api/auth/me').catch(() => null)
  return data?.user?.admin === true || data?.user?.admin === 1
}

export const cadastrosApi = {
  async listarUsuarios(filtros: FiltrosCadastro) {
    const meta = await getJson<{ usuarios: Usuario[] }>('/api/cadastros/usuarios', filtros)
    return meta.usuarios
  },
  async usuario(id: number) {
    const meta = await getJson<{ usuario: Usuario }>('/api/cadastros/usuarios/detalhe', { id: String(id) })
    return meta.usuario
  },
  async criarUsuario(payload: UsuarioPayload) {
    const meta = await postJson<{ usuario: Usuario }>('/api/cadastros/usuarios/criar', payload)
    return meta.usuario
  },
  async editarUsuario(payload: UsuarioPayload) {
    const meta = await postJson<{ usuario: Usuario }>('/api/cadastros/usuarios/editar', payload)
    return meta.usuario
  },
  async inativarUsuario(id: number) {
    const meta = await postJson<{ usuario: Usuario }>('/api/cadastros/usuarios/inativar', { id })
    return meta.usuario
  },

  async listarProdutores(filtros: FiltrosCadastro) {
    const meta = await getJson<{ produtores: Produtor[] }>('/api/cadastros/produtores', filtros)
    return meta.produtores
  },
  async produtor(id: number) {
    const meta = await getJson<{ produtor: Produtor }>('/api/cadastros/produtores/detalhe', { id: String(id) })
    return meta.produtor
  },
  async criarProdutor(payload: ProdutorPayload) {
    const meta = await postJson<{ produtor: Produtor }>('/api/cadastros/produtores/criar', payload)
    return meta.produtor
  },
  async editarProdutor(payload: ProdutorPayload) {
    const meta = await postJson<{ produtor: Produtor }>('/api/cadastros/produtores/editar', payload)
    return meta.produtor
  },
  async inativarProdutor(id: number) {
    const meta = await postJson<{ produtor: Produtor }>('/api/cadastros/produtores/inativar', { id })
    return meta.produtor
  },

  async listarMotoristas(filtros: FiltrosCadastro) {
    const meta = await getJson<{ motoristas: Motorista[] }>('/api/cadastros/motoristas', filtros)
    return meta.motoristas
  },
  async motorista(id: number) {
    const meta = await getJson<{ motorista: Motorista }>('/api/cadastros/motoristas/detalhe', { id: String(id) })
    return meta.motorista
  },
  async criarMotorista(payload: MotoristaPayload) {
    const meta = await postJson<{ motorista: Motorista }>('/api/cadastros/motoristas/criar', payload)
    return meta.motorista
  },
  async editarMotorista(payload: MotoristaPayload) {
    const meta = await postJson<{ motorista: Motorista }>('/api/cadastros/motoristas/editar', payload)
    return meta.motorista
  },
  async inativarMotorista(id: number) {
    const meta = await postJson<{ motorista: Motorista }>('/api/cadastros/motoristas/inativar', { id })
    return meta.motorista
  },
}
