import { AUTH_EXPIRED_EVENT, MUTATION_SUCCEEDED_EVENT } from '../api/http'

type DraftControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

type DraftField = {
  name: string
  value: string
  controlIndex: number
  checked?: boolean
}

type DurableDraft = {
  version: 1
  updatedAt: number
  fields: DraftField[]
}

type BoundForm = {
  key: string
  snapshot: () => void
  cleanup: () => void
}

const STORAGE_PREFIX = 'santilac:system:draft:'
const RESTORE_PASSES = 8
const SUBMIT_SUCCESS_WINDOW = 15_000
const EXCLUDED_FORMS = '.auth-panel, .login-form, .scan-form, .loading-scan, [data-draft="off"]'
const installedSnapshotters = new Set<() => void>()

export function snapshotAllDurableForms(): void {
  installedSnapshotters.forEach((snapshot) => snapshot())
}

export function installDurableForms(): () => void {
  const boundForms = new Map<HTMLFormElement, BoundForm>()
  const pendingKeys = new Map<string, number>()
  const committedKeys = new Set<string>()

  const bind = (form: HTMLFormElement) => {
    if (boundForms.has(form) || !isDurableForm(form)) return
    const key = keyForForm(form)
    let hydrated = false
    let dirty = false
    let restoring = false
    let restoreFrame = 0
    let restorePass = 0

    const save = () => {
      if (restoring) return
      dirty = true
      committedKeys.delete(key)
      saveDraft(form, key)
    }
    const snapshot = () => {
      if (committedKeys.has(key)) return
      if (!hydrated && !dirty) return
      saveDraft(form, key)
    }
    const submit = () => {
      snapshot()
      pendingKeys.set(key, Date.now())
    }
    const restore = () => {
      if (dirty) {
        hydrated = true
        return
      }
      restoring = true
      const missingControls = restoreDraft(form, key)
      restoring = false
      hydrated = true
      restorePass += 1
      if (missingControls > 0 && restorePass < RESTORE_PASSES && form.isConnected) {
        restoreFrame = window.requestAnimationFrame(restore)
      }
    }

    form.addEventListener('input', save)
    form.addEventListener('change', save)
    form.addEventListener('submit', submit)
    restoreFrame = window.requestAnimationFrame(restore)

    const cleanup = () => {
      window.cancelAnimationFrame(restoreFrame)
      if (committedKeys.has(key)) committedKeys.delete(key)
      else snapshot()
      form.removeEventListener('input', save)
      form.removeEventListener('change', save)
      form.removeEventListener('submit', submit)
    }
    boundForms.set(form, { key, snapshot, cleanup })
  }

  const scan = (root: ParentNode = document) => {
    if (root instanceof HTMLFormElement) bind(root)
    root.querySelectorAll?.('form').forEach((form) => bind(form as HTMLFormElement))
  }
  const snapshotAll = () => {
    boundForms.forEach(({ key, snapshot }) => {
      if (committedKeys.has(key)) return
      snapshot()
    })
  }
  const snapshotBeforeNavigation = (event: Event) => {
    const target = event.target
    if (!(target instanceof Element) || !target.closest('a, button, [role="button"]')) return
    snapshotAll()
  }
  const clearSubmitted = (event: Event) => {
    const path = (event as CustomEvent<{ path?: string }>).detail?.path ?? ''
    if (path.includes('/auth/')) return
    const now = Date.now()
    pendingKeys.forEach((submittedAt, key) => {
      if (now - submittedAt > SUBMIT_SUCCESS_WINDOW) return
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
          const binding = boundForms.get(form as HTMLFormElement)
          binding?.cleanup()
          boundForms.delete(form as HTMLFormElement)
        })
      })
    }
  })

  scan()
  observer.observe(document.body, { childList: true, subtree: true })
  installedSnapshotters.add(snapshotAll)
  window.addEventListener('pagehide', snapshotAll)
  window.addEventListener(AUTH_EXPIRED_EVENT, snapshotAll)
  window.addEventListener(MUTATION_SUCCEEDED_EVENT, clearSubmitted)
  document.addEventListener('pointerdown', snapshotBeforeNavigation, true)
  document.addEventListener('click', snapshotBeforeNavigation, true)

  return () => {
    observer.disconnect()
    snapshotAll()
    boundForms.forEach(({ cleanup }) => cleanup())
    boundForms.clear()
    installedSnapshotters.delete(snapshotAll)
    window.removeEventListener('pagehide', snapshotAll)
    window.removeEventListener(AUTH_EXPIRED_EVENT, snapshotAll)
    window.removeEventListener(MUTATION_SUCCEEDED_EVENT, clearSubmitted)
    document.removeEventListener('pointerdown', snapshotBeforeNavigation, true)
    document.removeEventListener('click', snapshotBeforeNavigation, true)
  }
}

