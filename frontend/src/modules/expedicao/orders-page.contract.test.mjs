import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('./ExpedicaoModule.tsx', import.meta.url), 'utf8')

test('ordens abertas e historico sao apresentados separadamente', () => {
  assert.match(source, /const ordensAbertas = useMemo/)
  assert.match(source, /const ordensHistorico = useMemo/)
  assert.match(source, /title="Ordens abertas"/)
  assert.doesNotMatch(source, /canceladas preservadas/i)
  assert.doesNotMatch(source, /cancelada:\s*'Cancelada'/)
  assert.match(source, /title="Histórico"/)
})

test('detalhe da ordem usa rota propria em vez de modal', () => {
  assert.match(source, /function routeFromHash\(\): ExpedicaoRoute/)
  assert.match(source, /path\.match\(\/\^expedicao/)
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
  assert.doesNotMatch(source, /window\.confirm/)
  assert.match(source, /function CancellationDialog/)
  assert.match(source, />Não<\/button>/)
  assert.match(source, /busy \? 'Cancelando\.\.\.' : 'Sim'/)
  assert.match(source, /carregamento em andamento/i)
})

test('pagina de detalhe mostra carga, paletes e historico', () => {
  assert.match(source, /Resumo da carga/)
  assert.match(source, /Paletes da ordem/)
  assert.match(source, /Histórico da ordem/)
  assert.match(source, /Dados de entrega/)
})

test('montagem da carga desenha o estado do palete sem imagem', () => {
  assert.match(source, /function PalletSketch/)
  assert.match(source, /PALLET_ROW_COUNT = 5/)
  assert.match(source, /palete\.status === 'cheio'/)
  assert.match(source, /<PalletSketch palete=\{palete\}/)
  assert.doesNotMatch(source, /<img[^>]+palete/i)
})
