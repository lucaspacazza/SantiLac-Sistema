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

  assert.match(component, /import\s*\{[^}]*createPortal[^}]*\}\s*from\s*['"]react-dom['"]/)
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
  const logout = app.match(/async function logout\(\) \{[\s\S]*?\n  \}/)?.[0] ?? ''

  assert.match(api, /logout:\s*(?:async\s*)?\(\)\s*=>/)
  assert.match(app, /async function logout/)
  assert.match(app, /authApi\.logout\(\)/)
  assert.match(app, /aria-label="Sair"/)
  assert.match(app, /setAuthState\('guest'\)/)
  assert.match(logout, /setUser\(null\)/)
})

test('forces reauthentication as soon as the server reports an expired session', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8')

  assert.match(api, /AUTH_EXPIRED_EVENT/)
  assert.match(api, /SESSION_ACTIVITY_EVENT/)
  assert.match(api, /response\.status\s*===\s*401/)
  assert.match(api, /response\.status\s*===\s*419/)
  assert.match(app, /lastSessionActivityRef/)
  assert.match(app, /scheduleLocalExpiry/)
  assert.match(app, /window\.setTimeout\(/)
  assert.match(app, /window\.clearTimeout\(/)
  assert.doesNotMatch(app, /SESSION_CHECK_INTERVAL/)
  assert.doesNotMatch(app, /setInterval\(/)
  assert.match(app, /snapshotActiveFormDrafts\(\)/)
  assert.match(app, /visibilitychange/)
  assert.match(app, /ReauthDialog/)
})

test('uses kiosk-safe custom selection instead of the broken native popup', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const select = readFileSync(new URL('./KioskSelect.tsx', import.meta.url), 'utf8')

  assert.match(select, /createPortal/)
  assert.match(select, /onClick=\{openSelect\}/)
  assert.doesNotMatch(select, /onTouchStart=\{openSelect\}/)
  assert.doesNotMatch(select, /onPointerDown=\{openSelect\}/)
  assert.match(select, /dismissSoftKeyboard/)
  assert.match(select, /SantiLacKeyboard/)
  assert.match(select, /\.dismiss\?\.\(\)/)
  assert.doesNotMatch(app, /<Field label="Fosfatase"><select/)
  assert.doesNotMatch(app, /<Field label="Peroxidase"><select/)
})

test('opens the time wheel only after a completed tap so scrolling cannot trigger it', () => {
  const picker = readFileSync(new URL('./TimeWheelPicker.tsx', import.meta.url), 'utf8')
  const trigger = picker.match(/<button\s+className=\{`time-wheel-trigger[\s\S]*?<\/button>/)?.[0] ?? ''

  assert.match(picker, /import\s*\{[^}]*flushSync[^}]*\}\s*from\s*['"]react-dom['"]/)
  assert.match(picker, /SantiLacKeyboard/)
  assert.match(picker, /\.dismiss\?\.\(\)/)
  assert.match(trigger, /onClick=\{handleClick\}/)
  assert.doesNotMatch(trigger, /onTouchStart=/)
  assert.doesNotMatch(trigger, /onPointerDown=/)
  assert.doesNotMatch(picker, /armRetargetedClickGuard/)

  const openPicker = picker.match(/function openPicker\(\) \{[\s\S]*?\n  \}/)?.[0] ?? ''
  assert.match(openPicker, /flushSync\([\s\S]*setOpen\(true\)[\s\S]*\)[\s\S]*dismissSoftKeyboard\(\)/)
})

test('blocks the ghost click and dismisses the keyboard when the operator scrolls a form', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')

  assert.match(app, /movedBeyondTapThreshold/)
  assert.match(app, /onTouchStartCapture=\{trackTouchStart\}/)
  assert.match(app, /onTouchMoveCapture=\{handleTouchMove\}/)
  assert.match(app, /onClickCapture=\{blockClickAfterScroll\}/)
  assert.match(app, /dismissSoftKeyboard\(\)/)
})

test('does not recreate a completed kiosk draft during pagehide cleanup', () => {
  const drafts = readFileSync(new URL('./drafts.ts', import.meta.url), 'utf8')

  assert.match(drafts, /const snapshot = \(\) => \{[\s\S]*?if \(committedDrafts\.has\(key\)\) return/)
  assert.match(drafts, /addEventListener\('pagehide', snapshot\)/)
})

test('snapshots the active PWA form before any module navigation can unmount it', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const drafts = readFileSync(new URL('./drafts.ts', import.meta.url), 'utf8')

  assert.match(drafts, /activeDraftForms/)
  assert.match(drafts, /export function snapshotActiveFormDrafts/)
  assert.match(drafts, /if\s*\(!hydrated\s*&&\s*!dirty\)\s*return/)
  assert.match(app, /function navigateTo/)
  assert.match(app, /snapshotActiveFormDrafts\(\)/)
  assert.match(app, /if\s*\(view\s*===\s*nextView\)\s*return/)
})

test('restores the exact PWA workspace for the same operator after logout or authentication expiry', () => {
  const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const workspace = readFileSync(new URL('./workspace.ts', import.meta.url), 'utf8')

  assert.match(workspace, /saveWorkspaceState/)
  assert.match(workspace, /readWorkspaceState/)
  assert.match(workspace, /userId/)
  assert.match(app, /persistWorkspace/)
  assert.match(app, /resumeWorkspace/)
  assert.match(app, /sameUser/)
  const logout = app.match(/async function logout\(\) \{[\s\S]*?\n  \}/)?.[0] ?? ''
  assert.doesNotMatch(logout, /setView\('inicio'\)/)
  assert.match(logout, /setUser\(null\)/)
  assert.match(app, /authState === 'guest'[\s\S]*ReauthDialog/)
})

test('all kiosk choices use the opaque custom list and can never open a native select popup', () => {
  const select = readFileSync(new URL('./KioskSelect.tsx', import.meta.url), 'utf8')
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
  const dialogRule = styles.match(/\.kiosk-select-dialog\s*\{[^}]+\}/s)?.[0] ?? ''
  const optionsRule = styles.match(/\.kiosk-select-options\s*\{[^}]+\}/s)?.[0] ?? ''
  const optionButtonRule = styles.match(/\.kiosk-select-options button\s*\{[^}]+\}/s)?.[0] ?? ''

  assert.doesNotMatch(select, /<select\b/)
  assert.match(select, /type="hidden"/)
  assert.match(dialogRule, /background-color:\s*#[0-9a-f]{6}/i)
  assert.match(dialogRule, /isolation:\s*isolate/)
  assert.match(optionsRule, /background-color:\s*#[0-9a-f]{6}/i)
  assert.match(optionButtonRule, /background-color:\s*#[0-9a-f]{6}/i)
  assert.doesNotMatch(optionButtonRule, /background(?:-color)?:\s*transparent/)
})
