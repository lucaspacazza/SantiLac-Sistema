import './cadastros.css'
import { useEffect, useMemo, useState } from 'react'
import { DetalheMotorista } from './views/Cadastros/DetalheMotorista'
import { DetalheProdutor } from './views/Cadastros/DetalheProdutor'
import { DetalheUsuario } from './views/Cadastros/DetalheUsuario'
import { ListagemMotoristas } from './views/Cadastros/ListagemMotoristas'
import { ListagemProdutores } from './views/Cadastros/ListagemProdutores'
import { ListagemUsuarios } from './views/Cadastros/ListagemUsuarios'
import { MotoristaForm } from './views/Cadastros/MotoristaForm'
import { ProdutorForm } from './views/Cadastros/ProdutorForm'
import { UsuarioForm } from './views/Cadastros/UsuarioForm'

type View =
  | { name: 'usuarios' }
  | { name: 'usuario-detail'; id: number }
  | { name: 'usuario-form'; id?: number }
  | { name: 'produtores' }
  | { name: 'produtor-detail'; id: number }
  | { name: 'produtor-form'; id?: number }
  | { name: 'motoristas' }
  | { name: 'motorista-detail'; id: number }
  | { name: 'motorista-form'; id?: number }

function parseId(value: string | undefined) {
  const id = Number.parseInt(value ?? '', 10)
  return Number.isFinite(id) && id > 0 ? id : undefined
}

function parseRoute(): View {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const offset = parts[0] === 'cadastros' ? 1 : 0
  const submodule = parts[offset]
  const idOrAction = parts[offset + 1]
  const action = parts[offset + 2]

  if (submodule === 'produtores') {
    if (idOrAction === 'novo') return { name: 'produtor-form' }
    if (idOrAction && action === 'editar') return { name: 'produtor-form', id: parseId(idOrAction) }
    if (parseId(idOrAction)) return { name: 'produtor-detail', id: parseId(idOrAction) as number }
    return { name: 'produtores' }
  }

  if (submodule === 'motoristas') {
    if (idOrAction === 'novo') return { name: 'motorista-form' }
    if (idOrAction && action === 'editar') return { name: 'motorista-form', id: parseId(idOrAction) }
    if (parseId(idOrAction)) return { name: 'motorista-detail', id: parseId(idOrAction) as number }
    return { name: 'motoristas' }
  }

  if (idOrAction === 'novo') return { name: 'usuario-form' }
  if (idOrAction && action === 'editar') return { name: 'usuario-form', id: parseId(idOrAction) }
  if (parseId(idOrAction)) return { name: 'usuario-detail', id: parseId(idOrAction) as number }
  return { name: 'usuarios' }
}

function routeTitle(view: View) {
  if (view.name === 'usuarios') return 'Usuários'
  if (view.name === 'usuario-detail') return 'Detalhe do usuário'
  if (view.name === 'usuario-form') return view.id ? 'Editar usuário' : 'Novo usuário'
  if (view.name === 'produtores') return 'Produtores'
  if (view.name === 'produtor-detail') return 'Detalhe do produtor'
  if (view.name === 'produtor-form') return view.id ? 'Editar produtor' : 'Novo produtor'
  if (view.name === 'motoristas') return 'Motoristas'
  if (view.name === 'motorista-detail') return 'Detalhe do motorista'
  return view.id ? 'Editar motorista' : 'Novo motorista'
}

export function CadastrosModule() {
  const [view, setView] = useState<View>(() => parseRoute())
  const title = useMemo(() => routeTitle(view), [view])

  useEffect(() => {
    const handleHashChange = () => setView(parseRoute())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    document.title = `Santi'Lac | ${title}`
  }, [title])

  function navigate(next: string) {
    window.location.hash = next
  }

  return (
    <div className="cadastros-module">
      {view.name === 'usuarios' && <ListagemUsuarios onCreate={() => navigate('#/cadastros/usuarios/novo')} onOpen={(id) => navigate(`#/cadastros/usuarios/${id}`)} onEdit={(id) => navigate(`#/cadastros/usuarios/${id}/editar`)} />}
      {view.name === 'usuario-detail' && <DetalheUsuario id={view.id} onBack={() => navigate('#/cadastros/usuarios')} onEdit={(id) => navigate(`#/cadastros/usuarios/${id}/editar`)} />}
      {view.name === 'usuario-form' && <UsuarioForm id={view.id} onBack={() => navigate('#/cadastros/usuarios')} onSaved={() => navigate('#/cadastros/usuarios')} />}
      {view.name === 'produtores' && <ListagemProdutores onCreate={() => navigate('#/cadastros/produtores/novo')} onOpen={(id) => navigate(`#/cadastros/produtores/${id}`)} onEdit={(id) => navigate(`#/cadastros/produtores/${id}/editar`)} />}
      {view.name === 'produtor-detail' && <DetalheProdutor id={view.id} onBack={() => navigate('#/cadastros/produtores')} onEdit={(id) => navigate(`#/cadastros/produtores/${id}/editar`)} />}
      {view.name === 'produtor-form' && <ProdutorForm id={view.id} onBack={() => navigate('#/cadastros/produtores')} onSaved={() => navigate('#/cadastros/produtores')} />}
      {view.name === 'motoristas' && <ListagemMotoristas onCreate={() => navigate('#/cadastros/motoristas/novo')} onOpen={(id) => navigate(`#/cadastros/motoristas/${id}`)} onEdit={(id) => navigate(`#/cadastros/motoristas/${id}/editar`)} />}
      {view.name === 'motorista-detail' && <DetalheMotorista id={view.id} onBack={() => navigate('#/cadastros/motoristas')} onEdit={(id) => navigate(`#/cadastros/motoristas/${id}/editar`)} />}
      {view.name === 'motorista-form' && <MotoristaForm id={view.id} onBack={() => navigate('#/cadastros/motoristas')} onSaved={() => navigate('#/cadastros/motoristas')} />}
    </div>
  )
}
