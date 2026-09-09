import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const modulesSource = readFileSync(new URL('../../../shared/modules.ts', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../../../App.tsx', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('./OwnerDashboard.tsx', import.meta.url), 'utf8')

test('dashboard usa a sidebar compartilhada do sistema com todos os submódulos', () => {
  for (const title of [
    'Visão geral',
    'Captação de leite',
    'Produção e rendimento',
    'Qualidade e processo',
    'Estoque e expedição',
    'Todos os lotes',
  ]) {
    assert.match(modulesSource, new RegExp(title))
  }

  assert.doesNotMatch(appSource, /activeModule !== 'dashboard'/)
  assert.doesNotMatch(appSource, /is-dashboard/)
})

test('dashboard mantém todas as seções na mesma página e não cria conteúdo decorativo próprio', () => {
  assert.doesNotMatch(dashboardSource, /OwnerSidebar/)
  assert.doesNotMatch(dashboardSource, /owner-topbar/)
  assert.doesNotMatch(dashboardSource, /owner-side-insight/)
  assert.doesNotMatch(dashboardSource, /Últimos movimentos/)
  assert.doesNotMatch(dashboardSource, /Leitura da diretoria/)
  assert.doesNotMatch(dashboardSource, /owner-page-footer/)
  assert.doesNotMatch(dashboardSource, /Cada litro\. Cada lote\. Cada resultado/)
  assert.doesNotMatch(dashboardSource, /A fábrica inteira no seu primeiro olhar/)
  assert.match(dashboardSource, /hashchange/)
  assert.match(dashboardSource, /scrollIntoView/)
  assert.doesNotMatch(dashboardSource, /data-active-section/)
})

test('dashboard permite atalho de um dia e intervalo personalizado', () => {
  assert.match(dashboardSource, /\[1, 7, 14, 30\]/)
  assert.match(dashboardSource, /type="date"/)
  assert.match(dashboardSource, /data_inicio/)
  assert.match(dashboardSource, /data_fim/)
  assert.doesNotMatch(dashboardSource, /slice\(-30\)/)
})
