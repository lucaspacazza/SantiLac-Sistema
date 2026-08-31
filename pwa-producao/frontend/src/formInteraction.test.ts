import assert from 'node:assert/strict'
import test from 'node:test'
import { CHEESE_FORM_DEFAULTS } from './cheeseFormDefaults.ts'
import { movedBeyondTapThreshold } from './touchInteraction.ts'

test('starts every cheese formulation with the usual editable process values', () => {
  assert.deepEqual(CHEESE_FORM_DEFAULTS, {
    temperatura_pasteurizacao: 73,
    fosfatase: 'negativo',
    peroxidase: 'positivo',
    temperatura_coagulacao: 36,
    temperatura_cozimento: 43,
  })
})

test('distinguishes a vertical scroll from a tap on a form control', () => {
  const start = { x: 120, y: 300 }

  assert.equal(movedBeyondTapThreshold(start, { x: 124, y: 306 }), false)
  assert.equal(movedBeyondTapThreshold(start, { x: 121, y: 315 }), true)
})
