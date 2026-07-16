import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('./ExpedicaoModule.tsx', import.meta.url), 'utf8')

test('ordens abertas e historico sao apresentados separadamente', () => {
  assert.match(source, /const ordensAbertas = useMemo/)
  assert.match(source, /const ordensHistorico = useMemo/)
  assert.match(source, /title="Ordens abertas"/)
  assert.match(source, /title="Histórico"/)
})

test('detalhe da ordem usa rota propria em vez de modal', () => {
  assert.match(source, /function routeFromHash\(\): ExpedicaoRoute/)
  assert.match(source, /function navigateOrder\(id: number\)/)
  assert.match(source, /<OrderDetailPage id=\{route\.orderId\}/)

  const detailPage = source.slice(
    source.indexOf('function OrderDetailPage('),
    source.indexOf('function PalletDetail('),
  )
  assert.ok(detailPage.length > 0, 'A página de detalhe deve existir')
  assert.doesNotMatch(detailPage, /<Modal/)
})

test('ordem em carregamento pode ser cancelada com confirmacao', () => {
  assert.match(source, /OPEN_ORDER_STATUSES = \['rascunho', 'lancada', 'carregando'\]/)
  assert.match(source, /window\.confirm/)
  assert.match(source, /carregamento em andamento/i)
})

test('pagina de detalhe mostra carga, paletes e historico', () => {
  assert.match(source, /Resumo da carga/)
  assert.match(source, /Paletes da ordem/)
  assert.match(source, /Histórico da ordem/)
  assert.match(source, /Dados de entrega/)
})
