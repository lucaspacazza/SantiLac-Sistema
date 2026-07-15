import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const start = readFileSync(new URL('./views/IniciarEmbalagem.tsx', import.meta.url), 'utf8')
const operation = readFileSync(new URL('./views/OperacaoLote.tsx', import.meta.url), 'utf8')

test('keeps manual piece and weight inputs outside scanner focus recovery', () => {
  assert.match(app, /input\[data-scanner-input="true"\]:not\(:disabled\)/)
  assert.match(app, /input:not\(\[data-scanner-input="true"\]\):not\(:disabled\)/)
  assert.doesNotMatch(app, /Peso manual[\s\S]{0,180}className="control scan-input"/)
})

test('marks only barcode entry fields as scanner targets', () => {
  assert.match(start, /data-scanner-input="true"/)
  assert.match(operation, /data-scanner-input="true"/)
  assert.match(app, /C.digo da balan.a[\s\S]{0,260}data-scanner-input="true"/)
})

test('prefers the scanner inside an open modal over the scanner behind it', () => {
  assert.match(app, /modalScanner\s*=\s*scanners\.find\(\(input\)\s*=>\s*input\.closest\('\[role="dialog"\]'\)\)/)
  assert.match(app, /return modalScanner \?\? scanners\[0\]/)
})

test('suspends scanner focus as soon as the operator presses a manual field', () => {
  assert.match(app, /let manualEditing = false/)
  assert.match(app, /const handlePointerDown = \(event: PointerEvent\)/)
  assert.match(app, /manualEditing = Boolean\(target instanceof HTMLElement && target\.closest\(editableSelector\)\)/)
  assert.match(app, /document\.addEventListener\('pointerdown', handlePointerDown, true\)/)
  assert.match(app, /if \(manualEditing\) return/)
})
