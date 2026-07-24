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

test('closes the soft keyboard and moves focus away from inputs before showing the time wheel', () => {
  const component = readFileSync(new URL('./TimeWheelPicker.tsx', import.meta.url), 'utf8')

  assert.match(component, /document\.activeElement/)
  assert.match(component, /activeElement\.blur\(\)/)
  assert.match(component, /dialogRef\.current\?\.focus\(\{\s*preventScroll:\s*true\s*\}\)/)
  assert.match(component, /tabIndex=\{-1\}/)
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

test('lets the operator delete an open production order with custom confirmation', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(app, /Cancelar OP/)
  assert.doesNotMatch(app, /window\.confirm/)
  assert.match(app, /function ConfirmationDialog/)
  assert.match(app, /\{request\.cancelLabel\}/)
  assert.match(app, /\{request\.confirmLabel\}/)
  assert.match(api, /cancelarOrdemProducao/)
})

test('guards production order saving against repeated submissions', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.match(app, /orderSavingRef/)
  assert.match(app, /busy=\{state === 'saving'\}/)
})

test('lets the operator edit a saved draft production order', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(app, /Salvar alterações/)
  assert.match(app, /activeOrder\.status !== 'rascunho'/)
  assert.match(app, /Salve as alterações antes de finalizar/)
  assert.match(api, /atualizarOrdemProducao/)
})

test('lets the operator cancel a saved cheese formulation', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(app, /Cancelar formulação/)
  assert.match(api, /cancelarFormulacaoQueijo/)
})

test('asks with a custom yes-or-no dialog before generating the production order', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(app, /Gerar OP automaticamente/)
  assert.match(app, /await askConfirmation/)
  assert.match(app, /confirmLabel: 'Sim'/)
  assert.match(app, /cancelLabel: 'N\u00e3o'/)
  assert.match(api, /gerarOpFormulacaoQueijo/)
})

test('lets the operator choose the mozzarella format and manually finalize its daily order', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(app, /Formato da mussarela/)
  assert.match(app, /Finalizar OP/)
  assert.match(api, /definirFormatoOrdemProducao/)
})

test('lets the operator end the current PWA session', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(api, /logout:\s*(?:async\s*)?\(\)\s*=>/)
  assert.match(app, /async function logout/)
  assert.match(app, /authApi\.logout\(\)/)
  assert.match(app, /aria-label="Sair"/)
  assert.match(app, /setAuthState\('guest'\)/)
})

test('forces reauthentication as soon as the server reports an expired session', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(api, /AUTH_EXPIRED_EVENT/)
  assert.match(api, /SESSION_ACTIVITY_EVENT/)
  assert.match(api, /response\.status\s*===\s*401/)
  assert.match(api, /response\.status\s*===\s*419/)
  assert.match(app, /SESSION_CHECK_INTERVAL/)
  assert.match(app, /lastSessionActivityRef/)
  assert.match(app, /Date\.now\(\)\s*-\s*lastSessionActivityRef\.current\s*>=\s*sessionTimeoutMs/)
  assert.doesNotMatch(app, /setInterval\(\(\)\s*=>\s*void checkSession/)
  assert.match(app, /visibilitychange/)
  assert.match(app, /ReauthDialog/)
})

test('uses kiosk-safe custom selection instead of the broken native popup', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const select = readFileSync(new URL('./KioskSelect.tsx', import.meta.url), 'utf8')

  assert.match(select, /createPortal/)
  assert.match(select, /onPointerDown/)
  assert.match(select, /dismissSoftKeyboard/)
  assert.doesNotMatch(app, /<Field label="Fosfatase"><select/)
  assert.doesNotMatch(app, /<Field label="Peroxidase"><select/)
})

test('opens the time wheel during pointer down so keyboard dismissal cannot cancel it', () => {
  const picker = readFileSync(new URL('./TimeWheelPicker.tsx', import.meta.url), 'utf8')

  assert.match(picker, /function handlePointerDown/)
  assert.match(picker, /event\.preventDefault\(\)/)
  assert.match(picker, /openPicker\(\)/)
})

test('does not recreate a completed kiosk draft during pagehide cleanup', () => {
  const drafts = readFileSync(new URL('./drafts.ts', import.meta.url), 'utf8')

  assert.match(drafts, /const snapshot = \(\) => \{[\s\S]*?if \(committedDrafts\.has\(key\)\) return/)
  assert.match(drafts, /addEventListener\('pagehide', snapshot\)/)
})
