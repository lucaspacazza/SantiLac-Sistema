import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCTION_WORKFLOWS } from './workflows.ts'

test('exposes every operational workflow from the production module', () => {
  assert.deepEqual(
    PRODUCTION_WORKFLOWS.map(({ id }) => id),
    ['ordens', 'queijo', 'soro', 'formulacao-creme', 'producao-creme'],
  )
})

test('keeps every workflow label short enough for a tablet navigation rail', () => {
  for (const workflow of PRODUCTION_WORKFLOWS) {
    assert.ok(workflow.shortLabel.length <= 12, `${workflow.id} has a long rail label`)
  }
})
