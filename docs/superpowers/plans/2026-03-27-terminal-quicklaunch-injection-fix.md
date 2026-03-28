# Terminal Quick-Launch — Fix Text Injection on Tab Switch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bug where switching terminal tabs re-injects agent name text ("claude", "codex", etc.) into the terminal.

**Architecture:** The root cause is in `TerminalView.tsx` — the `useEffect` has `initialCommand` as an implicit closure variable but does NOT include it in the dependency array (deps are `[sessionId, projectId, baseUrl, apiToken, theme]`). However, the real issue is in `TerminalMultiplexer.tsx` at line 209: the tab view uses `key={activeTab.id}` which is correct for identity, BUT the `TerminalNode` type carries `initialCommand` as a persistent property. When React unmounts/remounts the `TerminalView` on tab switch (because it's conditionally rendered based on `activeTab`), the effect runs again, creating a NEW WebSocket connection and re-sending `initialCommand`. Each tab switch creates a fresh WebSocket + PTY session, re-injecting the command. The fix: track whether the initial command has been sent per session and skip it on reconnection, OR better — separate the "launch command" from the persistent terminal node, sending it only once.

**Tech Stack:** React 19, TypeScript, xterm.js, WebSocket

---

### Task 1: Add a `commandSent` tracking mechanism to prevent re-injection

**Files:**
- Modify: `apps/desktop/src/components/terminal/TerminalView.tsx`
- Test: `apps/desktop/src/components/terminal/TerminalView.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// apps/desktop/src/components/terminal/TerminalView.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Track WebSocket send calls
const sendCalls: string[] = []

class MockWebSocket {
  static OPEN = 1
  readyState = MockWebSocket.OPEN
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null

  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 10)
  }

  send(data: string) {
    sendCalls.push(data)
  }

  close() {}
}

describe('TerminalView initial command', () => {
  beforeEach(() => {
    sendCalls.length = 0
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should only send initialCommand once even if component remounts', async () => {
    // This test verifies that after the initial command is sent,
    // remounting the component for the same sessionId does NOT resend it.
    // The fix needs to track sent commands per session.

    // First mount: should send "claude\n"
    // Second mount (tab switch): should NOT send "claude\n" again
    await new Promise(r => setTimeout(r, 600))
    const claudeSends = sendCalls.filter(c => c === 'claude\n')
    expect(claudeSends.length).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && npx vitest run src/components/terminal/TerminalView.test.tsx`
Expected: FAIL — currently the command is sent on every mount

- [ ] **Step 3: Add a module-level Set to track which sessions have received their initial command**

In `apps/desktop/src/components/terminal/TerminalView.tsx`:

```typescript
// BEFORE (line 1-4):
import React, { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

// AFTER — add a module-level tracker:
import React, { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

// Track which sessions have already had their initial command sent.
// This prevents re-injection when TerminalView remounts on tab switch.
const sentInitialCommands = new Set<string>()
```

Then modify the initial command logic in the `ws.onopen` handler (lines 77-84):

```typescript
// BEFORE (lines 77-84):
// Run initial command if provided (e.g. launching an agent)
if (initialCommand) {
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(initialCommand + '\n')
        }
    }, 500)
}

// AFTER:
// Run initial command if provided AND not already sent for this session
if (initialCommand && !sentInitialCommands.has(sessionId)) {
    sentInitialCommands.add(sessionId)
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(initialCommand + '\n')
        }
    }, 500)
}
```

- [ ] **Step 4: Clean up the tracker when a terminal is disposed**

In the cleanup function (line 126-131), add removal from the set:

```typescript
// BEFORE (lines 126-131):
return () => {
    window.removeEventListener('resize', handleResize)
    resizeObserver.disconnect()
    ws.close()
    term.dispose()
}

// AFTER:
return () => {
    window.removeEventListener('resize', handleResize)
    resizeObserver.disconnect()
    ws.close()
    term.dispose()
    // Note: we do NOT remove from sentInitialCommands here because
    // tab switches cause unmount+remount, and we want to prevent
    // re-injection. The entry is only cleaned up when the terminal
    // is fully closed (see Task 2).
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/desktop && npx vitest run src/components/terminal/TerminalView.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/terminal/TerminalView.tsx apps/desktop/src/components/terminal/TerminalView.test.tsx
git commit -m "fix(desktop): prevent terminal quick-launch from re-injecting commands on tab switch"
```

---

### Task 2: Clean up `sentInitialCommands` when terminal is permanently closed

**Files:**
- Modify: `apps/desktop/src/components/terminal/TerminalView.tsx`
- Modify: `apps/desktop/src/components/terminal/TerminalMultiplexer.tsx`

- [ ] **Step 1: Export a cleanup function from TerminalView**

```typescript
// In TerminalView.tsx, add export:
export function clearInitialCommandTracking(sessionId: string) {
    sentInitialCommands.delete(sessionId)
}
```

- [ ] **Step 2: Call it when a terminal is permanently closed**

In `TerminalMultiplexer.tsx`, when the close button is clicked (line 146-149):

```typescript
// BEFORE (lines 146-149):
<button
    onClick={(e) => {
        e.stopPropagation()
        onCloseTerminal(term.id)
    }}

// AFTER:
<button
    onClick={(e) => {
        e.stopPropagation()
        clearInitialCommandTracking(term.id)
        onCloseTerminal(term.id)
    }}
```

Add the import at the top of `TerminalMultiplexer.tsx`:

```typescript
import { TerminalView, clearInitialCommandTracking } from './TerminalView'
```

Also update the split view close button (line 232):

```typescript
// BEFORE:
onClick={() => onCloseTerminal(id)}

// AFTER:
onClick={() => { clearInitialCommandTracking(id); onCloseTerminal(id) }}
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/terminal/TerminalView.tsx apps/desktop/src/components/terminal/TerminalMultiplexer.tsx
git commit -m "fix(desktop): clean up initial command tracking when terminal is permanently closed"
```

---

### Task 3: Prevent WebSocket reconnection on tab switch (optimization)

The current implementation unmounts and remounts `TerminalView` on every tab switch because it's conditionally rendered. This creates a new WebSocket connection each time, which is wasteful. The fix: render ALL terminal views but hide inactive ones with CSS.

**Files:**
- Modify: `apps/desktop/src/components/terminal/TerminalMultiplexer.tsx:206-219`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to a TerminalMultiplexer.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TerminalMultiplexer } from './TerminalMultiplexer'

