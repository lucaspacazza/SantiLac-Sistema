import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const carregamento = readFileSync(new URL('./views/CarregamentoExpedicao.tsx', import.meta.url), 'utf8')

function sectionBetween(start, end) {
  const startIndex = app.indexOf(start)
  const endIndex = app.indexOf(end, startIndex)
  assert.notEqual(startIndex, -1, `section not found: ${start}`)
  assert.notEqual(endIndex, -1, `section end not found: ${end}`)
  return app.slice(startIndex, endIndex)
}

test('returns to OP entry after successfully finalizing a lot', () => {
  const finalization = sectionBetween('async function finalizar(', 'function solicitarFinalizacao()')

  assert.match(finalization, /setOperacao\(null\)/)
  assert.match(finalization, /operacaoRef\.current = null/)
  assert.match(finalization, /setCodigoOrdem\(''\)/)
  assert.match(finalization, /OP finalizada\. Digite uma nova OP\./)
  assert.doesNotMatch(finalization, /setOperacao\(data\)/)
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
