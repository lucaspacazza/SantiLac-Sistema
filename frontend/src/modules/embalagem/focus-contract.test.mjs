import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const start = readFileSync(new URL('./views/IniciarEmbalagem.tsx', import.meta.url), 'utf8')
const operation = readFileSync(new URL('./views/OperacaoLote.tsx', import.meta.url), 'utf8')
const loading = readFileSync(new URL('./views/CarregamentoExpedicao.tsx', import.meta.url), 'utf8')
const keyboard = readFileSync(new URL('./scannerKeyboard.ts', import.meta.url), 'utf8')

test('treats every manually selected form field as protected from scanner focus recovery', () => {
  assert.match(app, /input\[data-scanner-input="true"\]:not\(:disabled\)/)
  assert.match(app, /const editableSelector = 'input:not\(:disabled\), textarea:not\(:disabled\), select:not\(:disabled\), \[contenteditable="true"\]'/)
  assert.doesNotMatch(app, /input:not\(\[data-scanner-input="true"\]\)/)
  assert.doesNotMatch(app, /Peso manual[\s\S]{0,180}className="control scan-input"/)
})

test('marks only barcode entry fields as scanner targets', () => {
  assert.match(start, /data-scanner-input="true"/)
  assert.match(operation, /data-scanner-input="true"/)
  assert.match(loading, /data-scanner-input="true"/)
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

test('reopens the soft keyboard when an already focused scanner field is touched', () => {
  assert.match(keyboard, /input\.inputMode = inputMode/)
  assert.match(keyboard, /if \(document\.activeElement !== input\) return/)
  assert.match(keyboard, /input\.dataset\.scannerKeyboardReopening = 'true'/)
  assert.match(keyboard, /input\.blur\(\)/)
  assert.match(keyboard, /delete input\.dataset\.scannerKeyboardReopening/)
  assert.match(keyboard, /input\.focus\(\{ preventScroll: true \}\)/)
  assert.match(keyboard, /if \(input\.dataset\.scannerKeyboardReopening === 'true'\) return/)
  assert.match(keyboard, /input\.inputMode = 'none'/)

  for (const source of [app, start, operation, loading]) {
    assert.match(source, /openScannerKeyboard/)
    assert.match(source, /closeScannerKeyboard/)
  }
})