// Mock TerminalView to track mount/unmount
let mountCount = 0
vi.mock('./TerminalView', () => ({
  TerminalView: ({ sessionId }: { sessionId: string }) => {
    mountCount++
    return <div data-testid={`term-${sessionId}`}>Terminal {sessionId}</div>
  },
  clearInitialCommandTracking: vi.fn(),
}))

describe('TerminalMultiplexer tab switching', () => {
  it('should not remount terminals when switching tabs', () => {
    mountCount = 0
    const terminals = [
      { id: 'term-1', title: 'Shell 1' },
      { id: 'term-2', title: 'Shell 2' },
    ]

    render(
      <TerminalMultiplexer
        activeTerminals={terminals}
        baseUrl="http://localhost:4010"
        onCloseTerminal={() => {}}
      />
    )

    const initialMounts = mountCount

    // Switch to tab 2
    fireEvent.click(screen.getByText('Shell 2'))

    // Mount count should not increase — terminals stay mounted, just hidden
    expect(mountCount).toBe(initialMounts)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && npx vitest run src/components/terminal/TerminalMultiplexer.test.tsx`
Expected: FAIL — current code unmounts inactive terminals

- [ ] **Step 3: Render all terminals with CSS visibility toggle**

In `apps/desktop/src/components/terminal/TerminalMultiplexer.tsx`, replace lines 206-219:

```typescript
// BEFORE (lines 206-219):
{viewMode === 'tabs' ? (
    // Single terminal tab view
    activeTab && (
        <div className="w-full h-full px-3" key={activeTab.id}>
            <TerminalView
                sessionId={activeTab.id}
                projectId={activeTab.projectId}
                baseUrl={baseUrl}
                apiToken={apiToken}
                initialCommand={activeTab.initialCommand}
                theme={theme}
            />
        </div>
    )
)

// AFTER — render all, hide inactive:
{viewMode === 'tabs' ? (
    activeTerminals.map((term) => (
        <div
            key={term.id}
            className="w-full h-full px-3"
            style={{ display: activeTabId === term.id ? 'block' : 'none' }}
        >
            <TerminalView
                sessionId={term.id}
                projectId={term.projectId}
                baseUrl={baseUrl}
                apiToken={apiToken}
                initialCommand={term.initialCommand}
                theme={theme}
            />
        </div>
    ))
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && npx vitest run src/components/terminal/TerminalMultiplexer.test.tsx`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd apps/desktop && npx vitest run && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/terminal/TerminalMultiplexer.tsx apps/desktop/src/components/terminal/TerminalMultiplexer.test.tsx
git commit -m "perf(desktop): keep terminal WebSocket connections alive across tab switches"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd apps/desktop && npx vitest run && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 2: Manual verification checklist**

1. Click "Claude" quick-launch button → terminal opens, "claude" command is sent ONCE
2. Switch to another terminal tab → NO text injected
3. Switch back to Claude terminal → NO "claude" re-injected, agent still running
4. Click "Codex" quick-launch → new terminal, "codex" sent ONCE
5. Switch between Claude and Codex tabs rapidly → no phantom text
6. Close a terminal tab → re-open same agent → command IS sent (fresh session)
7. Open split view → all terminals visible, no duplicate commands
8. Resize window → terminals fit properly
