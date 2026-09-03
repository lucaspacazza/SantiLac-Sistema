import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cheeseNumericPointViolations,
  decimalInputValue,
  missingRequiredCheeseInputs,
} from './cheeseFormProtection.ts'

function formData(entries: Array<[string, string]>): FormData {
  const form = new FormData()
  entries.forEach(([name, value]) => form.append(name, value))
  return form
}

test('rejects a point in every numeric cheese-form field while allowing a comma', () => {
  const form = formData([
    ['quantidade_leite', '10000.000'],
    ['temperatura_pasteurizacao', '73'],
    ['gordura_inicial', '3,5'],
    ['insumo_quantidade', '25.5'],
  ])

  assert.deepEqual(cheeseNumericPointViolations(form), [
    'Quantidade de leite',
    'Quantidade do insumo',
  ])
})

test('shows persisted decimal values with a comma instead of a point', () => {
  assert.equal(decimalInputValue(36.5), '36,5')
  assert.equal(decimalInputValue('10000.000'), '10000,000')
  assert.equal(decimalInputValue('10.000.000'), '10,000,000')
  assert.equal(decimalInputValue(null), '')
})

test('requires fermento, coalho and cloreto only when finalizing', () => {
  const incomplete = formData([
    ['insumo_tipo', 'fermento_fast'],
    ['insumo_quantidade', '25'],
    ['insumo_tipo', 'coalho'],
    ['insumo_quantidade', ''],
  ])

  assert.deepEqual(missingRequiredCheeseInputs(incomplete), ['Coalho', 'Cloreto'])

  const complete = formData([
    ['insumo_tipo', 'fermento'],
    ['insumo_quantidade', '0,1'],
    ['insumo_tipo', 'coalho'],
    ['insumo_quantidade', '1'],
    ['insumo_tipo', 'cloreto'],
    ['insumo_quantidade', '1,5'],
  ])

  assert.deepEqual(missingRequiredCheeseInputs(complete), [])
})

test('does not count zero or malformed quantities as a required input', () => {
  const form = formData([
    ['insumo_tipo', 'fermento_mvd'],
    ['insumo_quantidade', '0'],
    ['insumo_tipo', 'coalho'],
    ['insumo_quantidade', '2.5'],
    ['insumo_tipo', 'cloreto'],
    ['insumo_quantidade', 'abc'],
  ])

  assert.deepEqual(missingRequiredCheeseInputs(form), ['Fermento', 'Coalho', 'Cloreto'])
})
