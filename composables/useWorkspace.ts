import type { Quote } from '~/utils/quotes'
import { emptyWorkspace, validateWorkspace, type Workspace } from '~/utils/workspace'
import { today } from '~/utils/quotes'

export function useWorkspace() {
  const data = useState<Workspace>('workspace', emptyWorkspace)
  const loaded = useState('workspace-loaded', () => false)
  const storageError = useState('storage-error', () => '')
  const saving = ref(false)
  const dirty = useState('workspace-dirty', () => false)
  const version = useState('workspace-version', () => 0)
  const blocked = ref(false)
  let hydrating = false
  let timer: ReturnType<typeof setTimeout>
  let inflight: Promise<void> | null = null
  const errorMessage = (e: any) => e.data?.statusMessage || e.statusMessage || 'Unable to save. Export a backup and try again.'
  async function refreshWorkspace() {
    if (dirty.value || saving.value) throw new Error('Save pending changes or export them before reloading.')
    const result = await $fetch<{ payload: Workspace; version: number }>('/api/workspace')
    validateWorkspace(result.payload)
    hydrating = true
    data.value = result.payload; version.value = result.version
    await nextTick()
    hydrating = false; loaded.value = true; blocked.value = false; storageError.value = ''
  }
  async function saveNow(): Promise<void> {
    clearTimeout(timer)
    if (inflight) { await inflight; return saveNow() }
    if (!dirty.value) return
    if (!loaded.value || blocked.value) throw new Error(storageError.value || 'Cloud workspace is not ready')
    const payload = JSON.parse(JSON.stringify(data.value))
    validateWorkspace(payload)
    saving.value = true
    dirty.value = false
    inflight = (async () => {
      try {
        const result = await $fetch<{ version: number }>('/api/workspace', { method: 'PUT', body: { payload, version: version.value } })
        version.value = result.version; storageError.value = ''
      } catch (error: any) {
        dirty.value = true; blocked.value = true
        storageError.value = errorMessage(error) + ' Your unsaved changes remain here; export a backup before reloading.'
        throw error
      } finally { saving.value = false; inflight = null }
    })()
    await inflight
    if (dirty.value) await saveNow()
  }
  async function retrySave() { blocked.value = false; try { await saveNow() } catch {} }
  function onBeforeUnload(event: BeforeUnloadEvent) { if (dirty.value || saving.value) { event.preventDefault(); event.returnValue = '' } }
  onMounted(async () => {
    window.addEventListener('beforeunload', onBeforeUnload)
    if (loaded.value) return
    try { await refreshWorkspace() }
    catch (e) { blocked.value = true; storageError.value = errorMessage(e) }
  })
  onUnmounted(() => { clearTimeout(timer); window.removeEventListener('beforeunload', onBeforeUnload) })
  watch(data, () => {
    if (!import.meta.client || !loaded.value || hydrating) return
    dirty.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { saveNow().catch(() => {}) }, 750)
  }, { deep: true })
  // New revisions are separate draft records; sent quote contents remain immutable.
  function reviseQuote(q: Quote) {
    const copy = JSON.parse(JSON.stringify(q)) as Quote
    const sequence = Math.max(1000, ...data.value.quotes.map(q => Number(q.id.replace('QF-', '')) || 0)) + 1
    copy.id = `QF-${sequence}`; copy.status = 'Draft'; copy.created = today(); copy.followUp = ''
    copy.title = `${q.title.slice(0, 95)} (revision of ${q.id})`
    data.value.quotes.unshift(copy)
    return copy
  }
  return { data, loaded, storageError, saving, dirty, saveNow, refreshWorkspace, retrySave, reviseQuote }
}
