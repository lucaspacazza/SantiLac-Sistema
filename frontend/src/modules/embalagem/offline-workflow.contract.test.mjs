import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const operation = readFileSync(new URL('./views/OperacaoLote.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('./api/embalagemApi.ts', import.meta.url), 'utf8')
const queue = readFileSync(new URL('./offline/offlineQueue.ts', import.meta.url), 'utf8')
const rootApp = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8')
const serviceWorker = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8')
const main = readFileSync(new URL('../../main.tsx', import.meta.url), 'utf8')
const vite = readFileSync(new URL('../../../vite.config.ts', import.meta.url), 'utf8')

test('persists every complete barcode before attempting server synchronization', () => {
  assert.match(app, /saveOfflineScans/)
  assert.match(app, /syncOfflineScans/)
  const persistence = app.slice(app.indexOf('async function persistirCodigosCompletos'), app.indexOf('async function finalizar'))
  assert.ok(persistence.indexOf('await saveOfflineScans') < persistence.indexOf('void syncOfflineScans'))
  assert.match(queue, /indexedDB\.open/)
  assert.doesNotMatch(queue, /localStorage.*codigoBarra|codigoBarra.*localStorage/)
})

test('automatically retries the durable queue when connectivity returns or the app resumes', () => {
  assert.match(app, /addEventListener\('online'/)
  assert.match(app, /visibilitychange/)
  assert.match(app, /syncOfflineScans/)
})

test('shows confirmed and local pending counts without disabling the scanner', () => {
  assert.match(operation, /Aguardando envio|Pendente|Sincronizar/)
  assert.match(operation, /offlinePending/)
  assert.match(operation, /offlineRejected/)
  const scanner = operation.slice(operation.indexOf('data-scanner-input'), operation.indexOf('/>', operation.indexOf('data-scanner-input')))
  assert.doesNotMatch(scanner, /offlinePending|offlineRejected|sincronizando/)
})

test('cannot finalize a lot while local scans are unresolved', () => {
  const finalization = app.slice(app.indexOf('function solicitarFinalizacao'), app.indexOf('function continuarFinalizacao'))
  assert.match(finalization, /offlineSummary\.total/)
  assert.match(finalization, /sincroniza/i)
  assert.match(operation, /offlinePending \+ offlineRejected/)
})

test('sends stable device and local ids so retries are idempotent', () => {
  assert.match(api, /device_id:\s*scan\.deviceId/)
  assert.match(api, /id_local:\s*scan\.id/)
})

test('restores cached user and operation data when the tablet boots offline', () => {
  assert.match(rootApp, /readCachedPackagingUser/)
  assert.match(rootApp, /writeCachedPackagingUser/)
  assert.match(app, /readCachedOperation/)
  assert.match(app, /readCachedOrders/)
})

test('service worker precaches the generated asset manifest for a real offline start', () => {
  assert.match(vite, /manifest:\s*['"]asset-manifest\.json['"]/)
  assert.match(serviceWorker, /asset-manifest\.json/)
  assert.match(serviceWorker, /cache\.put/)
  assert.match(main, /sw\.js\?v=4/)
})
