import Editor from '@monaco-editor/react'
import { useAppStore } from '@/store'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Save, RotateCcw, Check } from 'lucide-react'
import type { OpenFile } from '@/store/types'

interface EditorContentProps {
  file: OpenFile
}

export function EditorContent({ file }: EditorContentProps) {
  const setFileContent = useAppStore((s) => s.setFileContent)
  const setFileDirty = useAppStore((s) => s.setFileDirty)
  const loadFileContent = useAppStore((s) => s.loadFileContent)
  const clearPendingReveal = useAppStore((s) => s.clearPendingReveal)
  const theme = useAppStore((s) => s.theme)
  const config = useAppStore((s) => s.config)

  const originalContentRef = useRef<string>('')
  const editorRef = useRef<unknown>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reveal pending line when content + editor are both ready
  useEffect(() => {
    const line = file.pendingReveal
    const editor = editorRef.current as { revealLineInCenter?: (l: number) => void; setPosition?: (p: { lineNumber: number; column: number }) => void; focus?: () => void } | null
    if (!line || !editor || file.content === null) return
    try {
      editor.revealLineInCenter?.(line)
      editor.setPosition?.({ lineNumber: line, column: 1 })
      editor.focus?.()
    } catch (err) {
      console.warn('[editor] failed to reveal line', err)
    }
    clearPendingReveal(file.id)
  }, [file.id, file.pendingReveal, file.content, clearPendingReveal])

  const saveFile = useCallback(async () => {
    if (!file.isDirty || file.content === null) return
    setSaveState('saving')
    setSaveError(null)
    try {
      // Prefer backend HTTP API (works in browser dev mode); fall back to Electron IPC
      if (config?.baseUrl) {
        const url = `${config.baseUrl}/api/v1/workspace/file?path=${encodeURIComponent(file.filePath)}`
        const headers: Record<string, string> = { 'Content-Type': 'text/plain' }
        if (config.apiToken) headers['Authorization'] = `Bearer ${config.apiToken}`
        const res = await fetch(url, { method: 'PUT', headers, body: file.content })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
        }
      } else if (window.orchestraDesktop?.fs?.writeFile) {
        await window.orchestraDesktop.fs.writeFile(file.filePath, file.content)
      } else {
        throw new Error('No save transport available')
      }
      setFileDirty(file.id, false)
      originalContentRef.current = file.content
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    } catch (err) {
      console.error('[editor] save failed', err)
      setSaveError((err as Error).message)
      setSaveState('error')
    }
  }, [file.id, file.isDirty, file.content, file.filePath, config?.baseUrl, config?.apiToken, setFileDirty])

  const revertFile = useCallback(() => {
    if (!file.isDirty || originalContentRef.current === undefined) return
    setFileContent(file.id, originalContentRef.current)
    setFileDirty(file.id, false)
  }, [file.id, file.isDirty, setFileContent, setFileDirty])

  // Defensive load: if content is null and not loading, kick off a load.
  // Handles cases where openFile fired before config was ready.
  useEffect(() => {
    console.log('[editor] EditorContent effect', {
      id: file.id,
      hasContent: file.content !== null,
      loading: file.loading,
      hasConfig: !!config?.baseUrl,
    })
    if (file.content === null && !file.loading) {
      console.log('[editor] EditorContent: triggering loadFileContent for', file.id)
      loadFileContent(file.id)
    }
  }, [file.id, file.content, file.loading, config?.baseUrl, loadFileContent])

  // Track original content for dirty detection
  useEffect(() => {
    if (file.content !== null && !file.isDirty) {
      originalContentRef.current = file.content
    }
  }, [file.id, file.content, file.isDirty])

  // Save handler (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void saveFile()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [saveFile])

  if (file.content === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
        <div>{file.loading ? 'Loading…' : 'Waiting for backend…'}</div>
        <div className="text-[10px] opacity-60">{file.filePath}</div>
        {!file.loading && !config?.baseUrl && (
          <div className="text-[10px] text-amber-500">Backend config not loaded yet</div>
        )}
        {!file.loading && config?.baseUrl && (
          <button
            onClick={() => loadFileContent(file.id)}
            className="mt-1 text-[11px] px-2 py-0.5 rounded bg-accent hover:bg-accent/80"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 h-8 shrink-0 border-b border-border bg-card/50 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-muted-foreground" title={file.filePath}>{file.relativePath}</span>
          {file.isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" title="Unsaved changes" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-green-500">
              <Check size={11} /> Saved
            </span>
          )}
          {saveState === 'error' && saveError && (
            <span className="text-red-400 truncate max-w-[200px]" title={saveError}>{saveError}</span>
          )}
          <button
            onClick={revertFile}
            disabled={!file.isDirty}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title="Revert unsaved changes"
          >
            <RotateCcw size={11} /> Revert
          </button>
          <button
            onClick={() => void saveFile()}
            disabled={!file.isDirty || saveState === 'saving'}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Save (Ctrl+S)"
          >
            <Save size={11} /> {saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          key={file.id}
          language={file.language}
          value={file.content}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          onMount={(editor) => {
            editorRef.current = editor
            // Reveal pending line on mount if content already loaded
            const line = file.pendingReveal
            if (line) {
              try {
                editor.revealLineInCenter(line)
                editor.setPosition({ lineNumber: line, column: 1 })
                editor.focus()
                clearPendingReveal(file.id)
              } catch (err) {
                console.warn('[editor] onMount reveal failed', err)
              }
            }
          }}
          onChange={(value) => {
            if (value !== undefined) {
              setFileContent(file.id, value)
              setFileDirty(file.id, value !== originalContentRef.current)
            }
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  )
}
