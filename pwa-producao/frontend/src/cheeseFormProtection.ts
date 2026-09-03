type FormDataReader = Pick<FormData, 'getAll'>

const NUMERIC_FIELDS = [
  { name: 'quantidade_leite', label: 'Quantidade de leite' },
  { name: 'gordura_inicial', label: 'Gordura inicial' },
  { name: 'gordura_final', label: 'Gordura final' },
  { name: 'acidez', label: 'Acidez' },
  { name: 'temperatura_pasteurizacao', label: 'Temperatura de pasteurização' },
  { name: 'temperatura_coagulacao', label: 'Temperatura de coagulação' },
  { name: 'temperatura_cozimento', label: 'Temperatura de cozimento' },
  { name: 'insumo_quantidade', label: 'Quantidade do insumo' },
] as const

const REQUIRED_INPUTS = [
  { key: 'fermento', label: 'Fermento' },
  { key: 'coalho', label: 'Coalho' },
  { key: 'cloreto', label: 'Cloreto' },
] as const

const FERMENT_TYPES = new Set(['fermento', 'fermento_mvd', 'fermento_fast'])

export function decimalInputValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  return String(value).replace(/\./g, ',')
}

export function cheeseNumericPointViolations(form: FormDataReader): string[] {
  return NUMERIC_FIELDS.flatMap(({ name, label }) => (
    form.getAll(name).some((value) => String(value).includes('.')) ? [label] : []
  ))
}

export function missingRequiredCheeseInputs(form: FormDataReader): string[] {
  const types = form.getAll('insumo_tipo').map(String)
  const quantities = form.getAll('insumo_quantidade').map(String)
  const present = new Set<string>()

  types.forEach((type, index) => {
    const rawQuantity = quantities[index]?.trim() ?? ''
    if (rawQuantity.includes('.')) return

    const quantity = Number(rawQuantity.replace(',', '.'))
    if (!Number.isFinite(quantity) || quantity <= 0) return

    if (FERMENT_TYPES.has(type)) present.add('fermento')
    if (type === 'coalho') present.add('coalho')
    if (type === 'cloreto') present.add('cloreto')
  })

  return REQUIRED_INPUTS
    .filter(({ key }) => !present.has(key))
    .map(({ label }) => label)
}
