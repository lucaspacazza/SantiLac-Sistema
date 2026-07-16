import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const start = readFileSync(new URL('./views/IniciarEmbalagem.tsx', import.meta.url), 'utf8')
const operation = readFileSync(new URL('./views/OperacaoLote.tsx', import.meta.url), 'utf8')
const loading = readFileSync(new URL('./views/CarregamentoExpedicao.tsx', import.meta.url), 'utf8')

function inputAfter(source, label) {
  const labelStart = source.indexOf(label)
  assert.notEqual(labelStart, -1, `label not found: ${label}`)

  const inputStart = source.indexOf('<input', labelStart)
  const inputEnd = source.indexOf('/>', inputStart)
  assert.notEqual(inputStart, -1, `input not found after: ${label}`)
  assert.notEqual(inputEnd, -1, `input end not found after: ${label}`)

  return source.slice(inputStart, inputEnd + 2)
}

test('does not install global focus recovery that can steal input selection', () => {
  assert.doesNotMatch(app, /focusScanner/)
  assert.doesNotMatch(app, /MutationObserver/)
  assert.doesNotMatch(app, /document\.addEventListener\('pointerdown'/)
  assert.doesNotMatch(app, /Peso manual[\s\S]{0,180}className="control scan-input"/)
})

test('marks only barcode entry fields as scanner targets', () => {
  assert.doesNotMatch(inputAfter(start, 'Código da OP'), /data-scanner-input/)
  assert.match(inputAfter(operation, 'Código da balança'), /data-scanner-input="true"/)
  assert.match(inputAfter(loading, 'Código de barras do palete'), /data-scanner-input="true"/)
  assert.match(inputAfter(app, 'Código da balança'), /data-scanner-input="true"/)
})

test('shows the keyboard for OP and manual fields but hides it only on barcode readers', () => {
  for (const source of [app, start, operation, loading]) {
    assert.doesNotMatch(source, /openScannerKeyboard/)
    assert.doesNotMatch(source, /closeScannerKeyboard/)
  }

  assert.match(inputAfter(start, 'Código da OP'), /inputMode="text"/)
  assert.match(inputAfter(operation, 'Código da balança'), /inputMode="none"/)
  assert.match(inputAfter(app, 'Código da balança'), /inputMode="none"/)
  assert.match(inputAfter(loading, 'Código de barras do palete'), /inputMode="none"/)
  assert.match(inputAfter(app, 'Peso manual'), /inputMode="decimal"/)
  assert.match(inputAfter(operation, 'Peças avulsas'), /type="number"/)
  assert.match(start, /autoFocus/)
  assert.match(operation, /autoFocus/)
  assert.match(loading, /autoFocus/)
})

test('keeps the active scale scanner focused without stealing manual input focus', () => {
  assert.match(operation, /const scannerRef = useRef<HTMLInputElement>\(null\)/)
  assert.match(operation, /ref=\{scannerRef\}/)
  assert.match(operation, /scannerRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(operation, /target\.closest\(interactiveSelector\)/)
  assert.match(operation, /input, textarea, select/)
})
