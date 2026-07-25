import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const http = readFileSync(new URL('./api/http.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const drafts = readFileSync(new URL('./shared/durableForms.ts', import.meta.url), 'utf8')

test('all API calls announce an expired authenticated session', () => {
  assert.match(http, /AUTH_EXPIRED_EVENT/)
  assert.match(http, /SESSION_ACTIVITY_EVENT/)
  assert.match(http, /response\.status\s*===\s*401/)
  assert.match(http, /response\.status\s*===\s*419/)
})

test('system and packaging portal check sessions while open and on resume', () => {
  assert.match(app, /SESSION_CHECK_INTERVAL/)
  assert.match(app, /lastSessionActivityRef/)
  assert.match(app, /Date\.now\(\)\s*-\s*lastSessionActivityRef\.current\s*>=\s*sessionTimeoutMs/)
  assert.doesNotMatch(app, /setInterval\(\(\)\s*=>\s*void checkSession/)
  assert.match(app, /visibilitychange/)
  assert.match(app, /ReauthOverlay/)
})

test('forms are snapshotted without passwords and restored after navigation', () => {
  assert.match(drafts, /MutationObserver/)
  assert.match(drafts, /localStorage/)
  assert.match(drafts, /type\s*===\s*['"]password['"]/)
  assert.match(drafts, /restore/)
  assert.match(app, /installDurableForms/)
})

test('a successfully saved form is not recreated as a draft while it unmounts', () => {
  assert.match(
    drafts,
    /boundForms\.set\(form,\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(committedKeys\.has\(key\)\)[\s\S]*?else\s+saveDraft\(form,\s*key\)/,
  )
  assert.match(drafts, /snapshotAll[\s\S]*?if\s*\(committedKeys\.has\(key\)\)\s*return/)
})
