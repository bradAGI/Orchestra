# Embedded Agent Config — Model List & UX Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the embedded agent settings form so that model list populates after setting API keys, and improve the overall provider configuration UX flow.

**Architecture:** The `EmbeddedAgentConfigForm` in `SettingsCard.tsx` has a `useEffect` (line 822) that fetches models when `providerId`, `storedKey`, `apiKey`, or `modelId` changes. The bug is that: (1) `modelId` in the dependency array causes an infinite re-fetch loop — when models load, `modelId` gets set, which triggers the effect again; (2) when switching providers, `storedKey` and `hasKey` are reset but the key fetch effect (line 801) only runs on mount, so returning to a previously-configured provider doesn't restore the stored key; (3) the `hasKey` prop passed to `ModelSearchDropdown` uses `hasKey || !!apiKey.trim()` but `hasKey` is false after provider switch even if backend has a key stored. The UX issues include: no loading indicator during initial key fetch, no feedback when provider API returns errors (CORS, invalid key), and the "Save" button requiring a new key entry even when one is already stored.

**Tech Stack:** React 19, TypeScript, AI SDK 6 (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`), Vite

---

### Task 1: Fix the infinite re-fetch loop caused by `modelId` in useEffect deps

**Files:**
- Modify: `apps/desktop/src/components/settings/SettingsCard.tsx:822-856`
- Test: `apps/desktop/src/components/settings/SettingsCard.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create the test file to verify the model fetch effect doesn't loop:

```typescript
// apps/desktop/src/components/settings/SettingsCard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// We'll test the fetch behavior by mocking the providers module
vi.mock('@/components/embedded-agent/lib/providers', () => ({
  fetchProviderModels: vi.fn().mockResolvedValue([
    { id: 'model-1', name: 'Model One' },
    { id: 'model-2', name: 'Model Two' },
  ]),
  createProvider: vi.fn(),
}))

vi.mock('@/lib/orchestra-client', async (importOriginal) => {
  const orig = await importOriginal() as Record<string, unknown>
  return {
    ...orig,
    fetchAgentProviderKeys: vi.fn().mockResolvedValue({
      providers: {
        openrouter: { configured: true, api_key: 'sk-or-test-key' },
      },
    }),
    saveAgentProviderKey: vi.fn().mockResolvedValue({}),
  }
})

describe('EmbeddedAgentConfigForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should not re-fetch models when modelId changes', async () => {
    const { fetchProviderModels } = await import('@/components/embedded-agent/lib/providers')

    // After initial render and key load, fetchProviderModels should be called once
    // not infinitely due to modelId being in the dependency array
    await waitFor(() => {
      expect(fetchProviderModels).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && npx vitest run src/components/settings/SettingsCard.test.tsx`
Expected: FAIL — the current effect triggers multiple times due to `modelId` dependency

- [ ] **Step 3: Remove `modelId` from the useEffect dependency array**

In `apps/desktop/src/components/settings/SettingsCard.tsx`, change line 856:

```typescript
// BEFORE (line 822-856):
useEffect(() => {
    const key = storedKey || apiKey.trim()
    if (!key) {
      setModels([])
      setModelsError('')
      return
    }

    let cancelled = false
    setModelsLoading(true)
    setModelsError('')

    import('@/components/embedded-agent/lib/providers')
      .then(({ fetchProviderModels }) => fetchProviderModels(providerId, key))
      .then((fetched) => {
        if (cancelled) return
        setModels(fetched)
        if (fetched.length > 0 && !modelId) {
          const prefs = (() => { try { return JSON.parse(localStorage.getItem('orchestra-agent-provider-prefs') ?? '{}') } catch { return {} } })()
          const match = prefs.modelId && fetched.find((m: { id: string }) => m.id === prefs.modelId)
          setModelId(match ? prefs.modelId : fetched[0].id)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setModels([])
        setModelsError(err instanceof Error ? err.message : 'Failed to fetch models')
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })

    return () => { cancelled = true }
  }, [providerId, storedKey, apiKey, modelId])

// AFTER — remove modelId from deps, use ref for current modelId:
useEffect(() => {
    const key = storedKey || apiKey.trim()
    if (!key) {
      setModels([])
      setModelsError('')
      return
    }

    let cancelled = false
    setModelsLoading(true)
    setModelsError('')

    import('@/components/embedded-agent/lib/providers')
      .then(({ fetchProviderModels }) => fetchProviderModels(providerId, key))
      .then((fetched) => {
        if (cancelled) return
        setModels(fetched)
        setModelId((prev) => {
          if (prev && fetched.some((m: { id: string }) => m.id === prev)) return prev
          const prefs = (() => { try { return JSON.parse(localStorage.getItem('orchestra-agent-provider-prefs') ?? '{}') } catch { return {} } })()
          const match = prefs.modelId && fetched.find((m: { id: string }) => m.id === prefs.modelId)
          return match ? prefs.modelId : fetched[0]?.id ?? ''
        })
      })
      .catch((err) => {
        if (cancelled) return
        setModels([])
        setModelsError(err instanceof Error ? err.message : 'Failed to fetch models')
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })

    return () => { cancelled = true }
  }, [providerId, storedKey, apiKey])
```

Key changes:
- Removed `modelId` from dependency array — it was causing re-fetches every time a model was auto-selected
- Used `setModelId` functional updater to access current value without needing it as a dependency
- Added null-safe fallback with `fetched[0]?.id ?? ''`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && npx vitest run src/components/settings/SettingsCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsCard.tsx apps/desktop/src/components/settings/SettingsCard.test.tsx
git commit -m "fix(desktop): remove modelId from fetch effect deps to prevent infinite loop"
```

---

### Task 2: Restore stored keys when switching back to a previously-configured provider

**Files:**
- Modify: `apps/desktop/src/components/settings/SettingsCard.tsx:800-819` (mount effect)
- Modify: `apps/desktop/src/components/settings/SettingsCard.tsx:907-914` (provider change handler)

- [ ] **Step 1: Write the failing test**

```typescript
// Add to SettingsCard.test.tsx
describe('Provider switching', () => {
  it('should restore stored key when switching back to a configured provider', async () => {
    const { fetchAgentProviderKeys } = await import('@/lib/orchestra-client')
    ;(fetchAgentProviderKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
      providers: {
        openrouter: { configured: true, api_key: 'sk-or-key' },
        claude: { configured: true, api_key: 'sk-ant-key' },
      },
    })

    // Simulate: user on openrouter, switches to claude, switches back to openrouter
    // After switching back, storedKey should be restored from backend
    // and models should load without re-entering the key

    // This test validates the re-fetch mechanism works
    const { fetchProviderModels } = await import('@/components/embedded-agent/lib/providers')

    // After provider switches, fetchProviderModels should be called with the stored key
    await waitFor(() => {
      expect(fetchProviderModels).toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && npx vitest run src/components/settings/SettingsCard.test.tsx`
Expected: FAIL — currently provider switch clears storedKey and hasKey, and they're never restored

- [ ] **Step 3: Add a provider-change effect that re-checks stored keys**

In `apps/desktop/src/components/settings/SettingsCard.tsx`, modify the provider change handler at line 911:

```typescript
// BEFORE (line 911-913):
onChange={(v) => {
  setProviderId(v as string); setModelId(''); setModels([]); setStoredKey(''); setHasKey(false)
  try { localStorage.setItem('orchestra-agent-provider-prefs', JSON.stringify({ providerId: v, modelId: '' })) } catch { /* */ }
}}

// AFTER:
onChange={(v) => {
  const newProvider = v as string
  setProviderId(newProvider)
  setModelId('')
  setModels([])
  setModelsError('')
  try { localStorage.setItem('orchestra-agent-provider-prefs', JSON.stringify({ providerId: newProvider, modelId: '' })) } catch { /* */ }
  // Re-check if this provider has a stored key
  if (config) {
    fetchAgentProviderKeys(config).then((result) => {
      const info = result.providers[newProvider]
      if (info?.configured) {
        setHasKey(true)
        setStoredKey(info.api_key ?? '')
      } else {
        setHasKey(false)
        setStoredKey('')
      }
    }).catch(() => {
      setHasKey(false)
      setStoredKey('')
    })
  } else {
    setHasKey(false)
    setStoredKey('')
  }
}}
```

Note: `fetchAgentProviderKeys` is already imported at the top of the file. The `config` variable is available from component props.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && npx vitest run src/components/settings/SettingsCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsCard.tsx apps/desktop/src/components/settings/SettingsCard.test.tsx
git commit -m "fix(desktop): restore stored API keys when switching providers"
```

---

### Task 3: Add loading state during initial key fetch

**Files:**
- Modify: `apps/desktop/src/components/settings/SettingsCard.tsx:785-820`

- [ ] **Step 1: Add `initialLoading` state and show skeleton during key fetch**

```typescript
// In EmbeddedAgentConfigForm, after line 798, add:
const [initialLoading, setInitialLoading] = useState(true)

// Modify the mount useEffect (line 801-819):
useEffect(() => {
    if (!config) { setInitialLoading(false); return }
    setInitialLoading(true)
    fetchAgentProviderKeys(config)
      .then((result) => {
        const prefs = (() => { try { return JSON.parse(localStorage.getItem('orchestra-agent-provider-prefs') ?? '{}') } catch { return {} } })()
        const target = prefs.providerId && result.providers[prefs.providerId]?.configured
          ? prefs.providerId
          : CHAT_PROVIDERS.find(p => result.providers[p.id]?.configured)?.id
        if (target) {
          const info = result.providers[target]
          setProviderId(target)
          setHasKey(true)
          setStoredKey(info?.api_key ?? '')
          if (prefs.modelId) setModelId(prefs.modelId)
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false))
  }, [config])
```

- [ ] **Step 2: Wrap the form content with a loading check**

At the top of the return statement (line 896), add:

```typescript
if (initialLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border/20 bg-muted/10 p-4 space-y-4 animate-pulse">
          <div className="h-4 w-32 bg-muted/30 rounded" />
          <div className="h-8 w-full bg-muted/20 rounded-lg" />
          <div className="h-8 w-full bg-muted/20 rounded-lg" />
          <div className="h-8 w-48 bg-muted/20 rounded-lg" />
        </div>
      </div>
    )
  }
```

- [ ] **Step 3: Run typecheck and test**

Run: `cd apps/desktop && npx tsc --noEmit && npx vitest run src/components/settings/SettingsCard.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsCard.tsx
git commit -m "fix(desktop): add loading skeleton during initial provider key fetch"
```

---

### Task 4: Improve error display for provider API failures

**Files:**
- Modify: `apps/desktop/src/components/settings/SettingsCard.tsx:685-692`
- Modify: `apps/desktop/src/components/embedded-agent/lib/providers.ts:71-105`

- [ ] **Step 1: Improve error messages in provider fetch functions**

In `apps/desktop/src/components/embedded-agent/lib/providers.ts`, update the fetch error handling:

```typescript
// BEFORE (line 75):
if (!res.ok) throw new Error(`${res.status}`)

// AFTER:
if (res.status === 401) throw new Error('Invalid API key — check your key and try again')
if (res.status === 403) throw new Error('API key does not have permission to list models')
if (!res.ok) throw new Error(`Provider returned ${res.status}`)
```

Apply the same pattern to all three fetch functions: `fetchOpenAIModels` (line 75), `fetchOpenRouterModels` (line 86), and `fetchGeminiModels` (line 96).

- [ ] **Step 2: Show retry button in ModelSearchDropdown error state**

In `apps/desktop/src/components/settings/SettingsCard.tsx`, update the error display in `ModelSearchDropdown` (lines 685-692):

```typescript
// BEFORE:
if (error) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model</label>
        <p className="text-[11px] text-red-500">{error}</p>
      </div>
    )
  }

// AFTER:
if (error) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model</label>
        <p className="text-[11px] text-red-500">{error}</p>
        <p className="text-[10px] text-muted-foreground/60">Check your API key and try saving again, or switch providers.</p>
      </div>
    )
  }
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/settings/SettingsCard.tsx apps/desktop/src/components/embedded-agent/lib/providers.ts
git commit -m "fix(desktop): improve error messages for provider model fetch failures"
```

---

### Task 5: Verify full flow end-to-end

- [ ] **Step 1: Run all tests**

Run: `cd apps/desktop && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `cd apps/desktop && npm run lint`
Expected: No new warnings

- [ ] **Step 4: Manual verification checklist**

1. Open Settings > Integrations
2. Select OpenRouter → enter API key → models should load
3. Select a model → save → "API key saved" message
4. Switch to Anthropic → models should show static list immediately
5. Switch back to OpenRouter → stored key should restore, models should load
6. Click "Test Connection" → should verify successfully
7. Enter invalid key → should show helpful error message
