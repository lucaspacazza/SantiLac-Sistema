import { AUTH_EXPIRED_EVENT, MUTATION_SUCCEEDED_EVENT } from '../api/http'

type DraftField = {
  name: string
  value: string
  checked?: boolean
}

type DurableDraft = {
  version: 1
  updatedAt: number
  fields: DraftField[]
}

const STORAGE_PREFIX = 'santilac:system:draft:'
const MAX_AGE = 7 * 24 * 60 * 60 * 1_000
const EXCLUDED_FORMS = '.auth-panel, .login-form, .scan-form, .loading-scan, [data-draft="off"]'

export function installDurableForms(): () => void {
  const boundForms = new Map<HTMLFormElement, () => void>()
  const pendingKeys = new Set<string>()
  const committedKeys = new Set<string>()

  const bind = (form: HTMLFormElement) => {
    if (boundForms.has(form) || !isDurableForm(form)) return
    const key = keyForForm(form)
    const save = () => {
      committedKeys.delete(key)
      saveDraft(form, key)
    }
    const submit = () => {
      save()
      pendingKeys.add(key)
    }
    const restoreFrame = window.requestAnimationFrame(() => restoreDraft(form, key))

    form.addEventListener('input', save)
    form.addEventListener('change', save)
    form.addEventListener('submit', submit)
    boundForms.set(form, () => {
      window.cancelAnimationFrame(restoreFrame)
      if (committedKeys.has(key)) committedKeys.delete(key)
      else saveDraft(form, key)
      form.removeEventListener('input', save)
      form.removeEventListener('change', save)
      form.removeEventListener('submit', submit)
    })
  }

  const scan = (root: ParentNode = document) => {
    if (root instanceof HTMLFormElement) bind(root)
    root.querySelectorAll?.('form').forEach((form) => bind(form as HTMLFormElement))
  }
  const snapshotAll = () => {
    boundForms.forEach((_cleanup, form) => {
      const key = keyForForm(form)
      if (committedKeys.has(key)) return
      if (form.isConnected) saveDraft(form, key)
    })
  }
  const clearSubmitted = (event: Event) => {
    const path = (event as CustomEvent<{ path?: string }>).detail?.path ?? ''
    if (path.includes('/auth/')) return
    pendingKeys.forEach((key) => {
      committedKeys.add(key)
      clearDraft(key)
    })
    pendingKeys.clear()
  }
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) scan(node)
      })
      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof Element)) return
        const removed = node instanceof HTMLFormElement ? [node] : Array.from(node.querySelectorAll('form'))
        removed.forEach((form) => {
          const cleanup = boundForms.get(form as HTMLFormElement)
          cleanup?.()
          boundForms.delete(form as HTMLFormElement)
        })
      })
    }
  })

  scan()
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('pagehide', snapshotAll)
  window.addEventListener(AUTH_EXPIRED_EVENT, snapshotAll)
  window.addEventListener(MUTATION_SUCCEEDED_EVENT, clearSubmitted)

  return () => {
    observer.disconnect()
    snapshotAll()
    boundForms.forEach((cleanup) => cleanup())
    boundForms.clear()
    window.removeEventListener('pagehide', snapshotAll)
    window.removeEventListener(AUTH_EXPIRED_EVENT, snapshotAll)
    window.removeEventListener(MUTATION_SUCCEEDED_EVENT, clearSubmitted)
  }
}

function isDurableForm(form: HTMLFormElement): boolean {
  if (form.matches(EXCLUDED_FORMS) || form.querySelector('input[type="password"]')) return false
  return Array.from(form.elements).some((element) => (
    (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)
    && element.name !== ''
    && element.type !== 'password'
    && element.type !== 'file'
  ))
}

function saveDraft(form: HTMLFormElement, key: string): void {
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
    window.localStorage.setItem(storageKey(key), JSON.stringify({ version: 1, updatedAt: Date.now(), fields } satisfies DurableDraft))
  } catch {
    // The mounted form still survives a session expiry when storage is blocked.
  }
}

function restoreDraft(form: HTMLFormElement, key: string): void {
  const draft = readDraft(key)
  if (!draft) return
  const occurrence = new Map<string, number>()

  draft.fields.forEach((field) => {
    const index = occurrence.get(field.name) ?? 0
    occurrence.set(field.name, index + 1)
    const controls = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${escapeSelector(field.name)}"]`)
    const control = controls[index]
    if (!control) return
    if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
      control.checked = field.checked ?? true
    } else {
      setNativeValue(control, field.value)
    }
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function readDraft(key: string): DurableDraft | null {
  try {
    const draft = JSON.parse(window.localStorage.getItem(storageKey(key)) ?? 'null') as DurableDraft | null
    if (!draft || draft.version !== 1 || !Array.isArray(draft.fields) || Date.now() - draft.updatedAt > MAX_AGE) {
      if (draft) clearDraft(key)
      return null
    }
    return draft
  } catch {
    return null
  }
}

function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {
    // No-op when storage is unavailable.
  }
}

function keyForForm(form: HTMLFormElement): string {
  if (form.dataset.draftKey) return form.dataset.draftKey
  const owner = form.closest<HTMLElement>('[data-draft-owner]')?.dataset.draftOwner ?? 'anonymous'
  const signature = form.className || form.getAttribute('aria-label') || 'form'
  const matches = Array.from(document.forms).filter((item) => (item.className || item.getAttribute('aria-label') || 'form') === signature)
  const index = Math.max(0, matches.indexOf(form))
  return `${owner}|${window.location.pathname}|${window.location.hash.split('?')[0]}|${signature}|${index}`
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

function escapeSelector(value: string): string {
  return window.CSS?.escape ? window.CSS.escape(value) : value.replace(/["\\]/g, '\\$&')
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
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(control, value)
}
