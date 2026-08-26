import type { OperacaoEmbalagem, OrdemDisponivel } from '../api/embalagemApi'

const DATABASE_NAME = 'santilac-embalagem-offline'
const DATABASE_VERSION = 1
const SCANS_STORE = 'scans'
const CACHE_STORE = 'cache'
const DEVICE_ID_KEY = 'embalagem-device-id'
const ORDERS_CACHE_KEY = 'orders'

export type OfflineScanStatus = 'pending' | 'rejected'

export type OfflineScan = {
  id: string
  deviceId: string
  loteId: number
  codigoBarra: string
  capturedAt: number
  status: OfflineScanStatus
  attempts: number
  lastError: string | null
}

export type OfflineScanSummary = {
  pending: number
  rejected: number
  total: number
}

export type OfflineScanRepository = {
  list: () => Promise<OfflineScan[]>
  markAttempt: (id: string, message: string) => Promise<void>
  markRejected: (id: string, message: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export type OfflineSyncResult<T> = {
  confirmed: number
  rejected: number
  paused: boolean
  lastResult: T | null
}

type CacheRecord<T> = {
  key: string
  value: T
  updatedAt: number
}

type CreatePendingScanInput = {
  id?: string
  deviceId: string
  loteId: number
  codigoBarra: string
  capturedAt?: number
}

let databasePromise: Promise<IDBDatabase> | null = null

export const indexedDbOfflineScanRepository: OfflineScanRepository = {
  list: listOfflineScans,
  markAttempt: (id, message) => updateOfflineScan(id, (scan) => ({
    ...scan,
    attempts: scan.attempts + 1,
    lastError: message,
  })),
  markRejected: (id, message) => updateOfflineScan(id, (scan) => ({
    ...scan,
    status: 'rejected',
    attempts: scan.attempts + 1,
    lastError: message,
  })),
  remove: removeOfflineScan,
}

export function createPendingScan(input: CreatePendingScanInput): OfflineScan {
  return {
    id: input.id ?? createUuid(),
    deviceId: input.deviceId,
    loteId: input.loteId,
    codigoBarra: input.codigoBarra,
    capturedAt: input.capturedAt ?? Date.now(),
    status: 'pending',
    attempts: 0,
    lastError: null,
  }
}

export function getOfflineDeviceId(): string {
  const current = window.localStorage.getItem(DEVICE_ID_KEY)?.trim()
  if (current) return current

  const deviceId = createUuid()
  window.localStorage.setItem(DEVICE_ID_KEY, deviceId)
  return deviceId
}

export function summarizeOfflineScans(scans: OfflineScan[], loteId: number): OfflineScanSummary {
  return scans.reduce<OfflineScanSummary>((summary, scan) => {
    if (scan.loteId !== loteId) return summary
    if (scan.status === 'pending') summary.pending += 1
    if (scan.status === 'rejected') summary.rejected += 1
    summary.total += 1
    return summary
  }, { pending: 0, rejected: 0, total: 0 })
}

export async function synchronizePendingScans<T>(
  repository: OfflineScanRepository,
  send: (scan: OfflineScan) => Promise<T>,
  onConfirmed?: (scan: OfflineScan, result: T) => void | Promise<void>,
): Promise<OfflineSyncResult<T>> {
  const scans = (await repository.list())
    .filter((scan) => scan.status === 'pending')
    .sort(compareOfflineScans)
  let confirmed = 0
  let rejected = 0
  let paused = false
  let lastResult: T | null = null

  for (const scan of scans) {
    try {
      const result = await send(scan)
      await repository.remove(scan.id)
      await onConfirmed?.(scan, result)
      confirmed += 1
      lastResult = result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao sincronizar a caixa.'
      if (isDefinitiveRejection(error)) {
        await repository.markRejected(scan.id, message)
        rejected += 1
        continue
      }

      await repository.markAttempt(scan.id, message)
      paused = true
      break
    }
  }

  return { confirmed, rejected, paused, lastResult }
}

export async function saveOfflineScans(scans: OfflineScan[]): Promise<void> {
  if (scans.length === 0) return
  const database = await openDatabase()
  const transaction = database.transaction(SCANS_STORE, 'readwrite')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(SCANS_STORE)
  scans.forEach((scan) => store.put(scan))
  await done
}

export async function listOfflineScans(): Promise<OfflineScan[]> {
  const database = await openDatabase()
  const transaction = database.transaction(SCANS_STORE, 'readonly')
  const done = transactionDone(transaction)
  const scans = await requestResult<OfflineScan[]>(transaction.objectStore(SCANS_STORE).getAll())
  await done
  return scans.sort(compareOfflineScans)
}

export async function retryRejectedOfflineScans(loteId: number): Promise<void> {
  const scans = (await listOfflineScans()).filter((scan) => scan.loteId === loteId && scan.status === 'rejected')
  await Promise.all(scans.map((scan) => updateOfflineScan(scan.id, (current) => ({
    ...current,
    status: 'pending',
    lastError: null,
  }))))
}

export async function discardRejectedOfflineScans(loteId: number): Promise<void> {
  const scans = (await listOfflineScans()).filter((scan) => scan.loteId === loteId && scan.status === 'rejected')
  await Promise.all(scans.map((scan) => removeOfflineScan(scan.id)))
}

export async function writeCachedOperation(operation: OperacaoEmbalagem): Promise<void> {
  await Promise.all([
    writeCache(`operation:lote:${operation.lote.id}`, operation),
    writeCache(`operation:order:${normalizeOrderCode(operation.ordem.codigo)}`, operation),
  ])
}

export function readCachedOperation(loteId: number): Promise<OperacaoEmbalagem | null> {
  return readCache<OperacaoEmbalagem>(`operation:lote:${loteId}`)
}

export function readCachedOperationByOrder(codigoOrdem: string): Promise<OperacaoEmbalagem | null> {
  return readCache<OperacaoEmbalagem>(`operation:order:${normalizeOrderCode(codigoOrdem)}`)
}

export function writeCachedOrders(orders: OrdemDisponivel[]): Promise<void> {
  return writeCache(ORDERS_CACHE_KEY, orders)
}

export function readCachedOrders(): Promise<OrdemDisponivel[] | null> {
  return readCache<OrdemDisponivel[]>(ORDERS_CACHE_KEY)
}

function compareOfflineScans(left: OfflineScan, right: OfflineScan): number {
  return left.capturedAt - right.capturedAt || left.id.localeCompare(right.id)
}

function isDefinitiveRejection(error: unknown): boolean {
  const status = Number((error as { status?: unknown } | null)?.status)
  return Number.isInteger(status)
    && status >= 400
    && status < 500
    && ![401, 408, 419, 425, 429].includes(status)
}

async function updateOfflineScan(id: string, update: (scan: OfflineScan) => OfflineScan): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(SCANS_STORE, 'readwrite')
  const done = transactionDone(transaction)
  const store = transaction.objectStore(SCANS_STORE)
  const scan = await requestResult<OfflineScan | undefined>(store.get(id))
  if (scan) store.put(update(scan))
  await done
}

async function removeOfflineScan(id: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(SCANS_STORE, 'readwrite')
  const done = transactionDone(transaction)
  transaction.objectStore(SCANS_STORE).delete(id)
  await done
}

async function writeCache<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(CACHE_STORE, 'readwrite')
  const done = transactionDone(transaction)
  transaction.objectStore(CACHE_STORE).put({ key, value, updatedAt: Date.now() } satisfies CacheRecord<T>)
  await done
}

