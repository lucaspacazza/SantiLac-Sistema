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
