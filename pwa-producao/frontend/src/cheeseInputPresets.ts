export type CheeseCatalogInput = {
  id: number
  nome: string
  tipo_insumo: 'fermento_mvd' | 'fermento_fast' | 'fermento' | 'cloreto' | 'corante' | 'coalho' | 'outro'
  unidade: string
}

export type CheesePresetInput = {
  input: CheeseCatalogInput
  quantity: string
}

type PresetDefinition = {
  catalogKey: 'cloreto' | 'fast1' | 'mvd' | 'coalho' | 'bvadd' | 'qdt'
  quantity: string
}

const PRESETS: Record<'mussarela' | 'coalho' | 'colonial', PresetDefinition[]> = {
  mussarela: [
    { catalogKey: 'cloreto', quantity: '' },
    { catalogKey: 'fast1', quantity: '' },
    { catalogKey: 'mvd', quantity: '' },
    { catalogKey: 'coalho', quantity: '' },
  ],
  coalho: [
    { catalogKey: 'cloreto', quantity: '500' },
    { catalogKey: 'coalho', quantity: '90' },
    { catalogKey: 'bvadd', quantity: '25' },
  ],
  colonial: [
    { catalogKey: 'cloreto', quantity: '400' },
    { catalogKey: 'coalho', quantity: '70' },
    { catalogKey: 'qdt', quantity: '30' },
  ],
}

export function cheeseInputPreset(
  cheeseName: string,
  catalog: CheeseCatalogInput[],
): CheesePresetInput[] | null {
  const cheeseKey = presetCheeseKey(cheeseName)
  if (!cheeseKey) return null

  const resolved = PRESETS[cheeseKey].map(({ catalogKey, quantity }) => ({
    input: findCatalogInput(catalog, catalogKey),
    quantity,
  }))

  if (resolved.some(({ input }) => !input)) return null

  return resolved.map(({ input, quantity }) => ({
    input: input as CheeseCatalogInput,
    quantity,
  }))
}

function presetCheeseKey(cheeseName: string): keyof typeof PRESETS | null {
  const normalized = compact(cheeseName)
  if (normalized.includes('mussarela')) return 'mussarela'
  if (normalized.includes('colonial')) return 'colonial'
  if (normalized.includes('coalho')) return 'coalho'
  return null
}

function findCatalogInput(
  catalog: CheeseCatalogInput[],
  key: PresetDefinition['catalogKey'],
): CheeseCatalogInput | undefined {
  return catalog.find((input) => {
    const name = compact(input.nome)
    if (key === 'fast1') return name.includes('fast1')
    if (key === 'mvd') return name.includes('mvd')
    if (key === 'bvadd') return name.includes('bvadd')
    if (key === 'qdt') return name.includes('qdt')
    if (key === 'cloreto') return input.tipo_insumo === 'cloreto' || name.includes('cloreto')
    return input.tipo_insumo === 'coalho' || name.includes('coalho')
  })
}

function compact(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}
