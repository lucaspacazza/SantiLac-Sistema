#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
const path = process.env.PATH_TO_TEST || '/api/auth/csrf'
const method = (process.env.METHOD || 'GET').toUpperCase()
const durationSeconds = positiveInt(process.env.DURATION_SECONDS, 15)
const concurrencies = (process.env.CONCURRENCY || '10')
  .split(',')
  .map((item) => positiveInt(item.trim(), 0))
  .filter((item) => item > 0)
const loginUser = process.env.LOGIN_USER || ''
const loginPassword = process.env.LOGIN_PASSWORD || ''
const body = process.env.BODY || ''
const extraHeaders = parseHeaders(process.env.HEADERS_JSON)
const cookiesEnabled = !['0', 'false'].includes((process.env.COOKIE_JAR || '1').toLowerCase())

if (!concurrencies.length) {
  fail('CONCURRENCY must be a positive integer or comma-separated list.')
}

if (method === 'POST' && path === '/api/auth/login') {
  console.warn('Warning: /api/auth/login is throttled in Laravel. Benchmark another endpoint after one login instead.')
}

class CookieJar {
  cookies = new Map()

  store(headers) {
    for (const cookie of getSetCookies(headers)) {
      const [pair] = cookie.split(';')
      const separator = pair.indexOf('=')
      if (separator <= 0) continue
      this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim())
    }
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')
  }
}

const jar = new CookieJar()

if (loginUser && loginPassword) {
  await loginOnce()
}

for (const concurrency of concurrencies) {
  await runScenario(concurrency)
}

async function loginOnce() {
  const csrfResponse = await fetchWithCookies('/api/auth/csrf', { method: 'GET' })
  const csrfJson = await csrfResponse.json().catch(() => null)
  const token = csrfJson?.data?.token

  if (!csrfResponse.ok || !token) {
    fail(`Could not get CSRF token. Status ${csrfResponse.status}.`)
  }

  const response = await fetchWithCookies('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-TOKEN': token,
    },
    body: new URLSearchParams({
      login: loginUser,
      password: loginPassword,
      remember: '0',
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    fail(`Login failed. Status ${response.status}. ${text.slice(0, 300)}`)
  }
}

async function runScenario(concurrency) {
  const deadline = performance.now() + durationSeconds * 1000
  const latencies = []
  const statuses = new Map()
  const errors = new Map()
  let total = 0

  async function worker() {
    while (performance.now() < deadline) {
      const started = performance.now()
      try {
        const response = await fetchWithCookies(path, {
          method,
          headers: {
            ...extraHeaders,
            ...(body && !extraHeaders['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
          },
          body: method === 'GET' || method === 'HEAD' ? undefined : body || undefined,
        })
        await response.arrayBuffer().catch(() => null)
        count(statuses, String(response.status))
      } catch (error) {
        count(errors, formatError(error))
      } finally {
        latencies.push(performance.now() - started)
        total += 1
      }
    }
  }

  const started = performance.now()
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  const elapsed = (performance.now() - started) / 1000

  latencies.sort((a, b) => a - b)
  const ok = Array.from(statuses.entries())
    .filter(([status]) => Number(status) >= 200 && Number(status) < 400)
    .reduce((sum, [, value]) => sum + value, 0)

  console.log(JSON.stringify({
    baseUrl,
    path,
    method,
    concurrency,
    duration_seconds: Number(elapsed.toFixed(2)),
    total_attempts: total,
    successful_requests: ok,
    failed_requests: total - ok,
    attempts_per_second: Number((total / elapsed).toFixed(2)),
    successful_requests_per_second: Number((ok / elapsed).toFixed(2)),
    p50_ms: percentile(latencies, 50),
    p95_ms: percentile(latencies, 95),
    p99_ms: percentile(latencies, 99),
    max_ms: latencies.length ? Number(latencies[latencies.length - 1].toFixed(2)) : 0,
    statuses: Object.fromEntries(statuses),
    errors: Object.fromEntries(errors),
  }, null, 2))
}

async function fetchWithCookies(requestPath, options) {
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  }

  if (cookiesEnabled) {
    const cookie = jar.header()
    if (cookie) headers.Cookie = cookie
  }

  const response = await fetch(`${baseUrl}${requestPath}`, {
    ...options,
    headers,
    redirect: 'manual',
  })

  if (cookiesEnabled) jar.store(response.headers)
  return response
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }

  const header = headers.get('set-cookie')
  if (!header) return []
  return header.split(/,(?=\s*[^;,]+=)/g).map((item) => item.trim())
}

function parseHeaders(value) {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    fail('HEADERS_JSON must be valid JSON.')
  }
}

function percentile(values, pct) {
  if (!values.length) return 0
  const index = Math.ceil((pct / 100) * values.length) - 1
  return Number(values[Math.max(0, Math.min(index, values.length - 1))].toFixed(2))
}

function count(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

function formatError(error) {
  if (!(error instanceof Error)) return String(error)

  const causeCode = error.cause && typeof error.cause === 'object' && 'code' in error.cause
    ? String(error.cause.code)
    : ''

  return [error.name, error.message, causeCode].filter(Boolean).join(':')
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
