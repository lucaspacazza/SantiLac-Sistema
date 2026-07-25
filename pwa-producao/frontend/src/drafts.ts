export type DraftField = {
  name: string
  value: string
  checked?: boolean
}

export type FormDraft = {
  version: 1
  updatedAt: number
  fields: DraftField[]
}

export const DRAFT_RESTORED_EVENT = 'santilac:draft-restored'
const STORAGE_PREFIX = 'santilac:pwa-producao:draft:'
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1_000
const committedDrafts = new Set<string>()

export function draftFieldValue(draft: FormDraft | null, name: string, index = 0): string | undefined {
  return draft?.fields.filter((field) => field.name === name)[index]?.value
}

export function draftFieldCount(draft: FormDraft | null, name: string): number {
  return draft?.fields.filter((field) => field.name === name).length ?? 0
}

export function isDraftFresh(draft: FormDraft, now = Date.now(), maxAge = DEFAULT_MAX_AGE): boolean {
  return now - draft.updatedAt <= maxAge
}

export function readFormDraft(key: string): FormDraft | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(key)) ?? 'null') as FormDraft | null
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.fields) || !isDraftFresh(parsed)) {
      if (parsed) window.localStorage.removeItem(storageKey(key))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveFormDraft(form: HTMLFormElement, key: string): void {
  committedDrafts.delete(key)
  const fields = Array.from(form.elements).flatMap<DraftField>((element) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return []
    if (!element.name || element.disabled || element.type === 'password' || element.type === 'file') return []
    const checkable = element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')
    if (checkable && !element.checked) return []

    return [{
      name: element.name,
      value: element.value,
      ...(checkable ? { checked: element.checked } : {}),
    }]
  })

  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify({ version: 1, updatedAt: Date.now(), fields } satisfies FormDraft))
  } catch {
    // Storage may be unavailable in private kiosk mode. The mounted form still
    // remains intact behind the reauthentication overlay.
  }
}

export function restoreFormDraft(form: HTMLFormElement, key: string): boolean {
  const draft = readFormDraft(key)
  if (!draft) return false

  const occurrence = new Map<string, number>()
  for (const field of draft.fields) {
    const index = occurrence.get(field.name) ?? 0
    occurrence.set(field.name, index + 1)
    const controls = Array.from(form.elements.namedItem(field.name) instanceof RadioNodeList
      ? form.elements.namedItem(field.name) as RadioNodeList
      : form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${CSS.escape(field.name)}"]`))
    const control = controls[index]
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) continue

    if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
      control.checked = field.checked ?? true
    } else {
      setNativeValue(control, field.value)
    }
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
  }

  window.dispatchEvent(new CustomEvent(DRAFT_RESTORED_EVENT, { detail: { key, draft } }))
  return true
}

export function clearFormDraft(key: string | undefined): void {
  if (!key) return
  committedDrafts.add(key)
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {
    // No-op when storage is unavailable.
  }
}

export function bindFormDraft(form: HTMLFormElement, key: string): () => void {
  const save = () => saveFormDraft(form, key)
  const snapshot = () => {
    if (committedDrafts.has(key)) return
    saveFormDraft(form, key)
  }
  const restoreFrame = window.requestAnimationFrame(() => {
    restoreFormDraft(form, key)
  })

  form.addEventListener('input', save)
  form.addEventListener('change', save)
  window.addEventListener('pagehide', snapshot)

  return () => {
    window.cancelAnimationFrame(restoreFrame)
    if (committedDrafts.has(key)) committedDrafts.delete(key)
    else save()
    form.removeEventListener('input', save)
    form.removeEventListener('change', save)
    window.removeEventListener('pagehide', snapshot)
  }
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

function setNativeValue(
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype = control instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLTextAreaElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  setter?.call(control, value)
}
