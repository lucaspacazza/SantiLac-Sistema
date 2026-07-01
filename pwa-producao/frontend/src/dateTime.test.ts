import assert from 'node:assert/strict'
import test from 'node:test'
import { formatTimeValue, localDateValue, localTimeValue, parseTimeValue } from './dateTime.ts'

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
