import assert from 'node:assert/strict'
import test from 'node:test'

import {
  closureDays,
  dashboardPeriod,
  normalizeProductName,
  filterLots,
  paginateItems,
} from './model.ts'

test('normaliza todas as grafias legadas de mucarela para Mussarela', () => {
  assert.equal(normalizeProductName('Muçarela'), 'Mussarela')
  assert.equal(normalizeProductName('mucarela fatiada'), 'Mussarela fatiada')
})

test('recorta dias e lotes reais para o período e produto selecionados', () => {
  const days = Array.from({ length: 30 }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}` }))
  const lots = [
    { id: '1', date: '2026-09-24', productId: 'mussarela', state: 'closed' },
    { id: '2', date: '2026-09-29', productId: 'prato', state: 'waiting' },
    { id: '3', date: '2026-09-30', productId: 'mussarela', state: 'packing' },
  ]

  const scoped = dashboardPeriod(days, lots, 7, 'mussarela')
  assert.deepEqual(scoped.days.map((day) => day.date), days.slice(-7).map((day) => day.date))
  assert.deepEqual(scoped.lots.map((lot) => lot.id), ['1', '3'])
})

test('filtra a tabela por situação, data e texto sem distinguir acentos', () => {
  const lots = [
    { id: 'OP-1', date: '2026-09-30', productId: 'mussarela', state: 'packing' },
    { id: 'OP-2', date: '2026-09-30', productId: 'prato', state: 'closed' },
  ]
  const products = [{ id: 'mussarela', name: 'Mussarela' }, { id: 'prato', name: 'Queijo prato' }]

  assert.deepEqual(filterLots(lots, products, { state: 'open', date: '2026-09-30', search: 'mussarela' }).map((lot) => lot.id), ['OP-1'])
})

test('o mapa de fechamento exibe somente dias que possuem lotes', () => {
  const days = [
    { date: '2026-09-07' },
    { date: '2026-09-08' },
    { date: '2026-09-09' },
  ]
  const lots = [
    { id: 'OP-1', date: '2026-09-08', productId: 'mussarela', state: 'waiting' },
  ]

  assert.deepEqual(closureDays(days, lots).map((day) => day.date), ['2026-09-08'])
})

test('estoque é dividido em páginas sem criar rolagem infinita', () => {
  const items = Array.from({ length: 13 }, (_, index) => ({ id: index + 1 }))

  assert.deepEqual(paginateItems(items, 1, 6), { items: items.slice(0, 6), page: 1, pageCount: 3 })
  assert.deepEqual(paginateItems(items, 3, 6), { items: items.slice(12), page: 3, pageCount: 3 })
})