function isDurableForm(form: HTMLFormElement): boolean {
  if (form.matches(EXCLUDED_FORMS) || form.querySelector('input[type="password"]')) return false
  return draftControls(form).length > 0
}

function draftControls(form: HTMLFormElement): DraftControl[] {
  return Array.from(form.elements).filter((element): element is DraftControl => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return false
    return !element.disabled
      && element.type !== 'password'
      && element.type !== 'file'
      && element.type !== 'submit'
      && element.type !== 'button'
      && element.type !== 'reset'
  })
}

function saveDraft(form: HTMLFormElement, key: string): void {
  const fields = draftControls(form).flatMap<DraftField>((element, controlIndex) => {
    const checkable = element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')
    if (checkable && !element.checked) return []
    return [{
      name: element.name,
      value: element.value,
      controlIndex,
      ...(checkable ? { checked: element.checked } : {}),
    }]
  })

  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify({ version: 1, updatedAt: Date.now(), fields } satisfies DurableDraft))
  } catch {
    // The mounted form remains available behind the full-screen login when storage is blocked.
  }
}

function restoreDraft(form: HTMLFormElement, key: string): number {
  const draft = readDraft(key)
  if (!draft) return 0
  const controls = draftControls(form)
  const occurrence = new Map<string, number>()
  let missingControls = 0

  draft.fields.forEach((field) => {
    let control: DraftControl | undefined
    if (field.name) {
      const index = occurrence.get(field.name) ?? 0
      occurrence.set(field.name, index + 1)
      control = Array.from(form.querySelectorAll<DraftControl>(`[name="${escapeSelector(field.name)}"]`))[index]
    } else {
      control = controls[field.controlIndex]
    }
    if (!control) {
      missingControls += 1
      return
    }
    if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
      control.checked = field.checked ?? true
    } else {
      setNativeValue(control, field.value)
    }
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
  })

  return missingControls
}

function readDraft(key: string): DurableDraft | null {
  try {
    const draft = JSON.parse(window.localStorage.getItem(storageKey(key)) ?? 'null') as DurableDraft | null
    if (!draft || draft.version !== 1 || !Array.isArray(draft.fields)) {
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
  const owner = form.closest<HTMLElement>('[data-draft-owner]')?.dataset.draftOwner ?? 'anonymous'
  const signature = form.dataset.draftKey || form.className || form.getAttribute('aria-label') || 'form'
  const matches = Array.from(document.forms).filter((item) => (
    (item.dataset.draftKey || item.className || item.getAttribute('aria-label') || 'form') === signature
  ))
  const index = Math.max(0, matches.indexOf(form))
  const route = window.location.hash.split('?')[0]
  return `${owner}|${window.location.pathname}|${route}|${signature}|${index}`
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

function escapeSelector(value: string): string {
  return window.CSS?.escape ? window.CSS.escape(value) : value.replace(/["\\]/g, '\\$&')
}

function setNativeValue(control: DraftControl, value: string): void {
  const prototype = control instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(control, value)
}
