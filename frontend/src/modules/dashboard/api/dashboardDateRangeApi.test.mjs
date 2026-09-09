import assert from 'node:assert/strict'
import test from 'node:test'

import { quickDashboardDateRange, withDashboardDateRange } from './dashboardDateRangeApi.ts'

test('atalho diário usa somente a data final selecionada', () => {
  assert.deepEqual(quickDashboardDateRange(1, '2026-04-01'), {
    data_inicio: '2026-04-01',
    data_fim: '2026-04-01',
  })
})

test('intervalo é enviado para a API em parâmetros de consulta', () => {
  const path = withDashboardDateRange('/api/dashboard/leite', {
    data_inicio: '2026-01-01',
    data_fim: '2026-04-01',
  })

  assert.equal(path, '/api/dashboard/leite?data_inicio=2026-01-01&data_fim=2026-04-01')
})
