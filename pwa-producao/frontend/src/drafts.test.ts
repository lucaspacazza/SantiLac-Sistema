import assert from 'node:assert/strict'
import test from 'node:test'
import {
  draftFieldCount,
  draftFieldValue,
  isDraftFresh,
  type FormDraft,
} from './drafts'

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

test('expires abandoned drafts but keeps an overnight kiosk draft', () => {
  const day = 24 * 60 * 60 * 1_000

  assert.equal(isDraftFresh(draft, 1_000 + day, 7 * day), true)
  assert.equal(isDraftFresh(draft, 1_000 + 8 * day, 7 * day), false)
})
