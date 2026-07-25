import assert from 'node:assert/strict'
import test from 'node:test'
import {
  draftFieldCount,
  draftFieldValue,
  isDraftFresh,
  type FormDraft,
} from './drafts.ts'

const draft: FormDraft = {
  version: 1,
  updatedAt: 1_000,
  fields: [
    { name: 'lote_queijo', value: '171' },
    { name: 'insumo_quantidade', value: '2,5' },
    { name: 'insumo_quantidade', value: '1' },
    { name: 'fosfatase', value: 'negativo' },
  ],
}

test('keeps every repeated field from a production form draft', () => {
  assert.equal(draftFieldCount(draft, 'insumo_quantidade'), 2)
  assert.equal(draftFieldValue(draft, 'insumo_quantidade', 0), '2,5')
  assert.equal(draftFieldValue(draft, 'insumo_quantidade', 1), '1')
})

test('restores named values used by custom time and select controls', () => {
  assert.equal(draftFieldValue(draft, 'lote_queijo'), '171')
  assert.equal(draftFieldValue(draft, 'fosfatase'), 'negativo')
  assert.equal(draftFieldValue(draft, 'missing'), undefined)
})

test('keeps an unfinished kiosk draft until it is successfully saved', () => {
  assert.equal(isDraftFresh(draft), true)
  assert.equal(isDraftFresh({ ...draft, updatedAt: Number.NaN }), false)
})
