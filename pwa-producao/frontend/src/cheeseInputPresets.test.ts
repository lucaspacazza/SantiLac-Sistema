import assert from 'node:assert/strict'
import test from 'node:test'
import { cheeseInputPreset } from './cheeseInputPresets.ts'

const catalog = [
  { id: 10, nome: 'CLORETO DE CÁLCIO', tipo_insumo: 'cloreto' as const, unidade: 'ml' },
  { id: 11, nome: 'FERMENTO FAST 1', tipo_insumo: 'fermento_fast' as const, unidade: 'g' },
  { id: 12, nome: 'FERMENTO MVD', tipo_insumo: 'fermento_mvd' as const, unidade: 'g' },
  { id: 13, nome: 'COALHO', tipo_insumo: 'coalho' as const, unidade: 'ml' },
  { id: 14, nome: 'BVADD', tipo_insumo: 'fermento' as const, unidade: 'g' },
  { id: 15, nome: 'QDT', tipo_insumo: 'fermento' as const, unidade: 'g' },
]

test('preselects the fixed mozzarella inputs with blank quantities', () => {
  const preset = cheeseInputPreset('Mussarela F4', catalog)

  assert.deepEqual(preset?.map(({ input, quantity }) => [input.nome, quantity]), [
    ['CLORETO DE CÁLCIO', ''],
    ['FERMENTO FAST 1', ''],
    ['FERMENTO MVD', ''],
    ['COALHO', ''],
  ])
})

test('preselects coalho and colonial recipes with their fixed quantities', () => {
  const coalho = cheeseInputPreset('Queijo Coalho', catalog)
  const colonial = cheeseInputPreset('Colonial', catalog)

  assert.deepEqual(coalho?.map(({ input, quantity }) => [input.nome, quantity]), [
    ['CLORETO DE CÁLCIO', '500'],
    ['COALHO', '90'],
    ['BVADD', '25'],
  ])
  assert.deepEqual(colonial?.map(({ input, quantity }) => [input.nome, quantity]), [
    ['CLORETO DE CÁLCIO', '400'],
    ['COALHO', '70'],
    ['QDT', '30'],
  ])
})

test('uses normalized catalog names and does not confuse other FAST cultures', () => {
  const inputs = [
    ...catalog.filter((input) => input.id !== 11),
    { id: 16, nome: 'Fermento Fast-2', tipo_insumo: 'fermento_fast' as const, unidade: 'g' },
    { id: 17, nome: 'Fermento Fast-1', tipo_insumo: 'fermento_fast' as const, unidade: 'g' },
  ]

  assert.equal(cheeseInputPreset('MUSSARELA', inputs)?.[1]?.input.id, 17)
})

test('returns no preset for another cheese or an incomplete catalog', () => {
  assert.equal(cheeseInputPreset('Provolone', catalog), null)
  assert.equal(cheeseInputPreset('Mussarela', catalog.filter((input) => input.id !== 12)), null)
})
