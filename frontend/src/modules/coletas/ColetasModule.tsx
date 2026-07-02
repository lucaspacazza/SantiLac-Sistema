import 'leaflet/dist/leaflet.css'
import './coletas.css'
import { useEffect, useMemo, useState } from 'react'
import { ColetaDetalheRota } from './views/Rotas/ColetaDetalheRota'
import { ColetasRota } from './views/Rotas/ColetasRota'
import { DetalheRota } from './views/Rotas/DetalheRota'
import { LeiteInicio } from './views/Inicio/LeiteInicio'
import { ListagemRotas } from './views/Rotas/ListagemRotas'
import { MapaRota } from './views/Rotas/MapaRota'

type View =
  | { name: 'inicio' }
  | { name: 'rotas' }
  | { name: 'detalhe'; uuid: string }
  | { name: 'mapa'; uuid: string }
  | { name: 'coletas'; uuid: string }
  | { name: 'coleta'; uuid: string; id: number }

function parseRoute(): View {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const offset = parts[0] === 'coletas' ? 1 : 0
  const section = parts[offset]
  const uuid = parts[offset + 1]
  const action = parts[offset + 2]
  const actionId = parts[offset + 3]

  if (section === 'rotas' && uuid && action === 'coletas' && actionId) {
    const id = Number.parseInt(actionId, 10)
    if (Number.isFinite(id) && id > 0) return { name: 'coleta', uuid: decodeURIComponent(uuid), id }
  }

  if (section === 'rotas' && uuid && action === 'mapa') return { name: 'mapa', uuid: decodeURIComponent(uuid) }
  if (section === 'rotas' && uuid && action === 'coletas') return { name: 'coletas', uuid: decodeURIComponent(uuid) }
  if (section === 'rotas' && uuid) return { name: 'detalhe', uuid: decodeURIComponent(uuid) }
  if (section === 'rotas') return { name: 'rotas' }

  return { name: 'inicio' }
}

function routeTitle(view: View) {
  if (view.name === 'inicio') return 'Leite'
  if (view.name === 'rotas') return 'Rotas'
  if (view.name === 'detalhe') return 'Detalhe da rota'
  if (view.name === 'mapa') return 'Mapa da rota'
  if (view.name === 'coletas') return 'Coletas da rota'
  return 'Detalhe da coleta'
}

export function ColetasModule() {
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
    <div className="coletas-module">
      {view.name === 'inicio' && <LeiteInicio />}
      {view.name === 'rotas' && <ListagemRotas onOpen={(uuid) => navigate(`#/coletas/rotas/${encodeURIComponent(uuid)}`)} />}
      {view.name === 'detalhe' && (
        <DetalheRota
          uuid={view.uuid}
          onBack={() => navigate('#/coletas/rotas')}
          onOpenMapa={() => navigate(`#/coletas/rotas/${encodeURIComponent(view.uuid)}/mapa`)}
          onOpenColetas={() => navigate(`#/coletas/rotas/${encodeURIComponent(view.uuid)}/coletas`)}
        />
      )}
      {view.name === 'mapa' && (
        <MapaRota
          uuid={view.uuid}
          onBack={() => navigate(`#/coletas/rotas/${encodeURIComponent(view.uuid)}`)}
          onOpenColetas={() => navigate(`#/coletas/rotas/${encodeURIComponent(view.uuid)}/coletas`)}
        />
      )}
      {view.name === 'coletas' && (
        <ColetasRota
          uuid={view.uuid}
          onBack={() => navigate(`#/coletas/rotas/${encodeURIComponent(view.uuid)}`)}
          onOpenMapa={() => navigate(`#/coletas/rotas/${encodeURIComponent(view.uuid)}/mapa`)}
          onOpenColeta={(id) => navigate(`#/coletas/rotas/${encodeURIComponent(view.uuid)}/coletas/${id}`)}
        />
      )}
      {view.name === 'coleta' && (
        <ColetaDetalheRota
          id={view.id}
          onBack={() => navigate(`#/coletas/rotas/${encodeURIComponent(view.uuid)}/coletas`)}
          onOpenColeta={(id) => navigate(`#/coletas/rotas/${encodeURIComponent(view.uuid)}/coletas/${id}`)}
        />
      )}
    </div>
  )
}
