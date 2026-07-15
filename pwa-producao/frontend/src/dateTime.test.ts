import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatTimeValue,
  localDateValue,
  localTimeValue,
  normalizeTimeValue,
  parseTimeValue,
  wheelIndexFromScroll,
} from './dateTime.ts'

test('formats the tablet local date without converting it to UTC', () => {
  const localDate = new Date(2026, 6, 1, 23, 58)
  assert.equal(localDateValue(localDate), '2026-07-01')
})

test('formats the tablet local time as HH:mm', () => {
  const localDate = new Date(2026, 6, 1, 7, 5)
  assert.equal(localTimeValue(localDate), '07:05')
  assert.equal(formatTimeValue(2, 9), '02:09')
})

test('parses a saved time and falls back to the tablet clock when empty', () => {
  const fallback = new Date(2026, 6, 1, 14, 37)

  assert.deepEqual(parseTimeValue('23:08', fallback), { hour: 23, minute: 8 })
  assert.deepEqual(parseTimeValue('', fallback), { hour: 14, minute: 37 })
  assert.deepEqual(parseTimeValue('29:90', fallback), { hour: 14, minute: 37 })
})

test('normalizes persisted times with seconds before displaying or submitting them', () => {
  const fallback = new Date(2026, 6, 1, 14, 37)

  assert.equal(normalizeTimeValue('8:53:00'), '08:53')
  assert.equal(normalizeTimeValue('08:53:42'), '08:53')
  assert.equal(normalizeTimeValue('08:53'), '08:53')
  assert.equal(normalizeTimeValue('29:90:00'), '')
  assert.deepEqual(parseTimeValue('08:53:00', fallback), { hour: 8, minute: 53 })
})

test('maps one wheel row of movement to exactly one adjacent value', () => {
  assert.equal(wheelIndexFromScroll(0, 52, 24), 0)
  assert.equal(wheelIndexFromScroll(52, 52, 24), 1)
  assert.equal(wheelIndexFromScroll(104, 52, 24), 2)
  assert.equal(wheelIndexFromScroll(1_999, 52, 24), 23)
})
