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

test('detalhe do palete abre imediatamente com a quantidade de caixas do estoque', () => {
  assert.match(source, /setSelected\(item\)/)
  assert.match(source, /function PalletDetail\(\{ palete/)
  assert.match(source, /label="Caixas"\s+value=\{integer\(palete\.caixas\)\}/)
})

test('conteudo pesado do palete usa endpoint e cache separados', () => {
  const api = readFileSync(new URL('./api/expedicaoApi.ts', import.meta.url), 'utf8')

  assert.match(api, /paleteConteudo/)
  assert.match(api, /palletContentCache/)
  assert.match(api, /\/conteudo/)
})

test('formatadores numericos nunca exibem NaN', () => {
  assert.match(source, /Number\.isFinite/)
  assert.doesNotMatch(source, /function integer\(value: number\) \{ return Number\(value \|\| 0\)/)
})

test('montagem da carga desenha o estado do palete sem imagem', () => {
  assert.match(source, /function PalletSketch/)
  assert.match(source, /PALLET_ROW_COUNT = 5/)
  assert.match(source, /palete\.status === 'cheio'/)
  assert.match(source, /<PalletSketch palete=\{palete\}/)
  assert.doesNotMatch(source, /<img[^>]+palete/i)
})
