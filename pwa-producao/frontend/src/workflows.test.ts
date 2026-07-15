import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PRODUCTION_WORKFLOWS } from './workflows.ts'

test('exposes every operational workflow from the production module', () => {
  assert.deepEqual(
    PRODUCTION_WORKFLOWS.map(({ id }) => id),
    ['ordens', 'queijo', 'soro', 'formulacao-creme', 'producao-creme'],
  )
})

test('keeps every workflow label short enough for a tablet navigation rail', () => {
  for (const workflow of PRODUCTION_WORKFLOWS) {
    assert.ok(workflow.shortLabel.length <= 12, `${workflow.id} has a long rail label`)
  }
})

test('forces the factory shell to update instead of reusing a stale WebView worker', () => {
  const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
  const bootstrap = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')

  assert.match(serviceWorker, /cache:\s*['"]no-store['"]/)
  assert.match(serviceWorker, /SKIP_WAITING/)
  assert.match(bootstrap, /registration\.update\(\)/)
  assert.match(bootstrap, /controllerchange/)
})

test('centers the selected time band on the active wheel row', () => {
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
  const selectionRule = styles.match(/\.time-wheel-selection\s*\{[^}]+\}/s)?.[0] ?? ''

  assert.match(selectionRule, /transform:\s*translateY\(-50%\)/)
})

test('renders the time dialog outside the form label so action buttons remain clickable', () => {
  const component = readFileSync(new URL('./TimeWheelPicker.tsx', import.meta.url), 'utf8')

  assert.match(component, /import\s*\{\s*createPortal\s*\}\s*from\s*['"]react-dom['"]/)
  assert.match(component, /createPortal\([\s\S]+document\.body/)
})

test('does not feed wheel selection changes back into programmatic scrolling', () => {
  const component = readFileSync(new URL('./TimeWheelPicker.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(component, /useEffect\(\(\) => \{[\s\S]*?scrollTo\([\s\S]*?\}, \[selectedIndex\]\)/)
  assert.match(component, /scrollCommitRef/)
  assert.match(component, /window\.setTimeout\(commitScrolledValue/)
})

test('normalizes a saved time before the hidden form field can submit it', () => {
  const component = readFileSync(new URL('./TimeWheelPicker.tsx', import.meta.url), 'utf8')

  assert.match(component, /useState\(\(\) => normalizeTimeValue\(defaultValue\)\)/)
})

test('lets the operator open and finalize an existing production order', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(app, /OpenOrderList[\s\S]+onOpen=/)
  assert.match(app, /Finalizar OP/)
  assert.match(api, /finalizarOrdemProducao/)
})

test('lets the operator cancel an open production order with confirmation', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(app, /Cancelar OP/)
  assert.match(app, /window\.confirm/)
  assert.match(api, /cancelarOrdemProducao/)
})

test('guards production order saving against repeated submissions', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.match(app, /orderSavingRef/)
  assert.match(app, /busy=\{state === 'saving'\}/)
})
