import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const http = readFileSync(new URL('./api/http.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const drafts = readFileSync(new URL('./shared/durableForms.ts', import.meta.url), 'utf8')
const expedition = readFileSync(new URL('./modules/expedicao/ExpedicaoModule.tsx', import.meta.url), 'utf8')

test('all API calls announce an expired authenticated session', () => {
  assert.match(http, /AUTH_EXPIRED_EVENT/)
  assert.match(http, /SESSION_ACTIVITY_EVENT/)
  assert.match(http, /response\.status\s*===\s*401/)
  assert.match(http, /response\.status\s*===\s*419/)
})

test('system and packaging portal check sessions while open and on resume', () => {
  assert.match(app, /lastSessionActivityRef/)
  assert.match(app, /scheduleLocalExpiry/)
  assert.match(app, /window\.setTimeout\(/)
  assert.match(app, /window\.clearTimeout\(/)
  assert.doesNotMatch(app, /SESSION_CHECK_INTERVAL/)
  assert.doesNotMatch(app, /setInterval\(/)
  assert.match(app, /visibilitychange/)
  assert.match(app, /ReauthOverlay/)
})

test('every form control is snapshotted before navigation and restored after remount', () => {
  assert.match(drafts, /MutationObserver/)
  assert.match(drafts, /localStorage/)
  assert.match(drafts, /type\s*!==\s*['"]password['"]/)
  assert.match(drafts, /controlIndex/)
  assert.match(drafts, /snapshotAllDurableForms/)
  assert.match(drafts, /addEventListener\('pointerdown', snapshotBeforeNavigation, true\)/)
  assert.match(drafts, /requestAnimationFrame/)
  assert.match(drafts, /missingControls/)
  assert.match(app, /installDurableForms/)
})

test('a successfully saved form is not recreated as a draft while it unmounts', () => {
  assert.match(drafts, /committedKeys\.has\(key\)/)
  assert.match(drafts, /snapshotAll[\s\S]*?if\s*\(committedKeys\.has\(key\)\)\s*return/)
})

test('mounting or immediately leaving a form cannot overwrite an older draft with blank values', () => {
  assert.match(drafts, /hydrated/)
  assert.match(drafts, /dirty/)
  assert.match(drafts, /restoring/)
  assert.match(drafts, /if\s*\(!hydrated\s*&&\s*!dirty\)\s*return/)
  assert.doesNotMatch(drafts, /MAX_AGE/)
})

test('session expiry snapshots work immediately and returns the same user to the same route', () => {
  assert.match(app, /snapshotAllDurableForms\(\)/)
  assert.match(app, /rememberSystemWorkspace/)
  assert.match(app, /restoreSystemWorkspace/)
  assert.match(app, /resumingExpiredSession/)
  assert.match(app, /sameUser/)
  const logout = app.match(/async function handleLogout\(\) \{[\s\S]*?\n  \}/)?.[0] ?? ''
  assert.doesNotMatch(logout, /setUser\(null\)/)
  assert.match(app, /state === 'guest'[\s\S]*ReauthOverlay/)
})

test('the expedition load builder is a durable form, including its review step and pallet choices', () => {
  assert.match(expedition, /data-draft-key=\{`expedicao:ordem:/)
  assert.match(expedition, /name="__draft_step"/)
  assert.match(expedition, /name="palete_id"/)
  assert.match(expedition, /name="cliente"/)
  assert.match(expedition, /type="submit"/)
})
