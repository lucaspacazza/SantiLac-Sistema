import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPendingScan,
  summarizeOfflineScans,
  synchronizePendingScans,
  type OfflineScan,
  type OfflineScanRepository,
} from './offline/offlineQueue.ts'

const deviceId = 'ef1d0d52-099d-4e0c-ac8e-7aecdfa00da6'

test('creates a durable scan with the same id used later during synchronization', () => {
  const scan = createPendingScan({
    id: '0597a7df-962e-4438-b759-0239dc71ab4d',
    deviceId,
    loteId: 194,
    codigoBarra: '2000100004586',
    capturedAt: 100,
  })

  assert.deepEqual(scan, {
    id: '0597a7df-962e-4438-b759-0239dc71ab4d',
    deviceId,
    loteId: 194,
    codigoBarra: '2000100004586',
    capturedAt: 100,
    status: 'pending',
    attempts: 0,
    lastError: null,
  })
})

test('synchronizes pending scans in capture order and removes only confirmed records', async () => {
  const repository = memoryRepository([
    scan('second', 200),
    scan('first', 100),
  ])
  const sent: string[] = []

  const result = await synchronizePendingScans(repository, async (item) => {
    sent.push(item.id)
    return { loteId: item.loteId, scanId: item.id }
  })

  assert.deepEqual(sent, ['first', 'second'])
  assert.deepEqual(repository.removed, ['first', 'second'])
  assert.deepEqual(result, { confirmed: 2, rejected: 0, paused: false, lastResult: { loteId: 194, scanId: 'second' } })
})

test('keeps a scan pending and pauses the queue after a retryable connection failure', async () => {
  const repository = memoryRepository([scan('first', 100), scan('second', 200)])
  const sent: string[] = []
  const retryable = Object.assign(new Error('Servidor indisponível'), { status: 503 })

  const result = await synchronizePendingScans(repository, async (item) => {
    sent.push(item.id)
    throw retryable
  })

  assert.deepEqual(sent, ['first'])
  assert.deepEqual(repository.removed, [])
  assert.deepEqual(repository.rejected, [])
  assert.equal(repository.attempted[0]?.id, 'first')
  assert.deepEqual(result, { confirmed: 0, rejected: 0, paused: true, lastResult: null })
})

test('records a definitive rejection and continues synchronizing later boxes', async () => {
  const repository = memoryRepository([scan('wrong', 100), scan('valid', 200)])
  const rejected = Object.assign(new Error('Código não pertence à OP.'), { status: 422 })

  const result = await synchronizePendingScans(repository, async (item) => {
    if (item.id === 'wrong') throw rejected
    return { scanId: item.id }
  })

  assert.deepEqual(repository.rejected, [{ id: 'wrong', message: 'Código não pertence à OP.' }])
  assert.deepEqual(repository.removed, ['valid'])
  assert.deepEqual(result, { confirmed: 1, rejected: 1, paused: false, lastResult: { scanId: 'valid' } })
})

test('summarizes pending and rejected scans without counting another lot', () => {
  const records = [
    scan('pending', 100),
    { ...scan('rejected', 200), status: 'rejected' as const },
    { ...scan('another-lot', 300), loteId: 195 },
  ]

  assert.deepEqual(summarizeOfflineScans(records, 194), { pending: 1, rejected: 1, total: 2 })
})

function scan(id: string, capturedAt: number): OfflineScan {
  return createPendingScan({ id, deviceId, loteId: 194, codigoBarra: `code-${id}`, capturedAt })
}

function memoryRepository(initial: OfflineScan[]): OfflineScanRepository & {
  attempted: Array<{ id: string; message: string }>
  rejected: Array<{ id: string; message: string }>
  removed: string[]
} {
  const records = [...initial]
  const attempted: Array<{ id: string; message: string }> = []
  const rejected: Array<{ id: string; message: string }> = []
  const removed: string[] = []

  return {
    attempted,
    rejected,
    removed,
    list: async () => [...records],
    markAttempt: async (id, message) => { attempted.push({ id, message }) },
    markRejected: async (id, message) => { rejected.push({ id, message }) },
    remove: async (id) => { removed.push(id) },
  }
}
