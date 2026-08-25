import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const inicio = readFileSync(new URL('./views/IniciarEmbalagem.tsx', import.meta.url), 'utf8')
const carregamento = readFileSync(new URL('./views/CarregamentoExpedicao.tsx', import.meta.url), 'utf8')
const operacao = readFileSync(new URL('./views/OperacaoLote.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

function sectionBetween(start, end) {
  const startIndex = app.indexOf(start)
  const endIndex = app.indexOf(end, startIndex)
  assert.notEqual(startIndex, -1, `section not found: ${start}`)
  assert.notEqual(endIndex, -1, `section end not found: ${end}`)
  return app.slice(startIndex, endIndex)
}

test('returns to the available OP list after successfully finalizing a lot', () => {
  const finalization = sectionBetween('async function finalizar(', 'function solicitarFinalizacao()')

  assert.match(finalization, /setOperacao\(null\)/)
  assert.match(finalization, /operacaoRef\.current = null/)
  assert.match(finalization, /await carregarOrdensDisponiveis\(\)/)
  assert.doesNotMatch(finalization, /setCodigoOrdem/)
  assert.doesNotMatch(finalization, /setOperacao\(data\)/)
})

test('loads and renders selectable OPs with name, lot and cheese type', () => {
  assert.match(app, /embalagemApi\.ordensDisponiveis\(\)/)
  assert.match(inicio, />Nome</)
  assert.match(inicio, />Lote</)
  assert.match(inicio, />Tipo de queijo</)
  assert.match(inicio, /ordens\.map\(\(ordem\) =>/)
  assert.match(inicio, /onClick=\{\(\) => onSelecionar\(ordem\)\}/)
  assert.doesNotMatch(inicio, /<input\b|<form\b/)
})

test('allows dismissing the partial pallet decision without changing the pallet', () => {
  const modal = sectionBetween("{operacao && modalPaleteParcialAberto", '</main>')

  assert.match(modal, />\s*Cancelar\s*<\/button>/)
  assert.match(modal, /onClick=\{\(\) => setModalPaleteParcialAberto\(false\)\}/)
})

test('loading flow asks for the pallet barcode instead of a QR Code', () => {
  assert.match(carregamento, /import \{[^\n]*Barcode[^\n]*\} from 'lucide-react'/)
  assert.match(carregamento, /C[oó]digo de barras do palete/)
  assert.match(carregamento, /leitura dos c[oó]digos de barras/i)
  assert.doesNotMatch(carregamento, /QrCode|QR Codes?/i)
})

test('loading reads the live scanner field value before sending the pallet barcode', () => {
  assert.match(carregamento, /scannerRef\.current\?\.value/)
  assert.match(carregamento, /carregamentoApi\.escanear\(ordem\.id, codigoLido\)/)
})

test('operation notices are five-second non-blocking toasts and do not announce OP validation', () => {
  assert.match(app, /operation-toast/)
  assert.match(app, /window\.setTimeout\([\s\S]*?,\s*5000\)/)
  assert.doesNotMatch(app, /OP validada\./)
  assert.match(styles, /\.operation-toast\s*\{[\s\S]*?position:\s*fixed;/)
  assert.match(styles, /\.operation-toast\s*\{[\s\S]*?pointer-events:\s*none;/)
})

test('scanner remains enabled while a box is being saved or a notice is visible', () => {
  const scanner = operacao.match(/<input[\s\S]*?data-scanner-input="true"[\s\S]*?\/>/)?.[0] ?? ''

  assert.notEqual(scanner, '')
  assert.doesNotMatch(scanner, /processando|disabled=\{status/)
  assert.match(operacao, /disabled=\{operacao\.lote\.status === 'finalizado'\}/)
  assert.doesNotMatch(operacao, /disabled=\{processando\}/)
})

test('packaging header keeps navigation and user actions on the same row', () => {
  assert.match(styles, /\.packaging-topbar\s*\{[\s\S]*?display:\s*grid;/)
  assert.match(styles, /\.packaging-topbar\s*\{[\s\S]*?grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)\s+auto;/)
  assert.doesNotMatch(styles, /\.packaging-user\s*\{[\s\S]{0,160}?width:\s*100%;/)
})