async function readCache<T>(key: string): Promise<T | null> {
  const database = await openDatabase()
  const transaction = database.transaction(CACHE_STORE, 'readonly')
  const done = transactionDone(transaction)
  const record = await requestResult<CacheRecord<T> | undefined>(transaction.objectStore(CACHE_STORE).get(key))
  await done
  return record?.value ?? null
}

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('O armazenamento offline não está disponível neste tablet.'))
  }
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(SCANS_STORE)) {
        const store = database.createObjectStore(SCANS_STORE, { keyPath: 'id' })
        store.createIndex('by_lote', 'loteId', { unique: false })
        store.createIndex('by_captured_at', 'capturedAt', { unique: false })
      }
      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.createObjectStore(CACHE_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('Não foi possível abrir o armazenamento offline.'))
    }
    request.onblocked = () => {
      databasePromise = null
      reject(new Error('O armazenamento offline está bloqueado por outra versão do aplicativo.'))
    }
  })

  return databasePromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento offline.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('A gravação offline foi cancelada.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao gravar os dados offline.'))
  })
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16)
    const digit = value === 'x' ? random : (random & 0x3) | 0x8
    return digit.toString(16)
  })
}

function normalizeOrderCode(value: string): string {
  return value.trim().toLowerCase()
}
